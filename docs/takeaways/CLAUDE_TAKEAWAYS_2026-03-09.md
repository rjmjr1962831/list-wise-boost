# Claude Code Takeaways — 2026-03-09

## GEO Audit Fixes (5 items)
- Replaced all "top 0.5%" language with "fewer than 1% of licensed agents in covered markets" across serve-bot-content-html, llms-full.txt, ai-content-index.json
- Updated Certified tier FAQ entries (faqFull.ts) to clarify legacy status: ~58 grandfathered agents, new agents qualify for Listed/Audited/Underwritten
- Updated Last Updated dates across llms.txt, llms-full.txt, ai-content-index.json, ai-feed/for-ai.md to 2026-03-09
- Added dateModified: "2026-03-09" to JSON-LD TechArticle schema in both ForAI.tsx (SPA) and serve-bot-content-html (clean room)
- Added /for-ai entry to llms-full.txt Core Content section
- Fixed stale pricing in ai-content-index.json: Audited $100→$300, Underwritten $150→$500

## AIFS Fields in List Maker
- Extended ListMaker.tsx with 15 AIFS score fields (score variants, lifts, gaps, artifact URL)
- Rewrote list-maker-export edge function to support LEFT JOIN to geo_audit_results via run_sql RPC
- Key mapping: aics_most_recent_review_date → actual column g.most_recent_signal (not most_recent_review_date)
- Verified: 881 AZ agents returned, 98 with non-null AIFS scores

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
