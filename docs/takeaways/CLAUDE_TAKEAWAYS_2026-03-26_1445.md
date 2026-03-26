# Claude Code Takeaways — 2026-03-26 14:45 UTC

## Bot Crawl Logging — Root Cause Found & Architecture Rebuilt

### The Real Problem: s-maxage on Edge Functions
- All 11 serve-bot edge functions returned `s-maxage` (1h-24h) in their response headers
- Vercel CDN cached responses and served them WITHOUT hitting the edge function
- `logBotVisit()` only fires on edge function execution → 90%+ of bot traffic was invisible
- This was the root cause of the 143K → 13K drop, NOT bot throttling

### New Architecture: Axiom Log Drain + 12h CDN Cache
- **Axiom** (axiom.co) connected as Vercel log drain — captures EVERY request (cache HIT + MISS) with full user-agent, path, status, cache status
- Dataset: `vercel` on Axiom, API token stored as `AXIOM_API_TOKEN` Supabase secret
- Edge functions restored to `s-maxage=43200` (12h CDN cache) for fast bot response times
- `sync-axiom-crawls` edge function queries Axiom API every 12h, aggregates bot crawls by hour+bot_name, writes to `bot_crawl_hourly` table
- Dashboard queries now UNION `bot_crawl_logs` (historical) + `bot_crawl_hourly` (Axiom-sourced)
- `middleware.js` created for Vercel Edge Middleware pre-cache bot detection (may not work with Vite — needs Vercel deploy to test)

### Bot Crawl Hourly Table
- `bot_crawl_hourly` (hour, bot_name, visits, synced_at) — PRIMARY KEY (hour, bot_name)
- Populated by `sync-axiom-crawls` via Axiom APL query with `has` operator for bot detection
- API endpoint: `https://api.axiom.co/v1/datasets/_apl?format=tabular` (NOT `/v1/datasets/vercel/query`)
- 26 bot patterns detected via APL `case` statement

## Email Scanner Detection — Opens Now Filtered

### Problem
- Email security scanners (Barracuda, Proofpoint, Microsoft Defender) pre-fetch tracking pixels within 3-15 seconds of delivery
- 111 of 127 pending "email_opened" CRM tasks were scanner false-positives (< 60s after send)
- `email-track` had 60s filter on CLICKS but NOT on opens

### Fix
- Opens < 60s after send now logged as `scanner_open` in `crm_contact_activity` (visible in timeline) but NO CRM task created
- Clicks < 60s logged as `scanner_click` — same treatment
- Both scanner and human events always logged to activity timeline with `is_scanner: true/false` in metadata
- 111 false-positive tasks marked completed with note "Auto-closed: scanner open"
- Applied to both legacy email path AND sequencer v2 (campaign) path

## GEO Audit Results — 92 → 96/100

### Perplexity V1 (Mar 25): 92/100
### Perplexity V2 (Mar 26): 96/100
### Claude Code Independent Audit: 94/100

### Fixes Deployed
- All stale timestamps updated to March 26, 2026 (Privacy, SMS Terms, llms-full.txt, ai-content-index.json, mcp.json)
- Merit gate 4.5+/10+/5+ confirmed consistent across ALL 10 audited assets — zero deprecated values
- AIFS score now rendered on every agent profile page (HTML body + JSON-LD `additionalProperty`)
- WebSite+SearchAction JSON-LD added to homepage
- "Why selected" on list pages: was gated to Certified+ tiers — `selection_rationale` now fetched for ALL agents
- City page ItemList `dateModified` now uses `max(updated_at, license_verified_at)` instead of just `updated_at`
- 7 missing `selection_rationale` values backfilled — 3,269/3,269 coverage

### Perplexity Got Wrong
- "Why selected NOT VERIFIED on Listed" — present on profile pages, was missing on LIST pages (now fixed)
- "AIFS on profiles not verified" — live and working with pillar breakdown
- "hasCredential not verified in HTML" — present since before V1 (lines 324-342 of serve-bot-agent-html)
- "llms-full.txt ~15,000 words" — actual word count is 6,675

## AZDRE License Scraper Bug — CRITICAL

### Problem
- 865 of 879 active AZ agents showed `license_status = "Expired"` after nightly verification ran Mar 24
- Only 14 AZ agents showed "Active" — those had NULL license numbers (never verified)
- The AZDRE scraper is returning "Expired" for virtually ALL valid AZ licenses
- This is a scraper bug, NOT real expirations

### Safety Net Added Then Reverted
- Added safety net: if agent is active but license != Active, de-list regardless of status change
- **REVERTED IMMEDIATELY** when we realized it would mass de-list 868 agents (26% of directory)
- The original status-change-only logic is correct GIVEN the scraper bug

### Data Fix
- All 865 AZ `license_status` values reset from "Expired" to "Active" via manual SQL
- Agent profiles now correctly show `credentialStatus: "Active"`

### TODO
- Investigate AZDRE scraper — likely scraping wrong field or misinterpreting renewal status
- Do NOT re-enable nightly verification for AZ until scraper is fixed
- California verification appears to work correctly (2,387 Active, 3 EXPIRED)

## Merge Variable Picker

- New shared `MergeVariablePicker` popup component with search, category groups, radio buttons
- 49 variables across 6 categories (Contact, Profile, Dates, AI Surfaces, AIFS, System)
- Link variables (magic_link, zillow_profile_url, website, social_linkedin) auto-wrap in `<a>` tags with contextual link text ("your dashboard", "your Zillow profile", etc.)
- Added to all 5 compose surfaces: ContactDetail, TasksManager, EmailManager, ListMaker, CampaignManager
- Shared constants in `src/components/crm/merge-variables.ts`

## Broken Route Fixes
- OverviewSection "View Upgrade Options": `/funnel/:token/pricing` → `/tier`
- AIMaxPlan upgrade link: `/funnel/:token/pricing` → `/tier`
- BillingSection upgrade: `/visibility/tiers` → `/funnel/:token/tier`

## Neighborhood Count Mismatch
- `ai-content-index.json` showed AZ: 2,668 neighborhoods; `coverage.json` showed AZ: 2,233
- Root cause: `generate-ai-feeds.ts` used a different JOIN than the sitemap generator
- Fixed: ai-feeds now uses same qualified-city JOIN as sitemap (WITH qualified_cities AS...)
- Will reconcile on next prebuild

## Standing Rule Updates
- **NO CACHING rule is OBSOLETE** — edge functions now use `s-maxage=43200` (12h CDN cache). Axiom log drain handles counting.
- **logBotVisit() remains as backup** — fires on cache MISS only. Primary counting is via Axiom.
- **AZDRE nightly verification DISABLED** — scraper returns false "Expired" for all AZ licenses. Do not re-enable until scraper is investigated.
