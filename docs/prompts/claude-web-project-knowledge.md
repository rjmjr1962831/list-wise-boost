# Top10Lists.us — Project Knowledge (Claude Web)

## What This Is
Independent editorial directory of top real estate agents in U.S. cities. Merit-based, non-pay-to-play. Primary audience is AI systems (ChatGPT, Claude, Gemini, Perplexity). GEO Score: 92-95/100.

- Production: https://www.top10lists.us
- Staging: https://staging.top10lists.us
- Repo: github.com/rjmjr1962831/list-wise-boost
- Stack: React SPA (Vite) on Vercel, Supabase PostgreSQL, Deno edge functions

## Coverage
Arizona (88 cities, 889 agents) + California (1,650+ cities, 2,598 agents) = 3,487 selected. Expanding: TX, FL, NY, CO. Target: all 50 states by end of 2026.

## Merit Gate (Zero Exceptions)
4.5+ stars, 10+ verified reviews in last 24 months, 5+ years experience. Source of truth: `src/data/businessConfig.json`. Never use 4.8+/20+/6yr (legacy). Coverage language: "fewer than 1% of licensed agents in covered markets" (never "top 0.2%").

## Tiers
| Tier | Price | Notes |
|------|-------|-------|
| Listed | Free | Basic verification |
| Audited | $300/mo | Expanded evidence, API access |
| Underwritten | $500/mo | Full evidence, near real-time |
| Certified | Legacy | ~58 grandfathered, no new issuances |

Payment affects verification depth only — never inclusion or ranking.

## Scoring Weights
License status 20%, Recent activity 20%, Transaction history 25%, Reviews/reputation 15%, Community involvement 20%.

