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
    const { limit = 50 } = await req.json().catch(() => ({}));
    console.log('Starting bulk sync to HubSpot, limit:', limit);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get unsynced prospects
    const { data: prospects, error: fetchError } = await supabaseClient
      .from('prospects')
      .select('*')
      .eq('hubspot_synced', false)
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch prospects: ${fetchError.message}`);
    }

    if (!prospects || prospects.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No prospects to sync',
          synced: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${prospects.length} prospects to sync`);

    const hubspotApiKey = Deno.env.get('HUBSPOT_API_KEY');
    const results = {
      synced: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each prospect with rate limiting
    for (const prospect of prospects) {
      try {
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

        // Try to create contact
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

        let hubspotContactId;

        if (createResponse.ok) {
          const hubspotContact = await createResponse.json();
          hubspotContactId = hubspotContact.id;
          console.log('Created HubSpot contact:', hubspotContactId);
        } else if (createResponse.status === 409) {
          // Contact exists, find and update
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
            console.log('Updated existing HubSpot contact:', hubspotContactId);
          }
        } else {
          throw new Error(`HubSpot API error: ${await createResponse.text()}`);
        }

        // Update prospect in Supabase
        await supabaseClient
          .from('prospects')
          .update({
            hubspot_contact_id: hubspotContactId,
            hubspot_synced: true,
            hubspot_synced_at: new Date().toISOString(),
            hubspot_last_error: null,
          })
          .eq('id', prospect.id);

        results.synced++;

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Failed to sync prospect ${prospect.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.failed++;
        results.errors.push(`${prospect.name}: ${errorMessage}`);

        // Log error to database
        await supabaseClient
          .from('prospects')
          .update({
            hubspot_last_error: errorMessage,
          })
          .eq('id', prospect.id);
      }
    }

    console.log('Bulk sync completed:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
