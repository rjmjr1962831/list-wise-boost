# Claude Code Takeaways -- 2026-03-18

## Key Outcomes

### /crawl-stats Clean Room HTML Page -- Built, Deployed, Iterated
- Created new public-facing page at https://www.top10lists.us/crawl-stats serving live 30-day bot crawl statistics as clean room HTML
- Edge function: `serve-bot-crawl-stats-html` -- queries `bot_crawl_logs` (470K+ rows) via 6 parallel `run_sql` calls
- 5 sections on the page:
  - **A1. Human-Triggered Crawls** -- consumer query bots (ChatGPT-User, PerplexityBot, OAI-SearchBot, YouBot): 4,500+ queries/30d
  - **A2. Automated Bot Crawls** -- indexing/training bots (Meta AI, Googlebot, Ahrefs, Applebot, etc.): 464K+ crawls/30d
  - **B. Market Verification** -- top 30 cities by crawl volume with bot diversity and agent counts (joined bot_crawl_logs with professionals table)
  - **C. Consumer Intent** -- intent bots only with descriptions of what each crawl type means
  - **D. Crawl-to-Return Rate** -- repeat indexing metric per bot (Meta AI 99.6%, ChatGPT 51%, Perplexity 61%)
  - **E. Live Activity Stream** -- 50 most recent crawls with agent name and market
- JSON-LD Dataset schema in `<head>` with all key metrics as `variableMeasured`
- All timestamps use `<time datetime="ISO8601">` for machine parsing -- replaced all relative "Xm ago" with absolute UTC timestamps
- Data cleanup: SQL filters exclude zip codes, addresses, "Anytown" placeholder, and normalize casing via `initcap()`

### Routing & Caching
- Vercel rewrite: `/crawl-stats` -> `/api/serve-clean-html?fn=serve-bot-crawl-stats-html`
- Added `crawl-stats` to BOTH SPA catch-all exclusion regexes in vercel.json (both were needed)
- Cache: 15-minute TTL (CDN + browser). First visitor pays ~4s, cached visitors get ~200ms
- `serve-clean-html.js` proxy updated with tiered caching: 15m for crawl-stats, 5m for agent/list/state pages, 0 for content pages

### AI Discovery Integration
- Added /crawl-stats reference to all 7 AI discovery surfaces:
  - llms.txt (high-priority pages)
  - llms-full.txt (core content + footer links)
  - ai-feed/for-ai.md (additional resources)
  - ai-content-index.json (crawlStats endpoint)
  - mcp.json (new resource, 15-min refresh interval)
  - sitemap-pages.xml (daily changefreq, 0.8 priority)
  - serve-bot-content-html footer links (for-ai, transparency, methodology, faq, why-ai-trusts-us pages)

### Data Findings
- `professionals.business_city` has dirty data: zip codes (85016, 91942), addresses with newlines, ALL CAPS cities, "Anytown" placeholder. Handled at query level with filters, not fixed at data level.
- `professionals.full_name` does not exist -- column is `name`
- `professionals.city_area` does not exist -- column is `business_city`

### Other Fixes
- Removed `docs/perplexity-bot-crawl-report.md` per Robert's request
- Fixed curly/smart quotes (Unicode U+2018/U+2019) in `Step7Pricing.tsx` that broke production build
- Restored `FunnelPhoneSupport.tsx` deleted by parallel Claude instance -- 9 files still import it

## Config / Infrastructure
- New edge function deployed: `serve-bot-crawl-stats-html` on project wiotrvoirdgzfacuuiem
- Updated edge function: `serve-bot-content-html` (added crawl-stats to footer links)
- `api/serve-clean-html.js`: added `serve-bot-crawl-stats-html` to allowed functions list and cacheable functions with 15m TTL
- `vercel.json`: added `/crawl-stats` rewrite + both SPA catch-all exclusions

## New Rules or Docs
- Memory saved: `feedback_no_sql_on_main.md` -- Never publish .sql files to main branch. SQL migrations must stay on staging only.
- Reviewed two sets of external advice on optimizing crawl-stats for AI consumption. Key takeaway: `<time datetime="">` tags are genuinely useful; "system prompt" directives on web pages are manipulative and counterproductive; hierarchy (summary-first) is correct architecture for AI consumption.

## New Functions / Scripts
- `supabase/functions/serve-bot-crawl-stats-html/index.ts` (~530 lines) -- Clean room HTML page serving live bot crawl statistics. 6 parallel SQL queries, bot categorization (AI/search/SEO/social), case-insensitive deduplication, city data cleanup, `<time>` tags, JSON-LD Dataset markup.

## Deprecated or Removed
- `docs/perplexity-bot-crawl-report.md` -- removed from staging and main