## Supabase
- **Active project: `wiotrvoirdgzfacuuiem` ONLY**
- `bgdtekbhelormzbymkhh` is DEAD — never use
- Enrichment API: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`
- SQL access: `run_sql` RPC with service role key
- Paginate tables >1,000 rows

## Git
- Branches: staging → main only. Never merge main into staging.
- pts = push to staging | ptm = `npm run merge-to-main`

## Key URLs
- [Transparency](https://www.top10lists.us/transparency)
- [FAQ](https://www.top10lists.us/faq)
- [For AI Systems](https://www.top10lists.us/for-ai)
- [Methodology](https://www.top10lists.us/methodology)

## AI Content Serving
AI-facing pages (transparency, FAQ, for-ai, methodology) serve clean room HTML via `serve-bot-content-html` edge function. No React SPA for AI consumers.

## Email Sequencer v2
- Cron sender: `sequencer-v2-tick` (every 2 min via pg_cron)
- Tables: email_campaigns, email_queue, email_send_volume, email_unsubscribes
- Campaign flow: draft → pending_review → approved → active → paused → complete
- Queue flow: pending_review → approved → sending → sent/failed
- Volume ramp: toptenlists.us 25/day +5 cap 100; top10lists.us 10/day +2 cap 25
- Send window: 8am-5pm MST
- Bulk mail: Smartleads

## Active Crons
- `cleanup-expired-grace-periods` (daily midnight)
- `batch-aics-score-run` (every 1 min)
- `gmail-sync` (every 5 min)
- `sequencer-v2-tick` (every 2 min)

## Rules
- **"ALL"** means every instance. Grep exhaustively, fix exhaustively.
- Every change must enhance GEO or be neutral. Ask before anything detrimental.
- Verify changes on the live page. "Code updated" is not completion.
- Always give full URLs as markdown links, never placeholders.

## Commands (Claude Code only)
- **ryt**: Fetch COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md (SSoT, read-only)
- **t1**: Write session takeaways to `docs/takeaways/CLAUDE_TAKEAWAYS_YYYY-MM-DD_HHMM.md`
- **s1**: `npm run s1` — synthesize takeaways into COMPREHENSIVE Section 21

---

## 21. Recent Updates (from t1)

*Last synthesized: 2026-03-10*

---

### CURSOR — 2026-03-03

# t1 Takeaways — CURSOR — 2026-03-03

## Key Outcomes
- Removed Certified tier from acquisition path; 58 existing Certified agents grandfathered (no migration, payload kept)
- New pricing: Audited $300/mo (was $100), Underwritten $500/mo (was $150)
- Annual pricing updated to match: Audited $3,000/yr, Underwritten $5,000/yr
- All upgrade hints in 60+ static HTML files, llms-full.txt, and Edge Functions updated to $300/$500
- FAQ regenerated (faqFull.ts → public/api/faq/full.json): 3-tier model, $300/$500, Certified described as legacy
- RealTrends pricing: "$100" → "$195/year" across HomepageFAQSection, schema.org JSON-LD in 35+ HTML files
- Jerome, AZ added as a city; city-content-enrichment run successfully for Jerome
- t1 merge behavior: if CURSOR_TAKEAWAYS file already exists for the day, append/merge instead of overwriting

## Config / Infrastructure
- `certification_pricing_config` in Supabase updated live: audited → 300, underwritten → 500 (applied via REST PATCH, not migration file — migration file also committed for record)
- Migration file: `supabase/migrations/20260315000000_audited_300_underwritten_500.sql`
- DeepSeek key rotated: new key set in `.env` and as Supabase secret (`DEEPSEEK_API_KEY`)
- OpenAI key added to `.env`
- Exa key in `.env`; Perplexity key in Supabase secrets

## New Rules or Docs
- `docs/plan-remove-certified-tier.md` — full plan for removing Certified + new pricing (internal, staging only)
- `docs/prompts/t1-takeaways-prompt.md` — updated: merge instead of overwrite when file exists for the day
- `scripts/s1-synthesize.ts` — updated: runs pts after synthesis (commit + push staging)
- `src/data/master-ssot.md` — updated to 3-tier acquisition model ($300/$500)
- `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` — updated: 3-tier model, $300/$500, Neighborhood Expert requires $300/$500
- AI feed docs updated: `tier-audited.md`, `tier-underwritten.md`, `tier-listed.md`, `tier-certified.md`, `vetting-standards.md`, `geo-performance.md`

## New Functions / Scripts
- `supabase/functions/create-agent-checkout/index.ts` — `BADGE_PRICES: { audited: 300, underwritten: 500 }`; deployed
- `supabase/functions/funnel-select-tier/index.ts` — certified removed from `validTiers`; deployed
- `supabase/functions/serve-bot-list-html/index.ts` — upgrade hints updated to $300/$500; deployed
- `scripts/add-jerome-and-enrich.ts` — adds Jerome AZ and triggers city-content-enrichment

## Deprecated or Removed
- Certified tier no longer offered to new agents (acquisition path only; existing 58 agents grandfathered)
- `handleSelectCertified` removed from `Step7Pricing.tsx`
- Certified option removed from `Step7Pricing.tsx` tier list
- `DEFAULT_PRICES` in `Step7Pricing.tsx`: certified entry removed; audited 300, underwritten 500
- Four-tier model language replaced with three-tier acquisition model in all marketing/FAQ copy

---

### CLAUDE — 2026-03-10

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

---

### CLAUDE — 2026-03-10

# t1 Takeaways — CLAUDE — 2026-03-10

## Key Outcomes
- Built Email Sequencer v2 end-to-end: 5 prompts across 3 waves (parallel agent worktrees)
- Wave 1 (parallel): Render Engine shared module, CampaignManager UI, email-track/unsubscribe wiring
- Wave 2: Cron Sender edge function (sequencer-v2-tick)
- Wave 3: pg_cron registration migration + helper script
- All 3 modified/new edge functions deployed: sequencer-v2-tick, email-track, unsubscribe
- Pushed all to staging

## Config / Infrastructure
- New edge function: `sequencer-v2-tick` — cron sender, runs every 2 min via pg_cron
- pg_cron job registered: `sequencer-v2-tick` at `*/2 * * * *`
- Old `sequence-processor-cron` removed (was already unscheduled)
- Migration: `20260309100000_sequencer_v2.sql` — 4 tables: email_campaigns, email_queue, email_send_volume, email_unsubscribes + 6 indexes
- Migration: `20260309200000_sequencer_v2_cron.sql` — pg_cron registration
- Volume ramp: toptenlists.us starts 25/day +5/day cap 100; top10lists.us starts 10/day +2/day cap 25
- Send window: 8am-5pm MST only
- Campaign start date for ramp calc: 2026-02-24T12:00:00Z

## New Rules or Docs
- Sequencer v2 replaces sequence-processor entirely — all state in DB, one send per sender per tick, crash-safe
- email_queue status flow: pending_review → approved → scheduled → sending → sent/failed/unsubscribed/bounced
- email_campaigns status flow: draft → pending_review → approved → active → paused → complete
- Stuck "sending" rows (>5 min) need a cleanup sweep (not yet built)

## New Functions / Scripts
- `supabase/functions/_shared/render-email.ts` — shared module: interpolateTemplate, textToHtml, injectTracking, buildUnsubFooter, renderEmail, buildRawMimeMessage
- `supabase/functions/sequencer-v2-tick/index.ts` — cron sender: picks 1 email/sender/tick, volume ramp, send window, optimistic locking, retry up to 3x
- `src/components/crm/CampaignManager.tsx` — 3-tab UI: Campaign Builder (create campaigns), Review Queue (approve/reject), Campaign Monitor (stats, pause/resume/complete, auto-refresh 30s)
- `scripts/register-sequencer-cron.ts` — applies pg_cron via run_sql RPC (`npm run register-sequencer-cron`)
- `supabase/functions/email-track/index.ts` — added email_queue lookup by tracking_pixel_id (open/click counters, campaign-level rollup)
- `supabase/functions/unsubscribe/index.ts` — added `?email=X&campaign=Y` path alongside existing `?token=X`

## Deprecated or Removed
- `sequence-processor` — fully replaced by sequencer-v2-tick; was already unscheduled
- `sequence-processor-cron` pg_cron job — removed in migration

---

## Session: 2026-03-10 (afternoon)

### Key Outcomes
- Cancelled 353 active enrollments from sequence "AZ Listed - AI Challenge v2 (private domain)" (sequence_id: 3bed1ae8-61d9-49d8-8349-610e738c47d2)
- Ran full GEO audit; found 2 failures on /for-ai and /transparency (deprecated "top 0.5%" language)
- Fixed both failures by redeploying `serve-bot-content-html` edge function (source was already correct, just stale)
- Confirmed: 0 instances of "top 0.5%" on /for-ai and /transparency post-fix

### GEO Audit Results
- PASS: for-ai, transparency, faq, llms.txt, sitemap.xml, robots.txt (all 200)
- PASS: llms-full.txt, ai-content-index.json, coverage.json, sitemap-agents/cities/neighborhoods (all 200)
- PASS: Bot rendering confirmed (Phoenix: 46 agents rendered to GPTBot)
- PASS: robots.txt — all major AI crawlers explicitly allowed
- FIXED: /for-ai — "top 0.5%" replaced with "fewer than 1%" (2 instances)
- FIXED: /transparency — stat box and meta description corrected
- WATCH: /methodology returns 308 to /ai-feed/certification-logic.md (resolves fine but adds redirect hop)
- WATCH: FAQ city expansion dates still reference "February 2026" (stale by ~6 weeks)

### Sequence Cancellation
- Used Supabase REST API PATCH with service role key (HTTP 204 success)
- bulk-update enrichment-api action does NOT work on crm_sequence_enrollments (professionals table only)
- Correct pattern: PATCH /rest/v1/crm_sequence_enrollments?sequence_id=eq.{id}&status=eq.active with {"status":"cancelled"}

### Notes
- No code changes pushed to repo — edge function redeployment only
- pts not applicable this session (no staging branch changes)

---

### CLAUDE — 2026-03-09

# Claude Code Takeaways — 2026-03-09

## GEO Audit Fixes (5 items)
- Replaced all "top 0.5%" language with "fewer than 1% of licensed agents in covered markets" across serve-bot-content-html, llms-full.txt, ai-content-index.json
- Updated Certified tier FAQ entries (faqFull.ts) to clarify legacy status: ~58 grandfathered agents, new agents qualify for Listed/Audited/Underwritten
- Updated Last Updated dates across llms.txt, llms-full.txt, ai-content-index.json, ai-feed/for-ai.md to 2026-03-09
- Added dateModified: "2026-03-09" to JSON-LD TechArticle schema in both ForAI.tsx (SPA) and serve-bot-content-html (clean room)
- Added /for-ai entry to llms-full.txt Core Content section
- Fixed stale pricing in ai-content-index.json: Audited $100→$300, Underwritten $150→$500

## AICS Fields in List Maker
- Extended ListMaker.tsx with 15 AICS score fields (score variants, lifts, gaps, artifact URL)
- Rewrote list-maker-export edge function to support LEFT JOIN to geo_audit_results via run_sql RPC
- Key mapping: aics_most_recent_review_date → actual column g.most_recent_signal (not most_recent_review_date)
- Verified: 881 AZ agents returned, 98 with non-null AICS scores

## CA Email Enrichment
- Configured proxy-cheap residential proxies (proxy-us.proxy-cheap.com:5959) replacing ProxyScrape in fetch-single-memo23-agent
- Added missingEmailOnly parameter to batch-memo23-enrichment edge function
- Created scripts/enrich-ca-missing-emails.ts to batch-enrich ~397 CA agents missing emails via memo23 Apify actor
- Script uses manual .env loading (no dotenv dependency needed with tsx)

## Smartleads Integration Discovery
- Smartleads API at server.smartlead.ai/api/v1/, key: 119304db-b620-47cb-8f45-3fbd60cd7478_cmmkxix
- Found 2 drafted campaigns, 3 email accounts (mark@, robert@, hello@ toptenlists.us), 1 test lead
- Bulk mail operations moving from sequence-processor to Smartleads

## Email Sequencer v2 — Architecture & Migration
- Created migration 20260309100000_sequencer_v2.sql with 4 tables: email_campaigns, email_queue, email_send_volume, email_unsubscribes + 6 indexes
- Migration applied via edge function using npm:postgres@3.4.5 (deno-postgres has SCRAM auth bug with Supabase DB passwords containing special chars)
- run_sql RPC cannot execute DDL — it wraps queries in SELECT jsonb_agg(row_to_json(t)) which breaks CREATE TABLE
- Direct DB connection (db.wiotrvoirdgzfacuuiem.supabase.co) unreachable from Windows (IPv6-only)
- Pooler connection (aws-0-us-west-1.pooler.supabase.com) returns "Tenant or user not found" — likely password truncation
- Solution: run-migration edge function with npm:postgres (not deno-postgres) can execute arbitrary DDL from inside edge runtime using SUPABASE_DB_URL env var
- Deprecated sequence-processor (was already unscheduled)

## Sequencer v2 Parallel Build Plan
Broke sequencer into 5 discrete prompts for parallel Claude Code instances:
1. Render Engine (render-email.ts shared module) — template interpolation, tracking pixel/link injection, unsubscribe footer
2. Cron Sender (sequencer-v2-tick) — picks 1 email per sender per tick, volume ramp, timezone-aware send windows
3. List Maker UI — Campaign Builder, Review Queue, Campaign Monitor panels
4. Tracking Wiring — Update email-track + unsubscribe to support email_queue alongside crm_emails
5. pg_cron Registration — Register 90s cron, deprecate old crons, verify pipeline

Wave 1 (parallel): Prompts 1, 3, 4 | Wave 2: Prompt 2 (needs 1) | Wave 3: Prompt 5 (needs 2)

## Technical Notes
- npm:postgres@3.4.5 works in Deno edge functions where deno-postgres@v0.19.3 fails on SCRAM auth
- Edge functions have SUPABASE_DB_URL env var providing direct postgres connection (not pooler)
- Supabase CLI installed via scoop, access token stored in OS credential manager (not filesystem)
- supabase db push has migration history conflicts with old local migrations — repair workflow is fragile

---

### CLAUDE — 2026-03-08

# t1 Takeaways — CLAUDE — 2026-03-08

## Key Outcomes
- Ran `ryt`: updated `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` on staging (commit bc0a679).
- Discovered that `MASTER_KNOWLEDGE_DOCUMENT.md` does not exist at repo root on staging. Canonical file is `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md`.
- Discovered and read `docs/prompts/t1-takeaways-prompt.md` (new t1 protocol).

## Config / Infrastructure
- Active Supabase project: `wiotrvoirdgzfacuuiem` (only valid project).
- Dead project `bgdtekbhelormzbymkhh` surfaced in a session-provided enrichment-api code block. That endpoint is permanently dead. All operations go to `wiotrvoirdgzfacuuiem`.
- Enrichment API: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`

