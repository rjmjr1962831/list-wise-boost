import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, zillowUrl } = await req.json();

    if (!name || !email || !zillowUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this agent is already in the professionals table
    let professionalId = null;
    const normalizedUrl = zillowUrl.toLowerCase().trim();
    const urlSegment = normalizedUrl.split('/profile/')[1]?.split('/')[0];
    
    if (urlSegment) {
      const { data: existingPro } = await supabase
        .from('professionals')
        .select('id')
        .ilike('zillow_profile_url', `%${urlSegment}%`)
        .eq('active', true)
        .maybeSingle();
      
      if (existingPro) {
        professionalId = existingPro.id;
      }
    }

    // Insert into crm_leads table
    const { data: lead, error: insertError } = await supabase
      .from('crm_leads')
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        zillow_url: zillowUrl.trim(),
        status: 'new',
        priority: 'normal',
        source: 'website_form',
        professional_id: professionalId
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting lead:', insertError);
      throw insertError;
    }

    console.log(`✓ Created CRM lead: ${lead.id} for ${name}`);

    // Log audit trail
    await supabase.from('audit_log').insert({
      user_email: 'system',
      action: 'lead_created',
      resource_type: 'crm_lead',
      resource_id: lead.id,
      details: {
        name,
        email,
        zillow_url: zillowUrl,
        professional_id: professionalId,
        source: 'website_form'
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        leadId: lead.id,
        alreadyQualified: !!professionalId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing review request:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to process request' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
