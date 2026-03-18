# Claude Code Takeaways -- 2026-03-18 22:15 UTC

## Key Outcomes

### GEO Audit Fixes (Gemini + Perplexity findings)
- Deleted 105 stale static HTML files in `public/` that were serving deprecated 4.8+/20+ merit gate values, overriding edge function rewrites. Vercel serves static files before evaluating rewrites.
- Added build-time guard (`scripts/guard-stale-html.mjs`) that fails the build if stale HTML reappears in guarded directories (`public/arizona/*/`, `public/california/*/`, `public/clean-room/`)
- Added 301 redirects for non-canonical URL patterns (`best-real-estate-agents`, `best-realtors`, `top-real-estate-agents`) to canonical `top10realestateagents`
- Tightened cache headers on all GEO pages from `max-age=300, stale-while-revalidate=3600` to `max-age=0, s-maxage=60, stale-while-revalidate=30`
- Fixed edge function cache headers from `max-age=86400` (24h) to `max-age=0, s-maxage=60` on both `serve-bot-list-html` and `serve-bot-agent-html`

### Data Freshness Notice on All AI Pages
- Added "Data Freshness Notice" to 18 files: `for-ai.txt`, `mcp.json`, `ai-content-index.json`, all 14 `ai-feed/*.md` files, and MCP server `get_methodology` response
- Notice tells AI crawlers: third-party press citing older gate values is deprecated, agent totals change daily, this domain is source of truth

### MCP Server References Added
- MCP server at `/mcp` was undiscoverable -- no AI page mentioned it
- Added endpoint, protocol, 5-tool table to: `llms.txt`, `for-ai.txt`, `ai-feed/for-ai.md`, `serve-bot-content-html` /for-ai page

### Listed Tier GEO Fix
- Listed agents now show years experience and career transaction count on city and profile pages (previously hidden behind `!isListed` checks)
- Replaced "data hiding" upgrade hints with verification summaries: "Transaction history: verified. Community involvement: verified." instead of "become visible at higher tiers"

### License Number Backfill (133 -> 12 remaining)
- 121 agents fixed (91%) across 5 rounds of matching:
  - Round 1: 69 exact name matches vs AZ license CSV (221K records)
  - Round 2: 18 nickname expansions (Bill->William, Bob->Robert, etc.) + team leaders
  - Round 3: 11 team designated brokers via Serper + AZRE.gov
  - Round 4: 5 license numbers from Serper (realtor.com, BBB, AZRE snippets)
  - Round 5: 6 LinkedIn-confirmed + city-disambiguated multi-matches + CA DRE
- Imported 210K AZ licenses into `state_licenses` table (was missing -- only had CA/FL/TX)
- Built `backfill-license-numbers` edge function for automated post-enrichment matching
- Wired `batch-memo23-enrichment` to auto-trigger `backfill-license-numbers` when batch completes
- Built local script `npm run backfill:licenses` (with `--dry-run`)
- Deactivated: Sarah Park (test agent, 555 number), Forrest Coleman-Weisz (Wyoming, not AZ/CA)
- 12 agents remain for manual AZRE/DRE lookup

### AI Surfaces Monthly Estimate
- New column `professionals.ai_surfaces_monthly_est` -- extrapolated from bot crawl data to 30-day estimate
- Counts ALL bot crawls per agent (Googlebot feeds Gemini, Bingbot feeds Copilot, etc.)
- Daily cron `rollup-ai-surfaces-daily` at 5am UTC
- Initial rollup: 3,198 agents, median 261/mo, max 3,551/mo
- Added `page_bot_hits` table + Vercel Edge Middleware for pre-cache bot logging (deployed to production)
- Updated rollup function to use `page_bot_hits` when available, fallback to `bot_crawl_logs`
- Investigation: middleware doesn't run on CDN cache HITs on Vercel. Log drains (Pro plan) are the correct solution for full coverage. Robert is enabling log drain.

