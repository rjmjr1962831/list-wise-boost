# Claude Code Takeaways — 2026-03-22 20:07 UTC

## Session: Bot Logging, Crawl Stats Redesign, Sequencer Race Condition Fix

---

### generate:ai-feeds Prebuild Script

- **Built `scripts/generate-ai-feeds.ts`** — queries Supabase for live agent/city/neighborhood counts, reads `businessConfig.json`, and updates 5 static AI feed files: `llms-full.txt`, `mcp.json`, `ai-content-index.json`, `.well-known/ai-content-index.json`, `coverage.json`.
- Integrated into prebuild chain (runs before `generate:faq`, `generate:counts`, `generate:sitemaps`).
- Uses Sitemap Rule A queries (only cities with qualifying agents).
- Counts only AZ+CA agents (excludes 12 null-state rows) to match `serve-stats-json`.
- Fixes AZ `agentsQualified=0` in mcp.json.

### GEO Audit Fixes

- **stats.json**: Removed `canonical_slug IS NOT NULL` filter so count matches other feeds (3,262 → 3,268 after enrichment).
- **"invitation-only" → "merit-based selection"**: Replaced across 10+ files (faqFull.ts, faqTop10.ts, DynamicCategoryList.tsx, RankingMethodology.tsx, ZillowPayToPlay.tsx, homepageSchema.ts, serve-bot-pages-html). Press.tsx headlines preserved (real article titles).
- **llms-full.txt "4.8+ stars"**: False positive — intentional deprecation example ("e.g., 4.8+ stars").
- Deployed `serve-stats-json` and `serve-bot-pages-html`.

### Bot Crawl Logging — Vercel Log Drain Replaced

- **Vercel log drain died** ~02:00 UTC Mar 22 (2nd time). Dropped to 2.5% of normal volume (6,787 vs 145K/day).
- **Drain deleted** (drn_AkO7PoO0AFlCWNyz) to prevent duplicates.
- **Inline logging added to `api/serve-clean-html.js`** — fire-and-forget Supabase REST insert on every bot request. Same 25 bot patterns as the drain.
- **Edge Middleware (`middleware.js`)** — attempted for CDN cache hit coverage, but confirmed that **Vercel CDN cache hits do NOT trigger Edge Middleware**. Middleware only sees origin hits (~3.5K/day vs 68K/day from drain).
- **CDN cache restored** on bot pages (s-maxage=300 for lists, s-maxage=3600 for crawl-stats). Middleware can't see cache hits so no point disabling CDN.
- **Decision**: Recreate log drain as primary (captures all hits), middleware as fallback floor. CDN caching stays for performance.
- Old `page_bot_hits` table from original middleware has sporadic data (~8K/day) — same CDN visibility issue.

### Crawl Stats Page Redesign

- **Replaced 644-line page with 335-line streamlined version.**
- Layout: Summary cards → Search box → Top 5 consumer bots → Top 10 crawler bots → MCP calls.
- **Consumer-triggered bots = only bots with "User" in name + PerplexityBot.** OAI-SearchBot, YouBot, GPTBot are crawlers, not live user queries.
- **On-demand agent/market search**: Two required fields (agent name + city/neighborhood). Returns per-agent bot crawl breakdown — Mark's sales tool. Runs only on form submit (no page load cost).
- **Time range selector**: 24h / 7d / 30d (default 30d).
- Shows "X days of data collected" (not fake "rolling 30d").
- Multiple matching agents shown as separate cards sorted by crawl volume.
- **Cold start**: First hit ~10s (30-day aggregate queries). CDN cached at 15 min after that (~170ms).
- **Open item**: Pre-computed daily summary table would eliminate cold start. Planned as daily cron at 05:00 UTC.
- `?agent=`, `?market=`, `?range=` params forwarded through `serve-clean-html` proxy.

### MCP Request Logging

- Internal test calls (curl, node, undici) now filtered from `mcp_request_logs`.
- Purged 12 internal test rows. Only real external AI system calls logged going forward.

### Sequencer Race Condition — ROOT CAUSE + FIX

**Root cause**: All 4 sender accounts processed in `Promise.all`. Each reads `email_send_volume` before any writes back. Stale reads allow all to pass limit check simultaneously → overshoot.

**Evidence**: robert@top10lists.us had limit=25 but sent=40 on Mar 21. Race condition allowed 15 extra emails. Total 251 sent before Robert paused (vs ~150 intended).

**Fix — Atomic CAS slot claim**:
1. Ensure volume row exists via upsert with `ignoreDuplicates`.
2. `UPDATE email_send_volume SET emails_sent = X+1 WHERE emails_sent = X` — compare-and-swap. If two parallel sends read same count, only one succeeds. Loser gets "Slot claim failed" and retries next tick.
3. Rollback if queue row claim fails after slot claim.
4. **Parallel execution preserved** — all 5 accounts fire simultaneously, CAS prevents overshoot without serialization.

**Per-account limits**:
- `top10lists.us` accounts: base 25/day (domain recovering from prior damage)
- `toptenlists.us` accounts: base 40/day
- All compound at 10%/day
- **Hard cap: 300/day per account** (compound until 300, then hold)
- Steady state: 1,500/day = 45,000/month across 5 accounts
- Base-40 accounts hit cap on day 22, base-25 on day 27

**Added mark@toptenlists.us** as 5th sender account with display name "Mark Garland".

### Gmail Sync Fixes

- **CORS fix**: Added OPTIONS handler + `Access-Control-Allow-Origin: *` headers. Browser calls from staging.top10lists.us were blocked.
- **Parallel sync**: 5 accounts sync simultaneously (27s → 11s).
- **Wider window**: `newer_than:7d` instead of `1d`. Removed `-from:me` to capture sent mail.
- **mark@toptenlists.us added to OUR_ACCOUNTS** — was being classified as inbound.
- **email_queue added to inbound filter** — agent replies from campaign recipients now captured.
- **Result**: 219 new emails synced (mostly outbound). Only 1 true inbound in all accounts — no agent replies yet from the Mar 21 campaign (251 sent, 5 clicks, 0 replies).

### CRM Fixes

- **Profile URL**: `/professional/{state}/{slug}` → `/{state}/agents/{slug}` in ContactDetail.tsx.
- **Email account toggles**: Account buttons now toggle on/off to filter inbox by account (was status-only indicators).
- **Empty search hint**: "Try searching by agent name, partial name, or email domain."

### Standing Decisions

- **Bot logging architecture**: Recreate drain (primary) + middleware (fallback). CDN caching stays.
- **Crawl stats cold start**: Plan for daily pre-compute cron at 05:00 UTC (not yet built).
- **Sequencer capacity**: 1,500/day steady state. Scales by adding accounts or tightening cooldown.
- **Consumer bot definition**: ChatGPT-User + PerplexityBot only. All others are crawlers.
