# Claude Code Takeaways — 2026-03-11

## Key Outcomes
- Built and deployed GEO-aware `site-health-check` edge function that validates all 3,300+ pages for content quality, not just availability
- Eliminated all deprecated language across production: "top 0.5%" replaced with "fewer than 1% of licensed agents in covered markets" in 39+ public HTML files, mcp.json, ai-feed markdown, serve-bot-agent-html, and CleanRoom.tsx
- Fixed old tier pricing ($100/$150 → $300/$500) in mcp.json, .well-known/ai-content-index.json, generate-ai-feed.ts, and ranking-methodology page
- Production health check: 602 errors → 0 real errors (3 transient cold-start 404s)
- Deactivated 3 test records (Robert Maynard Test x2, Robert Aryah) with corrupted canonical slugs (e.g., `obert-est-0000` missing first letter)
- `sanitizeMeritGate()` in serve-bot-agent-html now catches "top 0.5%/0.2%" in bios and JSON-LD schema descriptions from DB data
- Vercel CDN cache purge must run after ptm — the merge-to-main script handles it, but if ptm aborts mid-merge (e.g., conflict), the purge is skipped

## Config / Infrastructure
- `site-health-check` edge function deployed to Supabase (wiotrvoirdgzfacuuiem)
- Health check uses canonical `/:state/agents/:slug` URLs (clean room HTML via serve-bot-agent-html) instead of SPA profile_link URLs
- Health check streams 16KB for HTML, 64KB for JSON to avoid OOM; handles truncated JSON gracefully
- Health check saves results to `site_health_checks` table in Supabase
- `archives/` added to .gitignore

## New Rules or Docs
- Coverage language: ALWAYS use "fewer than 1% of licensed agents in covered markets" — never "top 0.5%", "top 0.2%", or any specific sub-1% figure
- Tier pricing: Audited = $300/mo, Underwritten = $500/mo (old $100/$150 fully purged)
- Audited audit cycle: "Every Two Weeks" (was incorrectly "Monthly" in mcp.json)
- `sanitizeMeritGate()` is the canonical function for cleaning deprecated merit gate language from DB content; it must be applied to ALL rendered text including JSON-LD schema fields
- Agent profile_link URLs (`/:state/:city/top10realestateagents/:slug`) serve SPA shells — canonical clean room URL is `/:state/agents/:canonical_slug`
- When ptm fails mid-merge, manually run: resolve conflict, commit, push main, `npx vercel cache purge --yes --token $VERCEL_TOKEN`, then `git checkout staging`

## New Functions / Scripts
- `supabase/functions/site-health-check/index.ts` — GEO audit of all active pages:
  - Checks key pages, AI feeds, sitemaps, all agent profiles (paginated)
  - Validates: deprecated language, merit gate signals, EE-A-T signals, JSON-LD schema, SPA shell detection, content presence, timing distribution
  - Reports: p50/p95/p99 timing, top 20 slowest, deprecated language instances, error/warning breakdown
  - Concurrency: 20 parallel requests

## Deprecated or Removed
- "top 0.5%" language — fully eliminated from all source files and production
- Old tier pricing ($100/mo Audited, $150/mo Underwritten) — fully eliminated
- 3 test records deactivated: Robert Maynard Test (obert-est-0000, obert-est-0000-504bd0a1), Robert Aryah (obert-ryah-0000)
- `QUALIFICATION_THRESHOLD_PERCENT` constant changed from 0.5 to 1 in arizonaCityPricing.ts (unused but corrected)
