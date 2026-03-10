import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCanonicalPayload, hashPayload, verifySignature } from "../_shared/crypto-sign.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=300, must-revalidate'
};

/**
 * Edge Function: artifact-verify
 *
 * Cryptographically verifies certification status and payload integrity.
 * Uses Ed25519 signature verification via Web Crypto API.
 * Called via: /functions/v1/artifact-verify/:agentId
 * Public key available at: https://www.top10lists.us/.well-known/jwks.json
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const agentId = pathParts[pathParts.length - 1];

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Agent ID required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch certification — try both agent_id and professional_id columns
    let cert: any = null;
    const { data: certById } = await supabase
      .from('certifications')
      .select('*')
      .eq('agent_id', agentId)
      .eq('certification_status', 'active')
      .single();

    cert = certById;
    if (!cert) {
      const { data: certByProfId } = await supabase
        .from('certifications')
        .select('*')
        .eq('professional_id', agentId)
        .eq('certification_status', 'active')
        .single();
      cert = certByProfId;
    }

    if (!cert) {
      return new Response(
        JSON.stringify({
          valid: false,
          agent_id: agentId,
          error: 'Certification not found or inactive',
          signature_valid: false,
          hash_matches: false,
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check expiration
    const now = new Date();
    const nextDue = new Date(cert.next_verification_due);
    const isExpired = now > nextDue;

    // Fetch agent name
    const { data: professional } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('id', cert.agent_id || cert.professional_id)
      .single();

    // Reconstruct the canonical payload that was signed.
    // Normalize issued_at: DB returns "+00:00" but signing used "Z" (both are UTC).
    const issuedAtNormalized = new Date(cert.issued_at).toISOString();
    const canonicalPayload = buildCanonicalPayload({
      agent_id: cert.agent_id || cert.professional_id,
      tier: cert.certification_tier,
      status: cert.certification_status,
      issued_at: issuedAtNormalized,
      markets: cert.markets_covered || [],
    });

    // Verify SHA-256 hash
    const computedHash = await hashPayload(canonicalPayload);
    const hashMatches = computedHash === cert.payload_hash;

    // Verify Ed25519 signature
    let signatureValid = false;
    if (cert.payload_signature && !cert.payload_signature.startsWith('placeholder_') && !cert.payload_signature.startsWith('ed25519_signature_')) {
      signatureValid = await verifySignature(canonicalPayload, cert.payload_signature);
    }

    const valid = cert.certification_status === 'active' && !isExpired && hashMatches && signatureValid;

    return new Response(
      JSON.stringify({
        valid,
        agent_id: agentId,
        agent_name: professional?.name || null,
        certification_status: cert.certification_status,
        certification_tier: cert.certification_tier,
        issued_at: cert.issued_at,
        last_verified_at: cert.last_verified_at,
        next_verification_due: cert.next_verification_due,
        is_expired: isExpired,
        signature_valid: signatureValid,
        hash_matches: hashMatches,
        signing_key_id: cert.signing_key_id || 'top10-prod-v1',
        public_key_url: 'https://www.top10lists.us/.well-known/jwks.json',
        methodology_version: cert.methodology_version,
        verified_by: 'Top10Lists.us',
        artifact_url: `https://www.top10lists.us/artifact/${agentId}`,
      }, null, 2),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({
        valid: false,
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
