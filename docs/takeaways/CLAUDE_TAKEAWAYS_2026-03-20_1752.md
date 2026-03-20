# Claude Takeaways — 2026-03-20 17:52 UTC

## Key Outcomes

### Agent AI Surfaces Infrastructure (New)
- **Created `agent_ai_surfaces_by_bot` table**: Per-agent, per-bot crawl surface counts. Pre-computed daily via pg_cron at 04:00 UTC (`rollup-agent-ai-surfaces` job #43→replaced with new job).
- **Created `agent_ai_surfaces` table**: Per-agent total surface counts (sum of by-bot table).
- **Counting methodology**: Every crawl of a city or neighborhood page counts as a surface for every agent listed on that page (via `served_cities` JSONB). Direct profile page crawls also counted. This matches the crawl-stats page statement: "Each crawl of a page surfaces every agent listed on it."
- **3,187 agents analyzed**, 107.7M total agent-surfaces across all data.
- **Numbers verified**: James Wedell (Phoenix) = 34,590 surfaces (7d). Matches crawl-stats Phoenix market number (34,589 + 1 profile view).

### Crawl-Stats Page Market Query Fixed
- **Old query**: Joined `bot_crawl_logs.agent_id` to `professionals.business_city`. Only counted rows with `agent_id` set. Under-counted by ~60%.
- **New query**: Counts all page crawls by city slug from `page_path`, joins agent counts via `served_cities`. Now shows accurate per-market totals.
- Phoenix went from ~15,487 (old) to ~34,590 (correct, 7d).

### 7-Day Time Window Standardized
- Dashboard, crawl-stats market query, and cron rollup all use `crawled_at >= now() - interval '7 days'`.
- Dashboard label says "in the past 7 days".
- All three sources foot to within 1 (profile view difference).

### Agent Dashboard Improvements
- **AI Surfaces card**: Shows total surfaces + top 5 bot pills. Pulls from pre-computed `agent_ai_surfaces_by_bot` table (instant reads, no heavy queries on dashboard load).
- **Removed**: Redundant detail AI surfaces section (bar chart), progress bar under AIFS score.
- **Added**: Tier descriptions below tier label (e.g., "Basic verification. Annual data refresh.").
- **Enable Artifact button**: Now navigates to agent's funnel pricing page. (Note: Robert wants this changed to a badge/embed instructions page per tier instead.)

### Methodology Page Redesigned
- Reformatted `MethodologyPage.tsx` to match home page layout: single-column flow, alternating section backgrounds, border-left accent blocks, Cards for merit gate and verification tiers.
- Content matches user-provided copy: merit gate, scoring weights (consumer-facing), community subcomponents, coverage stats, data sources, verification tiers, non-pay-to-play principle.
- User modified scoring weights to consumer-facing version: Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education & Credentials 10%.

### Footer Updated
- Added "Crawl Stats" link (`/crawl-stats`) to Quick Links section.

## Config / Infrastructure
- **Supabase tables**: `agent_ai_surfaces` and `agent_ai_surfaces_by_bot` created.
- **pg_cron**: `rollup-agent-ai-surfaces` runs daily at 04:00 UTC. Truncates and rebuilds both tables with 7-day window.
- **Edge function**: `serve-bot-crawl-stats-html` redeployed with corrected market query (page-path-based counting + 7-day filter).
- **vite.config.ts**: Edge route proxy for local dev (pushed earlier in session, included `/crawl-stats`).
- **s1-synthesize.ts**: Added `--force` flag (pushed earlier in session).

## New Rules or Docs
- **Numbers must foot**: Any number published on crawl-stats, agent dashboards, or emails must use the same counting methodology and time window. Currently standardized on 7-day rolling window.
- **AI Surfaces = page crawls × agent presence**: Every crawl of a page where an agent is listed counts as one surface for that agent. This is the canonical definition.
- **No pts this session unless explicitly requested**: Robert's standing instruction for this session.

## Unresolved / Flagged
- **Enable Artifact destination**: Robert wants this to go to a badge/embed instructions page specific to the agent's tier, not the pricing funnel. Page may need to be built. `/badge-instructions` route exists but needs review.
- **Listed tier**: Does not enable Web of Truth artifact. Only Certified and above.
- **Name in dashboard upper-left**: Robert reported seeing his name (Robert) instead of the agent's name. Likely in `AgentDashboard.tsx` parent component, not in `OverviewSection.tsx`. Needs investigation.

## Deprecated or Removed
- **Old crawl-stats market query**: JOIN-based counting via `agent_id` → `professionals.business_city`. Replaced with page-path-based counting.
- **Old cron job #43**: Replaced with new job using 7-day filter.
- **`agent_ai_surfaces` period='all'**: Replaced with period='7d'.
- **`agent_ai_surfaces` city/neighborhood/profile breakdown columns**: No longer populated. Total only.
