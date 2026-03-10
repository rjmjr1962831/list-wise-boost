# t1 Takeaways — CLAUDE — 2026-03-10

## Key Outcomes
- Cataloged all 306 Supabase edge functions with descriptions, categories, and status
- Identified and marked 90 functions as DEPRECATED (Pipedrive, HubSpot, Cloudflare, Instantly, old Apify scrapers, one-time backfills, test utilities)
- Changed Audited tier certification refresh cadence from every_two_weeks (14 days) to monthly (30 days) — live DB + migration file
- Removed hardcoded Crossmint API key from test-crossmint (GitGuardian incident #26952593) — key needs revocation on Crossmint dashboard
- Built full Ed25519 cryptographic signing pipeline for badge certifications — end-to-end tested: signature_valid=true, hash_matches=true
- Updated s1 instruction in MEMORY.md: after s1, copy Section 21 into docs/prompts/claude-web-project-knowledge.md

## Config / Infrastructure
- `ED25519_PRIVATE_KEY` — new Supabase secret (base64-encoded JWK, Ed25519 key pair)
- Audited refresh_cadence: `every_two_weeks` → `monthly` in certification_pricing_config (live DB updated via REST PATCH)
- certifications table uses `professional_id` column (not `agent_id` — generate-certification had a bug)
- certifications tier constraint: only certified/audited/underwritten (not listed — listed is free, no cert)
- generate-certification: `professionals` table has no `rating` column (only `review_stars_rating`)
- Pipedrive CRM: confirmed dead by Robert
- HubSpot CRM: confirmed dead by Robert
- warm-cache / pre-render-*: confirmed dead by Robert
- daily-certification-update: kept (still needed for 58 grandfathered Certified agents)

## New Rules or Docs
- memory/deprecated-edge-functions.md — full categorized list of 90 deprecated functions
- MEMORY.md updated: dead CRMs (Pipedrive, HubSpot), dead infra (Cloudflare, Instantly, warm-cache, pre-render)

## New Functions / Scripts
- `supabase/functions/_shared/crypto-sign.ts` — shared module: buildCanonicalPayload, hashPayload (SHA-256), signPayload (Ed25519), verifySignature; public key embedded
- `supabase/functions/signing-keys/index.ts` — serves JWKS at /.well-known/jwks.json with Ed25519 public key (kid: top10-prod-v1)
- `scripts/generate-ed25519-keys.ts` — one-time key pair generation script (Node.js compatible)
- `vercel.json` — added rewrite: `/.well-known/jwks.json` → signing-keys edge function
- `generate-certification/index.ts` — now uses real Ed25519 signing (was placeholder); fixed professional_id column, removed nonexistent columns
- `artifact-verify/index.ts` — now does real SHA-256 hash comparison + Ed25519 signature verification (was truthy check); normalizes timestamp format (Z vs +00:00)

## Deprecated or Removed
- 90 edge functions marked deprecated across 7 categories:
  - Pipedrive (21): all sync/webhook/field/label functions — CRM is dead
  - HubSpot (6): all sync/webhook functions — CRM is dead
  - Cloudflare (5): logpull, logpush, purge-cache, update-worker, fetch-worker
  - Instantly (4): sync, webhook, crm-to-instantly, bulk-sync
  - Old Apify scrapers (16): replaced by Firecrawl pipeline
  - One-time backfill/setup (18): completed operations
  - Superseded (8): warm-cache, warm-top-markets, pre-render-*, purge-worker-cache, send-bot-notifications, generate-city-content, run-state-pipeline-cron
  - Test functions (11): all test-* utilities
- Placeholder crypto in generate-certification and artifact-verify replaced with real Ed25519
- Hardcoded Crossmint API key removed from test-crossmint/index.ts
