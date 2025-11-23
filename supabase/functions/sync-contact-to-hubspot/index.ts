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
    const { contactId } = await req.json();
    console.log('Syncing contact to HubSpot:', contactId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Get contact from database
    const { data: contact, error: contactError } = await supabaseClient
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      throw new Error('Contact not found');
    }

    // Prepare HubSpot contact data
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

    // Create or update contact in HubSpot
    const hubspotApiKey = Deno.env.get('HUBSPOT_API_KEY');
    const hubspotResponse = await fetch(
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

    if (!hubspotResponse.ok) {
      const errorData = await hubspotResponse.text();
      console.error('HubSpot API error:', errorData);
      
      // If contact already exists, try to update instead
      if (hubspotResponse.status === 409) {
        // Search for existing contact by email
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
            throw new Error('Failed to update contact in HubSpot');
          }

          const updatedContact = await updateResponse.json();
          console.log('Updated contact in HubSpot:', updatedContact.id);

          return new Response(
            JSON.stringify({ 
              success: true, 
              hubspotContactId: updatedContact.id,
              action: 'updated'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      throw new Error(`HubSpot API error: ${errorData}`);
    }

    const hubspotContact = await hubspotResponse.json();
    console.log('Created contact in HubSpot:', hubspotContact.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        hubspotContactId: hubspotContact.id,
        action: 'created'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing contact to HubSpot:', error);
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
