import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationLink {
  id: string;
  name: string;
  email: string;
  phone: string;
  verification_link: string;
  token: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const hubspotApiKey = Deno.env.get('HUBSPOT_API_KEY');
    if (!hubspotApiKey) {
      throw new Error('HUBSPOT_API_KEY not configured');
    }

    const { links } = await req.json() as { links: VerificationLink[] };

    console.log(`🔄 Syncing ${links.length} verification links to HubSpot...`);

    const results = {
      total: links.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const link of links) {
      try {
        // Skip if no email
        if (!link.email) {
          console.log(`⚠️ Skipping ${link.name} - no email address`);
          results.failed++;
          results.errors.push(`${link.name}: No email address`);
          continue;
        }

        // Prepare contact data for HubSpot
        const contactData = {
          properties: {
            email: link.email,
            firstname: link.name.split(' ')[0] || '',
            lastname: link.name.split(' ').slice(1).join(' ') || '',
            phone: link.phone || '',
            verification_link: link.verification_link,
            verification_token: link.token,
            verification_sent_date: new Date().toISOString()
          }
        };

        // Try to create contact first
        console.log(`📧 Processing ${link.name} (${link.email})...`);
        
        const createResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contactData)
        });

        if (createResponse.ok) {
          const result = await createResponse.json();
          console.log(`✅ Created contact in HubSpot: ${link.name} (ID: ${result.id})`);
          results.created++;
        } else if (createResponse.status === 409) {
          // Contact exists, update it
          console.log(`🔍 Contact exists, searching for ${link.email}...`);
          
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
                    value: link.email
                  }]
                }]
              })
            }
          );

          if (searchResponse.ok) {
            const searchResult = await searchResponse.json();
            if (searchResult.results && searchResult.results.length > 0) {
              const contactId = searchResult.results[0].id;
              
              // Update the contact
              const updateResponse = await fetch(
                `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${hubspotApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(contactData)
                }
              );

              if (updateResponse.ok) {
                console.log(`✅ Updated contact in HubSpot: ${link.name} (ID: ${contactId})`);
                results.updated++;
              } else {
                throw new Error(`Failed to update contact: ${await updateResponse.text()}`);
              }
            }
          }
        } else {
          throw new Error(`Failed to create contact: ${await createResponse.text()}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`❌ Error syncing ${link.name}:`, error.message);
        results.failed++;
        results.errors.push(`${link.name}: ${error.message}`);
      }
    }

    console.log(`✅ HubSpot sync complete:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in sync-verification-links-to-hubspot:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});