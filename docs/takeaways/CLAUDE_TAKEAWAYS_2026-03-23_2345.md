# Claude Code Takeaways — 2026-03-23

## Session: GSC Dataset Fix, Hardening, City Split, CRM Fix

### Key Outcomes

- **GSC Dataset Schema restored**: Dataset JSON-LD added to all 4 clean-room edge functions (serve-bot-home-html, serve-bot-state-html, serve-bot-list-html, serve-bot-content-html). Root cause: clean-room migration moved bots away from React SPA (which had Dataset JSON-LD) to edge functions (which didn't). GSC showed zero valid Dataset items Feb 25 – Mar 20.
- **Agent profile 503 outage discovered and fixed**: ALL agent profile pages were returning "Service Unavailable" due to undefined variable `isUnderwrittenOnly` in serve-bot-agent-html. Error handler returned HTTP 200 with error body, hiding the outage. Added the variable definition and error logging.
- **Hybrid city_areas eliminated**: `Chandler/Gilbert` (19 neighborhoods) and `Peoria/Surprise` (15 neighborhoods) split into their correct individual cities. 20 moved, 13 duplicates deleted. 22 Vercel 301 redirects added to prevent 404s on old URLs.
- **Edge function hardening**: Created `npm run check:edge` (deno type-check), `npm run deploy:edge` (safe deploy wrapper), upgraded smoke test to detect "Service Unavailable" body content, minimum page size, and JSON-LD presence. Error logging added to 5 silent catch blocks.
- **CRM email insert-at-cursor fixed**: Converted controlled textarea to uncontrolled ref approach. Insert buttons now work at cursor position. "Magic Link" renamed to "Dashboard". Dashboard button inserts `<a href="{{magic_link}}">your dashboard</a>`.
- **Campaign emailer status**: "Listed 7d crawl" active — 397 sent, 2,538 remaining, 62% open rate, 4.8% CTR, 24 bounces.

### Configuration & Architecture

- **Dataset JSON-LD structure**: All edge functions use consistent `@id` pattern (`/#dataset`, `/{state}/#dataset`, `/{state}/{city}/top10realestateagents#dataset`). All reference `/#organization` for entity graph. License: `/terms` (not Creative Commons). All include `measurementTechnique`, 5 `variableMeasured` PropertyValues, `creator`, `publisher`.
- **Hardening scripts**: `scripts/check-edge-functions.sh` runs `deno check` on all serve-bot functions. `scripts/deploy-edge-function.sh` does type-check → deploy → health-check. Smoke test checks for "Service Unavailable" body, min 10KB agent/5KB other pages, JSON-LD presence.
- **HMDA data**: Populated in `neighborhood_catalog` table. `serve-bot-list-html` renders mortgage origination data (total, VA, conventional, FHA) on neighborhood pages with FFIEC source citation. Raw CSVs (54MB AZ, 160MB CA) stay local only — exceed GitHub file size limit.

### Rules & Standing Decisions

- **Error handlers must log**: All edge function catch blocks must use `console.error()`. Never swallow errors silently. 6 of 11 functions were silently swallowing — 5 fixed this session.
- **Edge function deploy process**: Always use `npm run deploy:edge` (or at minimum `npm run check:edge` before manual deploy). Catches undefined variables at type-check time.
- **Smoke test must check body content**: HTTP status codes alone are insufficient. The agent profile outage returned 200 with "Service Unavailable" body.
- **No hybrid city_areas**: Chandler/Gilbert and Peoria/Surprise are eliminated. If new hybrid entries appear in data imports, they should be split immediately.
- **magic_link column is stale**: DB stores `/dashboard/{uuid}` for all agents. Emails dynamically generate `/funnel/{verification_token}` via list-maker-export. The stored column should not be used directly for Listed agents.

### Deprecated / Removed

- `Chandler/Gilbert` city_area_slug — split into `chandler` and `gilbert`
- `Peoria/Surprise` city_area_slug — split into `peoria` and `surprise`
- Silent error handlers in serve-bot-home-html, content-html, founder-html, pages-html, crawl-stats-html — replaced with `console.error()` logging

### Functions & Endpoints

- `npm run check:edge` — pre-deploy type checking for all edge functions
- `npm run deploy:edge` — safe deploy wrapper (type-check → deploy → health-check)
- Smoke test upgraded: detects error pages, checks min body size, verifies JSON-LD

### Robots.txt Findings

- `Gemini-AI`, `Claude-Web`, `Anthropic-AI` — zero hits in bot_crawl_logs. Phantom entries in robots.txt. Real Anthropic crawler is `ClaudeBot` (134 hits). No changes made — report only.

### Crawler Tier Architecture (Scoped, Not Implemented)

- 3-tier proposal: Tier 1 (GPTBot, ClaudeBot, Google-Extended, PerplexityBot) gets schema-dense payloads. Tier 2 (Meta-ExternalAgent, Applebot-Extended, Grok) gets standard clean-room. Tier 3 (AhrefsBot, SemrushBot) gets `X-Robots-Tag: noai`.
- Detection point: `api/serve-clean-html.js` via `X-Crawler-Tier` header to edge functions.
- MVV: 2-file change. No vercel.json changes needed. Cloaking risk low (Tier 1 is additive only).

### GSC Indexing Analysis

- Indexed pages: 11 → 6,879 (625x increase, Dec–Mar). Feb 24 jump (94 → 4,520) caused by clean-room migration giving Google clean HTML.
- Mar 17 drop: 6,879 → 5,003 indexed. Total URLs also dropped 15,507 → 11,766. Needs investigation — possible sitemap shrinkage from Rule A filtering.
- 404s: 710 total. 506 from `other-arizona` neighborhoods, 145 from AZ city/neighborhoods, 31 agent profiles, 16 other-state probes.
- 6,104 "Discovered, not indexed" — down from 11,209 on Feb 24. Google working through backlog.
- 529 "Crawled, not indexed" — pages Google rejected. Need URL list to diagnose.
