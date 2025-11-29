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
