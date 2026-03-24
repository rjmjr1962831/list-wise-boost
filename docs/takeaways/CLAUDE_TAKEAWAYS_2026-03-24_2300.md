# Claude Code Takeaways — 2026-03-24 23:00 UTC

## Session Summary
Long session covering email campaign analytics, Texas expansion, bot crawl logging investigation, homepage updates, and multiple infrastructure fixes.

---

## Email Campaign — Bot vs Human Click Detection

### Discovery
- Email security scanners (Barracuda, Proofpoint, Mimecast, Microsoft Defender) pre-fetch every link in inbound emails within 3-15 seconds of delivery
- They spoof real browser user agents (Chrome/Edge) from AWS IPs
- This inflated click metrics: 34 reported clicks → 6 real humans
- Open metrics similarly inflated: 376 reported → ~37 real (79% were scanner opens within 10s)
- 10 agents unsubscribed but campaign showed 0 (counter was never wired)

### Fix: 60-Second Human Filter
- `email-track` edge function now checks elapsed time between `sent_at` and click
- < 60 seconds = scanner → no task, no alert, logged to console only
- Unsubscribe link clicks → no task, no alert
- Human click on real link (>60s, not unsub) → creates `email_clicked` task + sends alert
- Human click on `/funnel/` link → also creates `funnel_landed` task server-side
- Both legacy CRM and sequencer v2 paths filtered identically
- Unsubscribed agents (`email_unsubscribed = true`) skip all task creation
- Deployed to `email-track` edge function

### Corrected Campaign Metrics (Listed 7d Crawl)
| Metric | Reported | Actual |
|---|---|---|
| Sent | 568 | 568 |
| Opens | 376 (66%) | ~37 (6.5%) |
| Clicks | 34 (6%) | ~6 (1.1%) |
| Bounced | 28 | 28 |
| Unsub'd | 0 | 12 |

### Unsubscribe Fix
- `unsubscribe` edge function now marks `sent` queue items (not just pending) as `unsubscribed`
- Campaign monitor pulls count from `email_queue` status — now shows correct number
- Backfilled 12 unsubscribed agents in active campaign
- Sequencer already checks `email_unsubscribed` flag before each send

---

## Bounce Exclusion from Campaign Lists

### Problem
Bounced agents were not excluded from future campaign list building. 24 bounces out of 401 sent would get re-queued.

### Fix
- Added `exclude_bounced` to `ListMakerCriteria` interface, defaulted `true`
- Filter `lead_status != 'email_bounced'` in ListMaker (both query paths), CampaignManager, and `list-maker-export` edge function
- `gmail-sync` now sets `lead_status = 'email_bounced'` on professionals when bounce detected (was only creating CRM task before)
- Completing a bounce task clears `lead_status` back to `'warm'` — agent re-eligible for campaigns
- Three task completion paths updated: ContactDetail, TasksManager, HotLeadsPanel

---

## Texas Expansion — 47 Cities, 1,140 Neighborhoods

### Cities
- 11 core cities (250k+ population from 2020 Census): Houston, San Antonio, Dallas, Austin, Fort Worth, El Paso, Arlington, Corpus Christi, Plano, Lubbock, Laredo
- 36 satellite cities (50k+): 17 DFW, 12 Houston, 6 Austin, 1 San Antonio
- All 47 inserted into `cities` table with lat/lon

### Neighborhoods
- OSM Overpass API pulled 1,091 neighborhoods across 8 metro bounding boxes
- Houston: 502, Austin: 418, DFW: 104, SA: 35, others: 7-10 each
- Supplemented DFW (209 from web research) and SA (105 from web research)
- Final catalog: 1,144 neighborhoods → 1,140 after dedup on ingestion

### Data Enrichment
- Census ACS 2023: 1,989 TX ZCTAs — median income, home value, rent, tenure, vacancy
- HMDA 2022: 419,419 mortgage originations across 591 ZIPs — VA/FHA/conventional breakdown
- Census ZCTA centroid file for neighborhood-to-ZIP mapping
- Tier scores computed: Main (510), Prime (499), Luxury (135)
- Nearby neighborhoods: haversine distance, 3mi radius, max 10 per neighborhood

