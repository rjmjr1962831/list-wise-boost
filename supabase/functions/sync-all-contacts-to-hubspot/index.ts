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
    console.log('Starting bulk sync to HubSpot');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Get all contacts from database
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (contactsError || !contacts) {
      throw new Error('Failed to fetch contacts');
    }

    console.log(`Found ${contacts.length} contacts to sync`);

    const hubspotApiKey = Deno.env.get('HUBSPOT_API_KEY');
    const results = {
      success: 0,
      failed: 0,
      updated: 0,
      created: 0,
      errors: [] as string[],
    };

    // Sync each contact
    for (const contact of contacts) {
      try {
        const hubspotData = {
          properties: {
            email: contact.email,
            firstname: contact.full_name.split(' ')[0] || contact.full_name,
            lastname: contact.full_name.split(' ').slice(1).join(' ') || '',
            phone: contact.phone || '',
            message: contact.message,
            lifecyclestage: 'lead',
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

        if (createResponse.ok) {
          results.success++;
          results.created++;
          console.log(`Created contact: ${contact.email}`);
        } else if (createResponse.status === 409) {
          // Contact exists, try to update
          const searchResponse = await fetch(
            `https://api.hubapi.com/crm/v3/objects/contacts/search`,
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
                    value: contact.email
                  }]
                }]
              }),
            }
          );

          const searchData = await searchResponse.json();
          if (searchData.results && searchData.results.length > 0) {
            const hubspotContactId = searchData.results[0].id;
            
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

            if (updateResponse.ok) {
              results.success++;
              results.updated++;
              console.log(`Updated contact: ${contact.email}`);
            } else {
              results.failed++;
              results.errors.push(`Failed to update ${contact.email}`);
            }
          }
        } else {
          const errorText = await createResponse.text();
          results.failed++;
          results.errors.push(`${contact.email}: ${errorText}`);
          console.error(`Failed to sync ${contact.email}:`, errorText);
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${contact.email}: ${errorMessage}`);
        console.error(`Error syncing ${contact.email}:`, error);
      }
    }

    console.log('Sync complete:', results);

    return new Response(
      JSON.stringify(results),
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
