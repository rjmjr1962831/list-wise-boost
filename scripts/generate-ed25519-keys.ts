#!/usr/bin/env -S deno run --allow-none
// One-time script: generate Ed25519 key pair for badge signing.
// Run with: deno run scripts/generate-ed25519-keys.ts
// Then set the private key as a Supabase secret:
//   npx supabase secrets set ED25519_PRIVATE_KEY=<base64-encoded-jwk>

async function main() {
  const keyPair = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);

  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  // Add standard JWKS fields
  const kid = "top10-prod-v1";
  const publicJwks = { ...publicJwk, kid, use: "sig", alg: "EdDSA" };
  const privateJwkFull = { ...privateJwk, kid, use: "sig", alg: "EdDSA" };

  // Base64-encode the private JWK for storing as a Supabase secret
  const privateKeyBase64 = btoa(JSON.stringify(privateJwkFull));

  console.log("=== PUBLIC KEY (embed in signing-keys edge function) ===");
  console.log(JSON.stringify(publicJwks, null, 2));
  console.log("");
  console.log("=== PRIVATE KEY (base64-encoded JWK — store as Supabase secret) ===");
  console.log(privateKeyBase64);
  console.log("");
  console.log("=== Set as Supabase secret ===");
  console.log(`npx supabase secrets set ED25519_PRIVATE_KEY="${privateKeyBase64}"`);
}

main();