### State Config Updates (10 files)
- neighborhood-writeup-cron, batch-neighborhood-writeups, generate-sitemap, coverage-stats, city-content-enrichment, artifact-markdown, backfill-license-numbers, generate-static-sitemaps, generate-dynamic-counts, generate-ai-feeds

### Scripts Created
- `scripts/build-texas-catalog.ts` — joins OSM + Census + ZCTA centroids → v4 JSON
- `scripts/enrich-texas-catalog.ts` — merges supplements + HMDA + nearby neighborhoods
- `scripts/save-supplements.ts` — hardcoded DFW/SA supplement neighborhoods
- `scripts/ingest-texas-neighborhoods.ts` — batch upsert to `neighborhood_catalog` table

---

## Writeup Generation — Switched to DeepSeek

### Change
- `neighborhood-writeup-cron`: Prime/Luxury tiers changed from Claude Sonnet → DeepSeek
- `generate-neighborhood-writeup`: All tiers now use DeepSeek
- Main tier still uses Gemini-only (combined research + writeup)
- Estimated cost for 1,140 TX neighborhoods: < $1.00 total

### Pending
- Writeups not yet triggered — edge functions need deployment first

---

## Homepage Review Form

### Changes
- Added required fields: brokerage name, state (dropdown: AZ, CA, CO, FL, NY, TX)
- License number OR Zillow URL required (at least one)
- Privacy notice: "We won't use this information for any reason other than to do our diligence"
- Validation updated in both HTML `required` attributes and JS

### Mary Par Incident
- Review request from homepage landed in `crm_tasks` (task_type: `review_request`) but with `professional_id: null`
- Contact button hung because ContactDetail tried to load a null professional
- Fix: Contact button hidden when `professional_id` is null
- She's not in the license table in any state (searched all 6)

---

## Funnel Tracking Fix

### Problem
- `funnel_landed` tasks stopped appearing despite email clicks
- `crm_contact_activity` inserts silently failed — column name mismatch (`activity_type` should be `event_type`, `description` should be `subject`)
- `crm_tasks` inserts used correct columns but depended on SPA JavaScript executing
- Email security scanners click links but never execute JavaScript → no funnel events

### Fix
- `email-track` edge function now creates `funnel_landed` tasks server-side when a `/funnel/` link is clicked by a human (>60s after send)
- No longer depends on SPA `trackFunnelEvent` executing
- Column name fix in `funnel-track.ts` (`activity_type` → `event_type`)

---

## Bot Crawl Logging Investigation

### Timeline
- Mar 24 00:00 UTC: crawl logging dropped from ~6,000/hr to ~100/hr
- Coincided with production deploy (ptm)
- Meta-ExternalAgent stopped crawling entirely at ~02:20 UTC (Meta's decision)
- Non-Meta dropped 95% — from ~2,500/hr to ~100/hr

### Root Cause (investigated but fix handled by another session)
- `rendered_pages` cache was serving pages without hitting edge functions
- Edge functions import `logBotVisit` but never call it (dead import in all 5 serve-bot functions)
- All logging depended on Vercel proxy's `logBotCrawl` function
- Another Claude session deleted the proxy (`api/serve-clean-html.js`) and restructured the request path
- Robert fixed this in a parallel session — DO NOT TOUCH cache or crawl logging code

### Standing Rule
- Never cache clean-room HTML pages. Edge functions must be hit on every request.
- Memory saved: `feedback_no_cache.md`

---

## CRM Task Cleanup
- Deleted 1,270 false-positive tasks: 868 license_alerts, 374 scanner email_opened, 28 scanner email_clicked
- Remaining: 99 real pending tasks

---

## Other Changes
- `mark@top10lists.us` added as sender (OAuth connected, display name "Mark Garland")
- `gmail-oauth-callback` edge function deployed (was missing)
- ZLIP whitepaper page at `/about/zlip-whitepaper` — clean-room HTML with ScholarlyArticle JSON-LD
- Agent profile `preview_tier` param — shows Community/Awards/Press sections with fallback content
- Homepage: merit gate checklist in hero, sections reordered ("We don't sell leads" moved above "AI has moved")
- `Total Bot Crawls (7d)` added to ListMaker OUTPUT_FIELDS (Insert line)