### Funnel Redesign
- Removed header/footer/chatbot from all funnel and dashboard pages (`/funnel/*`, `/dashboard/*`, `/agent/dashboard`)
- Step 1 (Intro): Complete rebuild
  - Dark theme (slate-950 gradient)
  - Personalized: "{FirstName}, AI is already seeing you."
  - Three stat boxes: AI Surfaces/Month, Your AIFS Today (with naming frequency + endorsement language), AIFS Potential (underwritten projection)
  - AIFS explainer: "measures verified, citable evidence across the entire internet"
  - "No other site on the internet can lift your AIFS as much as we do."
  - Score-band-specific messaging (Invisible/Discoverable/Citable/Recommended/Authoritative)
  - CTA: "Let's Verify Your Profile"
- Step 2 (Contact Info): Dark theme, phone number publish toggles changed from eye icons to Public Yes/No sliders
- Step 3 (Credentials): Dark theme with transparent cards
- Step 4 (Professional Details): Dark theme, social media fields with domain-specific placeholder URLs (linkedin.com/in/yourname, etc.)
- Step 5 (Final Review): Dark theme, added Volume (3yr) and Specialties to review request flow
- Step 6 (Cities): Dark theme, BundlesPanel component fully rethemed
- Step 7 (Neighborhoods): Complete rebuild with "Smart Suggestions Flow"
  - Search anchor neighborhood -> nearby pills auto-populate from `nearby_neighborhoods` DB field
  - 100% coverage: AZ 2,669 + CA 7,475 neighborhoods all have precomputed nearby data
  - Pills show neighborhood name + distance in miles
  - "Search a different area" reset link
- Step 8 (Pricing): Rebuilt per "Bottom Line Up Front" spec
  - Deleted: green congratulations banner, AIFS gauge card, Citation Value Calculator preview, "Show Me the ROI" button
  - Added: micro-summary header with agent name + current AIFS score
  - Dollar lift from Certified shown at top of each tier card (same emerald style)
  - AIFS Score + Est. ROI side by side in each card
  - Certified ROI shows infinity symbol (free tier)
  - ROI calculator syncs baseline AIFS from actual agent data
  - Closed deals rounded up to whole numbers

## Config / Infrastructure
- `page_bot_hits` table created in Supabase for pre-cache bot logging
- `rollup-ai-surfaces-daily` pg_cron scheduled at 5am UTC
- `rollup_ai_surfaces_monthly()` DB function created and updated
- `professionals.ai_surfaces_monthly_est` and `ai_surfaces_updated_at` columns added
- 210K AZ licenses imported into `state_licenses` table
- Edge functions deployed: `backfill-license-numbers`, `batch-memo23-enrichment`, `serve-bot-list-html`, `serve-bot-agent-html`, `serve-bot-content-html`, `serve-bot-crawl-stats-html`
- Vercel Edge Middleware updated with bot hit logging
- `vercel.json`: added 4 non-canonical URL redirects, tightened cache headers

## New Rules or Docs
- Build-time guard: `scripts/guard-stale-html.mjs` prevents stale HTML from reaching production
- Edge function cache: `s-maxage=60` on all GEO pages (was 86400 on edge functions, 300 on proxy)
- Funnel pages are chromeless (no header/footer/chatbot)
- Listed agents show transaction count and verification summary on all pages
- AIFS language: "measures verified evidence" not "measures likelihood of citation"

## New Functions / Scripts
- `scripts/guard-stale-html.mjs` -- build-time guard against stale HTML
- `scripts/backfill-license-numbers.mjs` -- local license matching script (`npm run backfill:licenses`)
- `supabase/functions/backfill-license-numbers/index.ts` -- edge function for automated license matching
- `supabase/migrations/20260318000000_ai_surfaces_monthly_est.sql` -- AI surfaces column + rollup function + cron

## Deprecated or Removed
- 105 stale static HTML files deleted (94 clean-room, 10 AZ city/neighborhood, 1 ai-compare)
- Old `backfill-license-numbers` edge function (Firecrawl-based) replaced with name-matching approach
- `max-age=86400` cache headers on edge functions replaced with `s-maxage=60`
- Sarah Park test agent deactivated
- Forrest Coleman-Weisz (Wyoming) deactivated
- Green "Great work!" congratulations banner removed from funnel Step 8
- AIFS gauge card removed from funnel Step 8
- Citation Value Calculator preview removed from funnel Step 8
- "Show Me the ROI" floating button removed from funnel Step 8