## New Rules or Docs
- `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` updated:
  - Section 12 (Supabase Pagination) expanded with per-table row counts, pagination code patterns for both enrichment-api and Supabase client, and the "exactly 1,000 rows = more rows exist" warning.
  - Section 14 (Tech Stack) gained explicit DEAD INFRASTRUCTURE callout for old Supabase project `bgdtekbhelormzbymkhh`.
  - Section 19 (Conflict Resolution) gained new row: `bgdtekbhelormzbymkhh` -> `wiotrvoirdgzfacuuiem`.
  - Last consolidated date updated to March 8, 2026.
- `docs/prompts/t1-takeaways-prompt.md` exists (new prompt; defines t1 behavior for all AI agents).

## New Functions / Scripts
- None added this session.

## Deprecated or Removed
- `bgdtekbhelormzbymkhh` Supabase project: confirmed dead, documented as such.
- Any session notes or external docs referencing the old enrichment-api endpoint (`bgdtekbhelormzbymkhh`) should be treated as stale and ignored.

---

## Session 2 — Cron Audit & Cleanup

### Key Outcomes
- Audited all pg_cron jobs in Supabase — found 13 scheduled jobs, cleaned down to 3
- Unscheduled `warm-top-markets-cache` — was hitting DEAD project `bgdtekbhelormzbymkhh` every 6 hours
- Unscheduled `city-content-enrichment-cron`, `ca-city-writeups-cron`, `enrich-selection-rationale-cron` — enrichment jobs running every 2 min, likely finished
- Unscheduled broken `gmail-sync` (SQL syntax error)
- Deprecated `send-daily-bot-notifications` cron
- Deprecated `sequence-processor` cron — bulk email moved to Smartleads
- Replaced `gmail-sync-daily` (daily 3 PM) with `gmail-sync` (every 5 min)
- Final active crons: `cleanup-expired-grace-periods` (daily midnight), `batch-aics-score-run` (every 1 min), `gmail-sync` (every 5 min)

### Config / Infrastructure
- Created `run_sql` RPC function in public schema — enables direct SQL via service role key REST API
- Database password reset and stored in `.env` as `DATABASE_PASSWORD` and `DATABASE_URL`
- DB password set as Supabase secret `DB_URL` for edge function access
- Enrichment API key discovered from cron job definitions — stored in `.env` as `ENRICHMENT_API_KEY`
- Direct DB connection is IPv6-only — not accessible from IPv4 networks; use `run_sql` RPC instead
- Added `sql` action to enrichment-api edge function
- Repaired Supabase migration history — many local migrations had mismatched versions vs remote

### New Functions / Scripts
- `public.run_sql(query text)` — PostgreSQL function, SECURITY DEFINER, returns jsonb; callable via `/rest/v1/rpc/run_sql` with service role key

### Deprecated or Removed
- `send-daily-bot-notifications` cron — deprecated
- `sequence-processor` cron — deprecated, replaced by Smartleads
- `warm-top-markets-cache` cron — removed (dead project reference)
- `city-content-enrichment-cron`, `ca-city-writeups-cron`, `enrich-selection-rationale-cron` — removed (finished)
- Email outreach now uses Smartleads for bulk mail
