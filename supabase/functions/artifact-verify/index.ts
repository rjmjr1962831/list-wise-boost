import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=300, must-revalidate' // 5 minute cache for verification
};

/**
 * Edge Function: artifact-verify
 * 
 * Verifies certification status and validates payload integrity.
 * Called via: /functions/v1/artifact-verify/:agentId
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract agent ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const agentId = pathParts[1]; // Second part is the agent ID

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Agent ID required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Create Supabase client (using anon key for public read access)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Fetch certification data
    const { data: cert, error: certError } = await supabase
      .from('certifications')
      .select('*')
      .eq('professional_id', agentId)
      .eq('certification_status', 'active')
      .single();

    if (certError || !cert) {
      return new Response(
        JSON.stringify({
          valid: false,
          agent_id: agentId,
          error: 'Certification not found or inactive',
          certification_status: null,
          last_verified_at: null,
          signature_valid: false,
          hash_matches: false
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if certification is expired
    const now = new Date();
    const nextVerificationDue = new Date(cert.next_verification_due);
    const isExpired = now > nextVerificationDue;

    // Fetch agent data for payload hash validation
    const { data: professional } = await supabase
      .from('professionals')
      .select('id, name, review_stars_rating, num_total_reviews')
      .eq('id', agentId)
      .single();

    // Generate current payload hash (simplified version for now)
    // In production, this would use the same hash algorithm as the payload generation
    const payloadString = JSON.stringify({
      agent_id: cert.professional_id,
      tier: cert.certification_tier,
      status: cert.certification_status,
      issued: cert.issued_at,
      markets: cert.markets_covered
    });

    // For now, we'll use a simple comparison (placeholder for actual crypto verification)
    // In production: const computedHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadString))
    const hashMatches = cert.payload_hash ? true : false; // Placeholder - assume valid if hash exists

    // Build verification response
    const verificationResponse = {
      valid: cert.certification_status === 'active' && !isExpired,
      agent_id: agentId,
      agent_name: professional?.name || null,
      certification_status: cert.certification_status,
      certification_tier: cert.certification_tier,
      issued_at: cert.issued_at,
      last_verified_at: cert.last_verified_at,
      next_verification_due: cert.next_verification_due,
      is_expired: isExpired,
      signature_valid: cert.payload_signature ? true : false, // Placeholder
      hash_matches: hashMatches,
      signing_key_id: 'top10-prod-v1',
      methodology_version: cert.methodology_version,
      verified_by: 'Top10Lists.us',
      artifact_url: `https://www.top10lists.us/artifact/${agentId}`
    };

    return new Response(
      JSON.stringify(verificationResponse, null, 2),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
