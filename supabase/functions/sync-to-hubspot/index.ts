import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prospectId } = await req.json();
    console.log('Syncing prospect to HubSpot:', prospectId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Get prospect from database
    const { data: prospect, error: prospectError } = await supabaseClient
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (prospectError || !prospect) {
      throw new Error('Prospect not found');
    }

    // Prepare HubSpot contact data
    const hubspotData = {
      properties: {
        email: prospect.email,
        firstname: prospect.name.split(' ')[0] || prospect.name,
        lastname: prospect.name.split(' ').slice(1).join(' ') || '',
        phone: prospect.phone || '',
        company: prospect.company || '',
        city: prospect.city || '',
        state: prospect.state || '',
        
        // Custom Zillow properties
        supabase_id: prospect.id,
        zillow_position: prospect.zillow_position?.toString() || '',
        zillow_page: prospect.zillow_page?.toString() || '',
        agents_ahead: prospect.agents_ahead?.toString() || '',
        zillow_total_agents: prospect.zillow_total_agents?.toString() || '',
        zillow_rating: prospect.zillow_rating?.toString() || '',
        zillow_reviews: prospect.zillow_reviews?.toString() || '',
        zillow_profile_url: prospect.zillow_profile_url || '',
        prospect_status: prospect.status || 'new',
        email_snippet: prospect.email_snippet || '',
      }
    };

    const hubspotApiKey = Deno.env.get('HUBSPOT_API_KEY');

    // Try to create or update contact in HubSpot
    let hubspotContactId = prospect.hubspot_contact_id;
    let action = 'created';

    if (hubspotContactId) {
      // Update existing contact
      const updateResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${hubspotContactId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${hubspotApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(hubspotData),
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Failed to update HubSpot contact: ${await updateResponse.text()}`);
      }
      action = 'updated';
      console.log('Updated HubSpot contact:', hubspotContactId);
    } else {
      // Create new contact
      const createResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(hubspotData),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        
        // If contact exists, try to find and update it
        if (createResponse.status === 409) {
          const searchResponse = await fetch(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${hubspotApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                filterGroups: [{
                  filters: [{
                    propertyName: 'email',
                    operator: 'EQ',
                    value: prospect.email
                  }]
                }]
              }),
            }
          );

          const searchData = await searchResponse.json();
          if (searchData.results && searchData.results.length > 0) {
            hubspotContactId = searchData.results[0].id;
            
            // Update the found contact
            const updateResponse = await fetch(
              `https://api.hubapi.com/crm/v3/objects/contacts/${hubspotContactId}`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${hubspotApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(hubspotData),
              }
            );

            if (!updateResponse.ok) {
              throw new Error('Failed to update existing contact');
            }
            action = 'updated';
          }
        } else {
          throw new Error(`HubSpot API error: ${errorText}`);
        }
      } else {
        const hubspotContact = await createResponse.json();
        hubspotContactId = hubspotContact.id;
        console.log('Created HubSpot contact:', hubspotContactId);
      }
    }

    // Update prospect in Supabase with sync status
    const { error: updateError } = await supabaseClient
      .from('prospects')
      .update({
        hubspot_contact_id: hubspotContactId,
        hubspot_synced: true,
        hubspot_synced_at: new Date().toISOString(),
        hubspot_last_error: null,
      })
      .eq('id', prospectId);

    if (updateError) {
      console.error('Failed to update prospect sync status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        hubspotContactId,
        action
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing prospect to HubSpot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Try to log error to database if we have a prospect ID
    try {
      const { prospectId } = await req.json();
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      );
      
      await supabaseClient
        .from('prospects')
        .update({
          hubspot_last_error: errorMessage,
        })
        .eq('id', prospectId);
    } catch (logError) {
      console.error('Failed to log error to database:', logError);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
