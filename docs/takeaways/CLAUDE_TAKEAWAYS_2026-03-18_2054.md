# Claude Code Takeaways -- 2026-03-18

## Key Outcomes

### Crawl-Stats Dynamic Days Label
- All "30d" labels on the /crawl-stats clean room HTML page are now computed dynamically from actual data span (earliest record to latest)
- Currently shows "6d" (or whatever the real span is); auto-flips to "30d" once 30 days of data accumulate
- Affects: stat cards, section headers (A1, A2), consumer intent count, return rate description, meta description, JSON-LD Dataset schema, collection methodology paragraph
- The "recording began 2026-03-12" note auto-hides once actualDays >= 30
- Edge function redeployed: serve-bot-crawl-stats-html

### Crawl-Stats Cache Changed to 1 Hour
- CDN cache for /crawl-stats changed from 15 minutes to 1 hour (max-age=3600, stale-while-revalidate=7200)
- Updated in api/serve-clean-html.js proxy

### Vercel Log Drain -- Complete Bot Crawl Tracking
- Problem: bot_crawl_logs only captured requests that reached Supabase edge functions. CDN cache hits (majority of traffic) were invisible. 29 page_bot_hits vs 546 bot_crawl_logs in same 1.4h window demonstrated the gap.
- Solution: Vercel Pro log drain sends ALL production requests (including CDN cache hits) to a new edge function that filters for bots and inserts into bot_crawl_logs
- Architecture:
  - Vercel log drain -> `https://www.top10lists.us/api/vercel-log-drain` (Vercel serverless proxy) -> `vercel-log-drain` Supabase edge function -> bot_crawl_logs table
  - Proxy needed because Supabase edge functions require auth headers that Vercel's log drain won't send
  - Proxy also handles Vercel's x-vercel-verify handshake for endpoint validation
- Bot detection: 25 named bot patterns (matching serve-bot-crawl-stats-html categories) + generic bot/crawler/spider catch-all
- Agent ID resolution: batch resolves canonical_slug -> professional ID for agent profile pages
- Inserts in batches of 500 rows
- HMAC-SHA1 signature verification using Vercel-provided secret
- Log drain verified working: AhrefsBot crawls appearing in bot_crawl_logs within 60 seconds of drain activation

### Inline Bot Logging Removed (Dedup Fix)
- Removed fire-and-forget bot_crawl_logs inserts from `serve-bot-agent-html` and `serve-bot-list-html`
- These were creating duplicate rows alongside the new log drain
- All bot crawl tracking now flows through the single Vercel log drain path
- Both edge functions redeployed

### Broken Grep Tool Identified
- The Grep tool's ripgrep binary is arm64-win32 on an x64 Windows machine -- fails silently or throws ENOENT
- Other Claude instances use bash grep and find things on the first try
- Rule saved to memory: always use `bash grep` via Bash tool, never the Grep tool

## Config / Infrastructure
- `VERCEL_LOG_DRAIN_SECRET` set as Supabase secret (value: Vercel-generated `boL1ZQNUKCjWKPcvBMfLBu8tqaVS6e8w`)
- `VERCEL_LOG_DRAIN_VERIFY` set as Vercel env var (production only, value `7c8e96498a802e0b7f3ea6bbd3cf909d32fee8cc`)
- Vercel log drain created: "bot-crawl-logger", JSON format, sources: edge/static/lambda, production only
- serve-bot-crawl-stats-html edge function redeployed (dynamic days label)
- serve-bot-agent-html edge function redeployed (inline logging removed)
- serve-bot-list-html edge function redeployed (inline logging removed)
- api/serve-clean-html.js updated (1h cache for crawl-stats)
- ptm run: staging merged to main, CDN purged, IndexNow pinged (40 URLs)

## New Rules or Docs
- Memory saved: `feedback_no_approval_needed.md` -- never ask permission except for ptm and GEO-detrimental changes
- Memory saved: `feedback_use_bash_grep.md` -- always use bash grep, never the Grep tool (broken ripgrep binary)

## New Functions / Scripts
- `supabase/functions/vercel-log-drain/index.ts` -- Receives Vercel log drain webhooks, filters for bot user-agents (25 patterns), resolves agent IDs from page paths, batch inserts into bot_crawl_logs. HMAC-SHA1 signature verification. Handles Vercel's x-vercel-verify GET handshake.
- `api/vercel-log-drain.js` -- Vercel serverless proxy for the Supabase edge function. Adds auth headers, handles verification handshake, forwards POST payloads.

## Deprecated or Removed
- Inline bot_crawl_logs inserts removed from `serve-bot-agent-html` (~20 lines) and `serve-bot-list-html` (~40 lines) -- replaced by Vercel log drain
- `log-bot-visit` edge function writes to `cloudflare_request_logs` table using Cloudflare field names (ray_id, cache_status) -- legacy dead Cloudflare infra, unrelated to the new log drain
- 15-minute cache on crawl-stats replaced with 1-hour cache

## Handoff Notes

### What's Working
- Vercel log drain is **live and confirmed receiving data** (AhrefsBot rows appeared within 60s)
- /crawl-stats page shows dynamic day labels (currently ~6d, auto-transitions to 30d)
- All bot tracking now flows through a single path: Vercel log drain -> proxy -> edge function -> bot_crawl_logs

### What to Watch
1. **Data volume in bot_crawl_logs** -- the log drain captures CDN cache hits that were previously invisible. Expect significantly higher row counts than before. Monitor table size over the next 24h. If it grows too fast, add filters in the edge function to skip low-value bots (SEO crawlers, link preview bots).
2. **Log drain reliability** -- check Supabase function invocations dashboard for errors on `vercel-log-drain`. The function logs insert errors to console.
3. **Duplicate rows from transition period** -- there may be a window of duplicates from before the inline logging was removed and after the log drain started. A one-time dedup query may be needed: `DELETE FROM bot_crawl_logs a USING bot_crawl_logs b WHERE a.id > b.id AND a.bot_name = b.bot_name AND a.page_path = b.page_path AND a.crawled_at = b.crawled_at AND a.agent_id IS NOT DISTINCT FROM b.agent_id;`
4. **Agent ID resolution gap** -- the log drain resolves agent_id for `/state/agents/slug` and `/artifact/uuid` paths. City and neighborhood list pages do NOT get agent_id resolved (the log drain inserts one row per page visit with agent_id NULL). The old inline logging in serve-bot-list-html inserted one row PER AGENT on each list page. This is a behavior change -- per-agent crawl credit on list pages is no longer tracked. If this matters, the log drain could be extended to do the same list page expansion, but it would require querying the professionals table for each list page hit.
5. **Vercel log drain dashboard** -- visible at Vercel > Settings > Log Drains. Secret can be rotated there; if rotated, update the `VERCEL_LOG_DRAIN_SECRET` Supabase secret to match.

### Files Changed This Session
- `supabase/functions/serve-bot-crawl-stats-html/index.ts` -- dynamic daysLabel
- `api/serve-clean-html.js` -- 1h cache for crawl-stats
- `supabase/functions/vercel-log-drain/index.ts` -- NEW: log drain receiver
- `api/vercel-log-drain.js` -- NEW: Vercel proxy for log drain
- `supabase/functions/serve-bot-agent-html/index.ts` -- inline logging removed
- `supabase/functions/serve-bot-list-html/index.ts` -- inline logging removed
