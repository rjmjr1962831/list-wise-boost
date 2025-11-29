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

    // Prepare HubSpot contact data - build properties dynamically
    const properties: Record<string, any> = {
      email: prospect.email,
      firstname: prospect.name.split(' ')[0] || prospect.name,
      lastname: prospect.name.split(' ').slice(1).join(' ') || '',
      supabase_id: prospect.id,
      prospect_status: prospect.status || 'new',
    };

    // Optional string fields - only add if they have values
    if (prospect.phone) properties.phone = prospect.phone;
    if (prospect.company) properties.company = prospect.company;
    if (prospect.city) properties.city = prospect.city;
    if (prospect.state) properties.state = prospect.state;
    if (prospect.zillow_profile_url) properties.zillow_profile_url = prospect.zillow_profile_url;
    if (prospect.zillow_profile_id) properties.zillow_profile_id = prospect.zillow_profile_id;
    if (prospect.zillow_photo_url) properties.zillow_photo_url = prospect.zillow_photo_url;
    if (prospect.zillow_sales_volume) properties.zillow_sales_volume = prospect.zillow_sales_volume;
    if (prospect.email_snippet) properties.email_snippet = prospect.email_snippet;
    if (prospect.notes) properties.notes = prospect.notes;

    // Number fields - only add if they have actual values (HubSpot rejects empty strings for number fields)
    if (prospect.zillow_position != null) properties.zillow_position = prospect.zillow_position;
    if (prospect.zillow_page != null) properties.zillow_page = prospect.zillow_page;
    if (prospect.agents_ahead != null) properties.agents_ahead = prospect.agents_ahead;
    if (prospect.zillow_total_agents != null) properties.zillow_total_agents = prospect.zillow_total_agents;
    if (prospect.zillow_rating != null) properties.zillow_rating = Number(prospect.zillow_rating);
    if (prospect.zillow_reviews != null) properties.zillow_reviews = prospect.zillow_reviews;
    if (prospect.zillow_sales_count != null) properties.zillow_sales_count = prospect.zillow_sales_count;

    // Date field - format as ISO string for HubSpot
    if (prospect.zillow_scraped_at) properties.zillow_scraped_at = prospect.zillow_scraped_at;

    const hubspotData = { properties };

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
