// Shared cryptographic signing module for badge/certification operations.
// Uses Ed25519 via Web Crypto API (supported natively in Deno).

/** Public key for signature verification — safe to embed, not secret. */
export const PUBLIC_KEY_JWK: JsonWebKey = {
  kty: "OKP",
  crv: "Ed25519",
  x: "qI6ibI5eqwA0agoJbiVAGitITwwr9MbeQzPQXn7zOPg",
  kid: "top10-prod-v1",
  use: "sig",
  alg: "EdDSA",
};

/** Fields that constitute the canonical signed payload. */
export interface CertPayloadFields {
  agent_id: string;
  tier: string;
  status: string;
  issued_at: string;
  markets: string[];
}

/**
 * Build a deterministic JSON string from certification fields.
 * Keys are sorted to ensure byte-identical output across sign and verify.
 */
export function buildCanonicalPayload(fields: CertPayloadFields): string {
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(fields).sort()) {
    ordered[key] = (fields as Record<string, unknown>)[key];
  }
  return JSON.stringify(ordered);
}

/** SHA-256 hex digest of a string. */
export async function hashPayload(payloadString: string): Promise<string> {
  const data = new TextEncoder().encode(payloadString);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sign a payload string with the Ed25519 private key from env.
 * Returns a base64url-encoded signature.
 */
export async function signPayload(payloadString: string): Promise<string> {
  const privKeyB64 = Deno.env.get("ED25519_PRIVATE_KEY");
  if (!privKeyB64) {
    throw new Error("ED25519_PRIVATE_KEY not set — cannot sign payload");
  }

  const jwk: JsonWebKey = JSON.parse(atob(privKeyB64));
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    "Ed25519",
    false,
    ["sign"]
  );

  const data = new TextEncoder().encode(payloadString);
  const sig = await crypto.subtle.sign("Ed25519", privateKey, data);
  return base64urlEncode(new Uint8Array(sig));
}

/**
 * Verify an Ed25519 signature against a payload string.
 */
export async function verifySignature(
  payloadString: string,
  signatureBase64url: string
): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      PUBLIC_KEY_JWK,
      "Ed25519",
      false,
      ["verify"]
    );

    const sig = base64urlDecode(signatureBase64url);
    const data = new TextEncoder().encode(payloadString);
    return await crypto.subtle.verify("Ed25519", publicKey, sig, data);
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

function base64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
