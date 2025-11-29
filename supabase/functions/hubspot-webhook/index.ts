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
    const payload = await req.json();
    console.log('Received HubSpot webhook:', JSON.stringify(payload));

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Extract contact data from HubSpot webhook
    // HubSpot sends different formats depending on workflow setup
    // Common formats: { contactId: "123", properties: {...} } or { objectId: "123", properties: {...} }
    const contactId = payload.contactId || payload.objectId || payload.contact_id;
    const properties = payload.properties || {};

    if (!contactId) {
      throw new Error('No contact ID found in webhook payload');
    }

    console.log('Processing contact ID:', contactId);

    // Find the prospect by HubSpot contact ID
    const { data: prospect, error: findError } = await supabaseClient
      .from('prospects')
      .select('*')
      .eq('hubspot_contact_id', contactId)
      .single();

    if (findError || !prospect) {
      console.log('Prospect not found for HubSpot contact:', contactId);
      // This might be a new contact created directly in HubSpot
      // You could optionally create it here if needed
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Prospect not found in Supabase' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare update data
    const updateData: any = {};

    // Map HubSpot properties back to Supabase fields
    if (properties.firstname || properties.lastname) {
      const firstName = properties.firstname || prospect.name.split(' ')[0];
      const lastName = properties.lastname || prospect.name.split(' ').slice(1).join(' ');
      updateData.name = `${firstName} ${lastName}`.trim();
    }
    
    if (properties.email) updateData.email = properties.email;
    if (properties.phone) updateData.phone = properties.phone;
    if (properties.company) updateData.company = properties.company;
    if (properties.city) updateData.city = properties.city;
    if (properties.state) updateData.state = properties.state;
    
    // Update CRM fields
    if (properties.prospect_status) updateData.status = properties.prospect_status;
    if (properties.email_snippet) updateData.email_snippet = properties.email_snippet;

    // Update Zillow fields if they changed
    if (properties.zillow_position) updateData.zillow_position = parseInt(properties.zillow_position);
    if (properties.zillow_page) updateData.zillow_page = parseInt(properties.zillow_page);
    if (properties.agents_ahead) updateData.agents_ahead = parseInt(properties.agents_ahead);
    if (properties.zillow_total_agents) updateData.zillow_total_agents = parseInt(properties.zillow_total_agents);
    if (properties.zillow_rating) updateData.zillow_rating = parseFloat(properties.zillow_rating);
    if (properties.zillow_reviews) updateData.zillow_reviews = parseInt(properties.zillow_reviews);
    if (properties.zillow_profile_url) updateData.zillow_profile_url = properties.zillow_profile_url;

    // Only update if we have changes
    if (Object.keys(updateData).length === 0) {
      console.log('No changes detected from HubSpot webhook');
      return new Response(
        JSON.stringify({ success: true, message: 'No changes to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the prospect in Supabase
    const { error: updateError } = await supabaseClient
      .from('prospects')
      .update(updateData)
      .eq('id', prospect.id);

    if (updateError) {
      throw new Error(`Failed to update prospect: ${updateError.message}`);
    }

    console.log('Successfully synced HubSpot changes to prospect:', prospect.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        prospectId: prospect.id,
        updatedFields: Object.keys(updateData)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing HubSpot webhook:', error);
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
