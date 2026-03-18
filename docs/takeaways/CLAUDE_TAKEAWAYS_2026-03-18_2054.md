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
- **Known issue: duplicate rows** -- both the inline edge function logging (serve-bot-agent-html, serve-bot-list-html) and the log drain now insert into bot_crawl_logs. Needs dedup logic.
- Log drain verified working: AhrefsBot crawls appearing in bot_crawl_logs within 60 seconds of drain activation

### Broken Grep Tool Identified
- The Grep tool's ripgrep binary is arm64-win32 on an x64 Windows machine -- fails silently or throws ENOENT
- Other Claude instances use bash grep and find things on the first try
- Rule saved to memory: always use `bash grep` via Bash tool, never the Grep tool

## Config / Infrastructure
- `VERCEL_LOG_DRAIN_SECRET` set as Supabase secret (value: Vercel-generated `boL1ZQNUKCjWKPcvBMfLBu8tqaVS6e8w`)
- `VERCEL_LOG_DRAIN_VERIFY` set as Vercel env var (production only) for endpoint verification handshake
- Vercel log drain created: "bot-crawl-logger", JSON format, sources: edge/static/lambda, production only
- serve-bot-crawl-stats-html edge function redeployed (dynamic days label)
- api/serve-clean-html.js updated (1h cache for crawl-stats)
- ptm run: staging merged to main, CDN purged, IndexNow pinged (40 URLs)

## New Rules or Docs
- Memory saved: `feedback_no_approval_needed.md` -- never ask permission except for ptm and GEO-detrimental changes
- Memory saved: `feedback_use_bash_grep.md` -- always use bash grep, never the Grep tool (broken ripgrep binary)

## New Functions / Scripts
- `supabase/functions/vercel-log-drain/index.ts` -- Receives Vercel log drain webhooks, filters for bot user-agents (25 patterns), resolves agent IDs from page paths, batch inserts into bot_crawl_logs. HMAC-SHA1 signature verification. Handles Vercel's x-vercel-verify GET handshake.
- `api/vercel-log-drain.js` -- Vercel serverless proxy for the Supabase edge function. Adds auth headers, handles verification handshake, forwards POST payloads.

## Deprecated or Removed
- `log-bot-visit` edge function writes to `cloudflare_request_logs` table using Cloudflare field names (ray_id, cache_status) -- this is legacy dead Cloudflare infra. The new log drain writes to `bot_crawl_logs` which is what crawl-stats actually reads from.
- 15-minute cache on crawl-stats replaced with 1-hour cache
