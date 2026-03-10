import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Edge Function: signing-keys
 *
 * Serves the JWKS (JSON Web Key Set) containing the Ed25519 public key
 * used to verify Top10Lists.us certification signatures.
 *
 * Routed via: https://www.top10lists.us/.well-known/jwks.json
 *
 * Third parties can use this public key to independently verify that
 * a certification artifact was genuinely signed by Top10Lists.us.
 */
const JWKS = {
  keys: [
    {
      kty: "OKP",
      crv: "Ed25519",
      x: "qI6ibI5eqwA0agoJbiVAGitITwwr9MbeQzPQXn7zOPg",
      kid: "top10-prod-v1",
      use: "sig",
      alg: "EdDSA",
    },
  ],
};

const body = JSON.stringify(JWKS, null, 2);

serve(() => {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
});
