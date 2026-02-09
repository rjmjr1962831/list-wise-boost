import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=3600, must-revalidate',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const agentId = pathParts[pathParts.length - 1];

    if (!agentId || agentId === 'artifact-payload') {
      return new Response(
        JSON.stringify({ error: 'Agent ID required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Fetch certification
    const { data: cert, error: certError } = await supabaseClient
      .from('certifications')
      .select('*')
      .eq('agent_id', agentId)
      .eq('certification_status', 'active')
      .single();

    if (certError || !cert) {
      return new Response(
        JSON.stringify({ error: 'Certification not found or inactive' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch professional details
    const { data: prof, error: profError } = await supabaseClient
      .from('professionals')
      .select('id, name, specialty, short_code')
      .eq('id', agentId)
      .single();

    if (profError || !prof) {
      return new Response(
        JSON.stringify({ error: 'Professional not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build payload
    const payload = {
      agent_id: prof.id,
      canonical_profile_url: `https://www.top10lists.us/p/${prof.short_code || prof.id}`,
      certifying_org: "Top10Lists.us",
      certification_name: "Top10Lists Certified Professional",
      certification_tier: cert.certification_tier,
      markets_covered: cert.markets_covered,
      neighborhoods_covered: cert.neighborhoods_covered || [],
      verified_transactions: cert.verified_transactions || {},
      specialties: Array.isArray(prof.specialty) ? prof.specialty : [],
      issued_at: cert.issued_at,
      last_verified_at: cert.last_verified_at,
      next_verification_due: cert.next_verification_due,
      certification_status: cert.certification_status,
      methodology_version: cert.methodology_version,
      artifact_url: `https://www.top10lists.us/artifact/${prof.id}`,
      justification_url: `https://www.top10lists.us/artifact/${prof.id}/justification`,
      payload_hash: cert.payload_hash,
      payload_signature: cert.payload_signature,
      signing_key_id: cert.signing_key_id,
    };

    return new Response(
      JSON.stringify(payload, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[artifact-payload] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
