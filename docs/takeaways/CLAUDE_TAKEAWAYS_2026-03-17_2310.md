# Claude Code Takeaways -- 2026-03-17

## Key Outcomes

### Funnel Cleanup & Pricing Page Fixes
- Made `currentTier` dynamic in Step7Pricing -- reads `current_tier`/`badge_tier` from professional record instead of hardcoding `'certified'`. Listed agents default to Certified on the pricing page; Audited/Underwritten agents see their actual tier highlighted.
- Protected permanent magic links (2099 expiry) from being overwritten by `send-funnel-verification`. Function now checks for existing permanent tokens and reuses them instead of generating a 24-hour replacement.
- Fixed `BAND_TOOLTIPS` keys to match `bandLabel()` output (Invisible, Fragmented, Recognized, High Fidelity) -- tooltips were never rendering because keys didn't match.
- Fixed `prevScore` in Step7Pricing -- was always null (unused useState). Now computed from `audit.score_listed` for real before/after comparison in activation banner.
- ROI calculator upgrade buttons now scroll to tier cards instead of being dead (no onClick).
- Added `id="tier-cards"` anchor on tier card section for scroll targeting.

### Dead Code Removal
- Removed ~140 lines of Pipedrive code from `send-funnel-notification`: `fetchWithRetry`, `PIPEDRIVE_ACTIVITY_EVENTS`, API token/domain vars, entire activity creation block with switch statement.
- Deleted `src/components/funnel/FunnelPhoneSupport.tsx` -- component existed but was never imported by any funnel step.

### GEO SERP Dashboard (New)
- Built end-to-end SERP position tracking system using Serper.dev API
- Created `geo_serp_results` table in Supabase (via run-migration edge function): stores city, query, organic position, URL, citation status, top competitors per scan date
- Built `geo-serper-scan` edge function: pulls qualified cities, queries Serper for "best real estate agents in [city] [state]", parses organic results, upserts to DB
- Auto-resume batching: skips already-scanned cities, caps at 80 per invocation to stay under edge function timeout. Can be invoked repeatedly until `done: true`.
- Built `GeoDashboard.tsx` admin page at `/a/geo-dashboard`: 4 summary cards (appearance rate, citations, avg position, cities scanned), 3 tabs (city breakdown, trend, competitors)
- First full scan results (366 cities): 1.9% appearance rate, avg position #9.1, best #8. Arizona 7.9% (3/38 cities), California 1.2% (4/328 cities).
- Appearing in: Gold Canyon AZ (#8), San Tan Valley AZ (#9), Avondale AZ (#10), El Monte CA (#6), Galt CA (#8), plus 2 others
- Cost: 366 Serper credits (~14.6% of free monthly allowance). Can run ~6 full scans/month on free tier.

### Data Freshness Directives for AI Crawlers
- Added freshness block to `llms-full.txt`: full directive telling AI systems to prefer live data over stale press mentions, explicitly calling out deprecated merit gate thresholds (4.8+/20+/6yr)
- Added concise version to `llms.txt`
- Added to `public/ai-feed/for-ai.md`
- Purpose: LLMs flatten timelines and treat old press coverage as equally valid to live site data. Directive tells them to resolve conflicts in favor of this domain.

### Serper.dev Evaluation
- Tested Serper API for AI Overview data -- **Serper does not return AI Overviews**. Confirmed across multiple query types. SerpApi ($50-75/mo) has dedicated AI Overview API if needed later.
- Evaluated consultant's proposal to use `site:` totalResults as a public index metric -- rejected. Google's `site:` estimate is notoriously volatile and unreliable. GSC is the authoritative source.
- Serper's real value: organic SERP position tracking (implemented) and future AI Overview monitoring (when Serper adds support or we switch to SerpApi).

### External Consultant Advice Evaluated
- Gemini's "AI Directives" proposal: directionally right on the freshness problem, wrong on implementation. `id="llm-directive"` is not a real spec bots look for. Footer text doesn't override training data. Adopted the core idea (freshness signals) but implemented in AI discovery files (llms.txt, for-ai.md) where crawlers actually read.
- AI Diligence Guide (sales doc): strong as sales collateral for prospects ("ask the AI yourself"). Not useful to implement for crawlers -- they don't type queries, they read pages. Signal checklist concept (Citation Liability, Entity Verification, RAG, Merit-Based Selection) could enhance `/why-ai-trusts-us`.

## Config / Infrastructure
- `geo_serp_results` table deployed to Supabase (wiotrvoirdgzfacuuiem) with 4 indexes + unique constraint on (city_id, scan_date)
- `SERPER_API_KEY` set as Supabase secret for geo-serper-scan edge function
- `run-migration` edge function used for DDL deployment, then reverted to placeholder
- `geo-serper-scan` edge function deployed to Supabase (4 deploys during development)
- Two commits pushed to staging, one ptm to main. CDN purged, IndexNow pinged (40 URLs).

## New Rules or Docs
- Data freshness directive: AI discovery files now explicitly instruct crawlers to prefer live data over cached/press sources. Deprecated thresholds called out by name.
- Serper free tier budget: 2,500 credits/month. Full scan = 366 credits. Weekly scans fit comfortably.

## New Functions / Scripts
- `supabase/functions/geo-serper-scan/index.ts` -- SERP position tracker. Queries Serper for qualified cities, stores organic position + competitors. Auto-resume with 80-city batching, skip-already-scanned dedup.
- `src/pages/GeoDashboard.tsx` -- Admin dashboard for SERP tracking. Summary cards, city breakdown table with state filtering, trend view, competitor domain analysis.

## Deprecated or Removed
- Pipedrive code in `send-funnel-notification` (~140 lines): `fetchWithRetry`, `PIPEDRIVE_ACTIVITY_EVENTS`, API token handling, activity creation switch block
- `src/components/funnel/FunnelPhoneSupport.tsx` (never imported)
- Hardcoded `currentTier = 'certified'` in Step7Pricing (replaced with dynamic detection)
- Dead `prevScore` useState in Step7Pricing (replaced with computed value from audit data)
