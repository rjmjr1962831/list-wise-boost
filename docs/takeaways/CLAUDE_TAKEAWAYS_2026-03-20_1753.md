# Claude Takeaways — 2026-03-20 17:53 UTC

## Session Summary

Large codebase-wide rename and scoring weight update, founder profile intake system, and site-wide header/footer integration.

## Changes Made

### 1. Rename "community involvement" → "community" (codebase-wide)
- Renamed across ~90 files: all variants (camelCase, snake_case, SCREAMING_CASE, prose)
- Updated in: businessConfig.json, methodology-schema.json, all HTML pages, all edge functions, all React components, FAQ schema, AI feeds, docs
- Three audit passes to catch stragglers: MethodologyPage.tsx (6 issues), AICompare.tsx (old 7-factor model), homepageSchema.ts (stale percentages), serve-bot-content-html meta description

### 2. Scoring Weight Rebalancing
- **Consumer-facing (unchanged):** Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education 10%
- **Internal scoring (updated):** License Status 20%, Recent Activity 20%, Transaction History 20% (was 25%), Reviews/Reputation 15% (was 20%), Community 25% (was 20%)
- Fixed stale FAQ entries using old "press (15%), transactions (15%)" → correct consumer 5-factor model
- All weights verified to sum to 100%/1.00

### 3. Founder Profile Intake Form
- Created `public/admin/founder-intake.html` — staging-only admin page at `/admin/founder-intake`
- Tabs for Robert and Mark with pre-filled data from `public/ai-feed/founder.md`
- Dynamic add/remove for: degrees, certifications, awards, previous roles, publications, speaking, press, affiliations, verifiable claims
- Verifiable claims upgraded to `{ text, sourceUrl }` objects — verification URLs pre-filled where available (SEC EDGAR, FTC, Delaware corp search, Business Insider, Truman Foundation)
- Awards & Honors field added (Distinguished Military Graduate, Magna Cum Laude, Truman Scholar, WSJ Award)
- Saves to Supabase `marketing_content` table (page='founders', section='profiles', key='robert'|'mark', value=JSON string)
- Fixed column name mismatch: table uses `value` (text) + `type`, not `content` + `content_type`
- Uses service role key for writes (page is staging-only, blocked on production by Vercel host redirects)

### 4. Founder Profiles in MCP Server + Live Founder HTML
- New `get_founder_profiles` MCP tool queries `marketing_content` live, falls back to hardcoded defaults
- `serve-bot-founder-html` now fetches live profiles, enriches JSON-LD schemas, renders claims with verification links
- `X-Data-Source: live|hardcoded` header for debugging

### 5. Site-Wide Header/Footer on Clean-Room Pages
- Created `supabase/functions/_shared/site-chrome.ts` — shared header/footer matching React components
- Integrated into 6 edge functions (13 HTML documents): agent, content (5 pages), crawl-stats, founder, list, state
- All 7 edge functions deployed to Supabase

## Deployments
- Staging: multiple pushes (latest: 1e4feaec)
- Main: merged via `npm run merge-to-main` (f22dcf60), Vercel cache purged, 40 URLs IndexNow'd
- Edge functions deployed: serve-bot-agent-html, serve-bot-content-html, serve-bot-crawl-stats-html, serve-bot-founder-html, serve-bot-list-html, serve-bot-state-html, mcp-server

## Technical Notes
- `marketing_content` table schema: id, page, section, key, type (text), value (text), metadata, active, created_at, updated_at
- RLS on `marketing_content`: SELECT open to all, writes require service_role
- `run_sql` RPC is SELECT-only; cannot execute DDL
