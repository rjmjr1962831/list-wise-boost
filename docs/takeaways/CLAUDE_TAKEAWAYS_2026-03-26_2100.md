# Claude Code Takeaways — 2026-03-26 21:00 UTC

## Infrastructure & Rendering Fixes

### Content-Type text/plain on all clean-room pages
- **Root cause:** Supabase gateway forces `Content-Type: text/plain` on all edge function responses regardless of what the function sets. The old Vercel proxy (`api/serve-clean-html.js`) had been masking this by setting its own `text/html` header.
- **Fix:** Created minimal `api/html.js` edge-runtime proxy that fetches from Supabase and sets `Content-Type: text/html`. All 49 serve-bot Vercel rewrites updated to go through this proxy.
- **Health check hardened:** `checkPage()` now validates Content-Type is text/html — would have caught this immediately.

### SPA intercepting clean-room HTML routes
- **Problem:** React Router had routes for all public pages (/, /about, /faq, /transparency, city/agent/state pages). Once SPA loaded from /admin or /crm, all navigation stayed inside React and never hit Vercel rewrites.
- **Fix:** Removed ~25 public page routes from manifest.tsx. Converted all `<Link>` to `<a href>` in Header.tsx and Footer.tsx for public pages. SPA now only handles authenticated routes.

### merge-to-main deleting internal docs from staging
- **Root cause:** Script created a separate deletion commit on main. When main got merged back into staging (via ptm round-trips), deletions propagated — destroying CLAUDE.md and COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md.
- **Fix:** Script now uses `--no-commit --no-ff` merge — internal docs removed within the merge commit itself, so no separate deletion commit exists to propagate.

## Performance Optimizations

### Static pages for founder and crawl-stats
- Founder page: captured rendered HTML to `public/about/founder.html`. Vercel rewrite serves static file. No edge function, no DB. ~130ms (was 1,378ms).
- Crawl stats: pre-rendered HTML fetched from `static_pages` table via prebuild script. ~161ms (was 1,508ms).
- stats.json: same approach — static file from coverage snapshot. ~130ms (was 6,328ms).

### Daily coverage snapshot system
- New `refresh-coverage-counts` cron (daily 5am MST, job #54) queries DB for agent/city/neighborhood counts, writes JSON to `static_pages`.
- `_shared/live-counts.ts` reads from snapshot (one fast row read) instead of running COUNT queries.
- Prebuild fetches snapshot to `.coverage-counts.json` so generators use same numbers.
- All surfaces show "Data last verified: {date}" from snapshot timestamp.

## Data Consistency

### Floor-plus (floorPlus) for all published agent counts
- `floorPlus()` function: rounds down to nearest 100, appends "+". E.g., 3,268 → "3,200+".
- Applied across: llms.txt, llms-full.txt, mcp.json, ai-content-index.json, all edge functions.
- Eliminates cross-page contradictions (3,262 vs 3,268 vs 3,269) that were causing GEO audit deductions.
- JSON-LD structured data keeps exact counts for machine use.

### Scoring weights standardized
- Removed internal scoring model (license_status 20%, recent_activity 20%, etc.) from all public surfaces.
- Single canonical model everywhere: Community 25%, Review Rating 25%, Number of Reviews 20%, Transaction History 20%, Education & Credentials 10%.
- Fixed in: transparency page, methodology page, mcp-server, methodology-schema.json.

### Texas removed from live sources
- TX had zero agents but appeared in sitemaps, generators, and llms-full.txt as if live.
- Removed from SITEMAP_STATES, all SQL queries. Kept as "expanding to" in llms-full.txt.

### Machine-readable asset sync
- Certified audit cycle: ai-content-index said "Monthly" → fixed to "Quarterly".
- Dual mcp.json: synced public/mcp.json to .well-known/mcp.json.
- Artifact format: ai-content-index said "text/html" → fixed to "text/markdown".

## AZ License Verifier Rebuilt
- **Old:** Scraped AZDRE website per-license. AZDRE returned "Session Expired" → regex matched "Expired" from page title → every AZ agent marked as expired.
- **New:** Downloads full AZDRE CSV (222K records) once per run from services.azre.gov/PdbWeb/List/DownloadList/1, builds Map, does instant local lookups. If download fails, AZ verification skipped entirely.

## New Pages & Features

### /ai-reviews page
- Static clean-room HTML with JSON-LD Review schemas for 5 AI platforms.
- All 5 responses populated verbatim: Perplexity, ChatGPT (8.4/10), Claude (95/100), Gemini (9.8/10 latency), Grok.
- Cold-start prompt requiring live retrieval only, URL receipt, no prior knowledge.
- Cross-referenced in: footer, llms.txt, llms-full.txt, mcp.json, ai-content-index.json, robots.txt, sitemap.

### /for-ai/performance-guarantee page
- Data Freshness & Latency Guarantee (v2026.1).
- <150ms TTFB, <300ms core pages, <1.5s aggregates, ZLIP protocol, machine-optimal delivery.
- Static file served from CDN.

### Comprehensive daily health check (health-check-daily)
- 70+ checks across 14 categories: pages, Content-Type, bot crawl logging (e2e probe), AI surfaces, email/campaigns, Stripe, CRM, enrichment, licenses, DB health, sitemaps, edge functions, DNS/SSL, artifacts.
- Always sends full HTML report email at 7am MST.
- Deployed, cron created (job #54... actually separate job for health check).
- Table needs manual creation in SQL editor.

### Dashboard edit fixes
- Neighborhood/cities edit from dashboard now uses sessionStorage professional ID (not agent_session_token).
- Coverage save uses update-professional-field (was silently failing — field wasn't in allowed list).
- Neighborhood edit routes to funnel page with returnTo=dashboard mode.
- X delete buttons on all profile badges (cities, neighborhoods, specialties, community).
- Community section shows role descriptions below badges.

### Verde Valley neighborhoods
- Added 27 neighborhoods: Cottonwood (6), Camp Verde (9), Clarkdale (5), Jerome (3), Cornville (4).
- Added 29 Sedona neighborhoods (was only 3). Removed misplaced "Clarkdale/Saupkasuiva".
- Computed nearby neighborhoods using haversine distance for all 58 Verde Valley neighborhoods.
- Brandon Stockbridge: served_cities updated, license set to Active, tier set to Certified.

## Geo audit false positives fixed
- "851,640 crawls" substring-matched "0 crawls" → fixed with regex lookbehind.
- "4.8+ stars" in deprecation notice triggered stale language alert → now skips deprecation context lines.

## Homepage
- Gemini quote moved to directly under h1 title.
