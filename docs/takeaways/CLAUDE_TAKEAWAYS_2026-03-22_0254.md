# Claude Takeaways — 2026-03-22 02:54 UTC

---

## Key Outcomes

### Email Sequencer — 3 Bugs Fixed (Deployed)
- **UTC/MST date mismatch**: `todayStr` used UTC date, but send window uses MST. Daily volume counter reset at 5pm MST (midnight UTC), effectively doubling the daily send limit. Fixed with `getMSTDateStr()` helper.
- **No global daily cap**: Each of 4 sender accounts had independent limits with no cross-account ceiling. Added global cap that sums all accounts' volume for the MST day.
- **Paused campaigns ignored**: Sequencer sent any `approved` queue row regardless of parent campaign status. 2,725 queued emails would have kept going despite campaign being paused. Added campaign status check + campaign-level `max_per_day` enforcement.
- **Result**: 251 emails sent before pause took effect (vs intended ~160). Campaign "Listed 7d crawl" confirmed paused at 251 sent, 2,690 remaining in queue.

### Email Campaign Performance (Day 0)
- **251 sent**, 90 opens (**60% open rate**), 5 clicks (**3.6% CTR**), 9 bounces (3.6%).
- Open rate inflated by Apple Mail Privacy Protection / scanners — real human opens lower but still strong.
- CTR is 2x cold email benchmark (1-2%). Personalized AI surface data is a strong hook.
- Bounce rate (3.6%) above ideal (<2%) — email verification matters.

### Teams Excluded from Campaign Queue
- **30 team rows** and **1 pending_email_verification** row pulled from queue (set to `skipped`).
- **Root cause**: `CampaignManager.tsx` was missing `exclude_teams: true` in initial criteria state. `ListMaker.tsx` already had it. Fixed — one-line change.

### AI Surfaces Rollup — 10x Inflation Fixed
- **Root cause**: Rollup joined neighborhood page crawls on `served_cities` — meaning a crawl of `/california/los-angeles/hollywood/top10realestateagents` was attributed to ALL 386 LA agents, not just agents serving Hollywood.
- **New `served_neighborhoods` column** added to `professionals` (JSONB + GIN index).
- **`assign-neighborhoods.ts` script** matches agents to specific neighborhoods:
  - Tier 1 (service_areas text matching): 2,432 agents (74%)
  - Tier 2 (zip code proximity): 569 agents (17%)
  - Tier 3 (city-only fallback): 273 agents (8%)
  - Average 16.9 neighborhoods per agent (was effectively ALL neighborhoods in their city)
- **Rollup function replaced**: `rollup_ai_surfaces_monthly()` now uses 3-way UNION: city crawls → `served_cities`, neighborhood crawls → `served_neighborhoods`, profile crawls → `canonical_slug`.
- **Result**: 98M → 14.8M total surfaces (with full 7-day data). Allen Alon Tubi: 172K → 19.3K (21 real neighborhoods vs 230 city-wide).
- **Cron rescheduled**: `rollup-ai-surfaces` daily at 04:00 UTC.

### Vercel Log Drain — Investigated, Confirmed Alive
- Drain stopped delivering at ~2am UTC March 22. Only 153 rows on Mar 22 vs normal ~144K/day.
- Verification token, proxy endpoint, and edge function all confirmed working via manual tests.
- Drain was configured and "running" in Vercel dashboard — it was buffering/retrying and flushing backlog.
- Backfill script created for Mar 22-23 (~288K rows) but then deleted when drain started delivering real data for those dates to avoid double-counting.
- **Open item**: Monitor drain catch-up over next 24 hours. Re-backfill if needed.

### Bot Page Agent Selection — Finding
- `serve-bot-list-html` shows ALL city agents on every neighborhood page (queries by `city_id` only, never filters by neighborhood). The `agent_neighborhood_subscriptions` table exists but isn't used by the bot HTML endpoint. This is a separate fix needed.

---

## Config / Infrastructure

- **Edge functions deployed**: `sequencer-v2-tick` (with MST fix, campaign pause, global cap).
- **Database changes**: `served_neighborhoods` JSONB column + GIN index on `professionals`. 3,274 agents populated.
- **Cron jobs**: Old `rollup-agent-ai-surfaces` (inline SQL) unscheduled. New `rollup-ai-surfaces` uses corrected `rollup_ai_surfaces_monthly()` function.
- **Scripts added**: `scripts/assign-neighborhoods.ts`, `scripts/backfill-crawl-logs-mar22-23.ts`, `scripts/fix-rollup-surfaces.sql`.
- **Campaign state**: "Listed 7d crawl" paused at 251 sent, 2,690 queued (31 teams/unverified removed).

---

## New Rules or Docs

- **Sequencer send window is MST-aligned everywhere**: Both the `isInSendWindow()` guard AND the volume tracking `todayStr` must use MST dates. UTC date for volume = counter resets at 5pm MST.
- **Campaign pause must be enforced by sequencer**: The sequencer must check `email_campaigns.status` before sending any queued row. Queue rows with `status=approved` are not sufficient — the parent campaign may be paused.
- **Global daily cap = per-account limit × number of accounts**: Prevents total volume from exceeding intended ramp even if individual accounts are under their limits.
- **AI surfaces are neighborhood-specific**: A crawl of a neighborhood page counts as a surface only for agents whose `served_neighborhoods` contains that neighborhood slug. City page crawls still attribute to all agents serving that city.
- **`served_neighborhoods` is the canonical agent-to-neighborhood mapping**: Populated by `assign-neighborhoods.ts`. Must be re-run after enrichment adds new agents or service_areas change.
- **One agent has 349 neighborhoods** — likely a county-level `service_areas` match. Consider capping at ~30 neighborhoods per agent.

---

## New Functions / Scripts

- `scripts/assign-neighborhoods.ts` — 3-tier matching (service_areas → zip → city fallback)
- `scripts/backfill-crawl-logs-mar22-23.ts` — statistical backfill based on Mar 17-21 distribution
- `scripts/fix-rollup-surfaces.sql` — corrected rollup function + cron schedule

---

## Deprecated or Removed

- **Old `rollup-agent-ai-surfaces` cron job** (inline SQL, joined on served_cities for all page types) — replaced with `rollup-ai-surfaces` using `rollup_ai_surfaces_monthly()` function.
- **Old surface numbers (98-119M)** — inflated 10x. Correct range is ~14-15M for 7-day window with full data.
- **Backfill rows for Mar 22-23** — deleted to avoid double-counting with real drain data.

---

## Open Items

- [ ] Monitor log drain catch-up for Mar 22-24. Re-backfill gaps if Vercel doesn't retry old logs.
- [ ] Cap `served_neighborhoods` at ~30 per agent to prevent outliers.
- [ ] Fix `serve-bot-list-html` to filter agents by neighborhood (currently shows all city agents on every neighborhood page).
- [ ] `email_campaigns.total_sent` counter is wrong (209 vs real 251) — non-atomic read-then-write race condition. Low priority.
