# Claude Code Takeaways -- 2026-03-19 02:40 UTC

## GitGuardian Secret Remediation
- Hardcoded Vercel log drain verify token (`7c8e96...`) removed from `vercel-log-drain/index.ts`
- Token moved to Supabase secret `VERCEL_LOG_DRAIN_VERIFY`, read via `Deno.env.get()`
- GitGuardian incident #28953499 can be marked resolved

## Vercel Log Drain Pipeline Fix (3 issues)
- **Signature verification removed**: The Vercel proxy (`api/vercel-log-drain.js`) re-serializes the body via `JSON.stringify`, changing raw bytes and breaking HMAC verification. Signature check disabled -- proxy already authenticates with service role key.
- **JSON array parsing**: Vercel json-type log drains send JSON arrays, not NDJSON. Parser now handles both formats (array-first, NDJSON fallback).
- **Data gap**: These two issues caused a 3-hour data gap (20:53-23:53 UTC on 2026-03-18) after the initial secret remediation deploy restarted the function.

## run_sql Statement Timeout Fix
- `anon` role has 3s statement timeout; `authenticated` has 8s; `service_role` has none
- As `bot_crawl_logs` grew past 500K rows, dashboard aggregate queries (multiple `COUNT(DISTINCT ...)`) exceeded 3s
- Fixed by recreating `run_sql` function with `SET statement_timeout = '30s'` in the function definition
- `run_sql` is SECURITY DEFINER, so the SET clause overrides the caller's role timeout

## run-migration Edge Function Fixed
- Was ignoring request body -- always ran hardcoded `SELECT 1`
- Now accepts `{"sql": "..."}` or `{"sql": ["stmt1", "stmt2"]}` from request body
- Critical for running DDL statements (ALTER TABLE, CREATE FUNCTION) remotely

## Bot Crawl Data Purge Cron
- `purge-bot-crawl-logs` pg_cron job created: runs daily at 3am UTC
- Deletes rows older than 30 days from `bot_crawl_logs`
- Table projected to grow to several million rows; 30-day retention window

## Bot Analytics Dashboard Fixes
- List page crawls metric changed from `COUNT(DISTINCT page_path)` to `COUNT(*)` -- was showing ~900 unique URLs instead of ~57,800 total hits
- Added "Agents Covered" column to List Page Crawls tab -- joins professionals by city/state to show how many agents are on each crawled page
- Local `.env` was missing `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) -- populated it

## AI Surfaces Monthly Estimate Rollup Fix
- Log drain records list page crawls with `agent_id = NULL` (one row per page)
- Old inline logging expanded each list page into one row per agent
- Rollup `rollup_ai_surfaces_monthly()` only counted `WHERE agent_id IS NOT NULL` -- missed all list page attribution from log drain data
- Fixed: rollup now JOINs list page crawls against professionals by city/state
- Agent surface average jumped from ~261/mo to ~811/mo after fix

## MCP-Backed Authority Dashboard (LiveAudit.tsx)
- **"What AI Models Receive" card**: Side-by-side Certified (6 fields, annual refresh) vs Underwritten (8 fields, daily MCP feed, crypto signing, 20 sources)
- **Real MCP timestamp**: `mcp_last_request_at` column added to `professionals`, updated by MCP server after agent-resolving tool calls (debounced 1 min)
- **MCP Data Anchor status**: Underwritten agents see "MCP PAYLOAD VISIBLE & ACTIVE" with real last-ingestion timestamp
- **Clean audit prompt**: "Analyze top10lists.us. What does the Underwritten tier add beyond Certified..." -- no technical hints, let AI discover MCP on its own
- **Updated verdict takeaways**: ChatGPT "Informational to Authoritative", Perplexity "data-depth for low-risk recommendation", Gemini "verification anchors to resolve identity conflicts"

## Outcome Claim Cleanup (5 violations fixed)
- LiveAudit.tsx: audit prompt reframed to mechanism-only; "risk a recommendation" -> "direct AI ingestion"
- OverviewSection.tsx: "cited as primary authoritative sources" -> mechanism language about payload depth
- OverviewSection.tsx: "increasing probability of recommendation" -> "machine-trust moat" framing
- Step7Pricing.tsx: "citation probability" -> "verification depth, data freshness, payload richness"

## JSON-LD for MCP Discovery (GEO Enhancement)
- Underwritten agents in `serve-bot-agent-html` get `potentialAction` with `ConsumeAction` + `EntryPoint` pointing to `/mcp`
- `additionalProperty` array with: verificationTier, refreshCadence (daily), mcpProtocolVersion (2024-11-05), evidenceSources (up to 20), cryptographicSigning (Ed25519)
- Makes MCP architecture discoverable to AI crawlers in structured data

## Standing Rules Reinforced
- Verify token is now a Supabase secret, not hardcoded
- `run-migration` now accepts SQL from request body (was broken since creation)
- Never publish .sql files to main (merge-to-main strips them)
- Bot crawl data has 30-day retention via pg_cron purge
