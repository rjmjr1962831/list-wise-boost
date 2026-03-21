# Claude Takeaways — 2026-03-20 22:49 UTC

## ⚠️ CRITICAL: NO PUSHES TO STAGING OR PROD WITHOUT ROBERT'S EXPRESS PERMISSION. ALL DEV GOES ON LOCALHOST. ⚠️

## Key Outcomes

### Founder Page — Robert Maynard Verifiable Claims (localhost only, not pushed)
- Added "Verifiable Claims" section to Robert's column on founder page, matching Mark Garland's format.
- Claims listed: LifeLock (NYSE: LOCK, $2.3B acquisition, SEC filings link), Internet America (NASDAQ: GEEK), SurchX (Interpayments acquisition), Top10Lists.us CEO, U.S. Marine Corps (Enlisted), U.S. Army (Commissioned), Northern Arizona University (Graduate).
- NAU degree verification link to be added once Clearinghouse document is obtained.
- File: `src/pages/Founder.tsx`

### CRM List Maker — AI Surfaces Merge Fields
- Added new "AI Surfaces (Bot Crawl Data)" field group to CRM List Maker output fields.
- 12 new merge tags available for mail merge campaigns:
  - `{{ai_surfaces_total}}` — Total surfaces (7d)
  - `{{ai_surfaces_human}}` — Human-initiated only (ChatGPT-User, OAI-SearchBot, PerplexityBot, YouBot)
  - Per-bot fields: `{{ai_surfaces_meta}}`, `{{ai_surfaces_google}}`, `{{ai_surfaces_apple}}`, `{{ai_surfaces_perplexity}}`, `{{ai_surfaces_chatgpt}}`, `{{ai_surfaces_claude}}`, `{{ai_surfaces_bing}}`, `{{ai_surfaces_gptbot}}`, `{{ai_surfaces_other}}`
  - `{{ai_surfaces_top5_bots}}` — Top 5 bot names comma-separated
- Data pulls from pre-computed `agent_ai_surfaces_by_bot` table (7d rolling, cron daily 04:00 UTC).
- File: `src/components/crm/ListMaker.tsx`

### Email Sending via gmail-send Edge Function
- Confirmed `gmail-send` Supabase edge function works for sending emails programmatically.
- Connected email accounts: robert@top10lists.us, robert@toptenlists.us, mark@toptenlists.us, hello@toptenlists.us, hello@top10lists.us.
- Successfully sent Marcus Chen staging links to mark@aryah.ai from robert@top10lists.us.
- Future sessions can use this to send emails on Robert's behalf.

### Vercel Cost Analysis ($620.85/month)
- **Build Minutes ($212)** — 2,251 commits in billing period. #1 cost driver. Even skipped builds consume container spin-up time.
- **Edge Requests ($137, 73M)** — Mostly SPA assets/static files, not bots. Bots are <1% of edge requests.
- **Function Invocations ($88, 146M)** — Inflated by log drain feedback loop (drain function console.logs → generates new Vercel log → triggers another drain call).
- **Drain Volume ($33, 65GB)** — Feedback loop amplifies this.
- **Bot crawl cost projection**: 1M hits/week = ~$15-20/month incremental. Bots are not the cost problem.
- **Fix priorities**: (1) Reduce push frequency — all dev on localhost. (2) Remove console.log from vercel-log-drain to kill feedback loop. (3) Consider disabling log drain entirely if bot_crawl_logs can be populated via edge function middleware instead.

### Staging Deploy Issue
- Vercel ignore script (`scripts/vercel-ignore-build.sh`) was skipping builds when only `supabase/` or `docs/` files changed.
- Fixed by triggering a `vite.config.ts` change to force a build.
- Root cause: the ignore script's skip patterns include `^supabase/` and `^docs/`, so pushes with only edge function or takeaway changes don't trigger builds.

## New Rules
- **⚠️ NO PUSHES WITHOUT ROBERT'S EXPRESS PERMISSION** — Supersedes earlier "auto-execute" rule for pushes. Build minutes are expensive.
- **All dev on localhost** — Use `?id=` param for dashboard dev mode on localhost.
- **Gmail sending available** — Use `gmail-send` edge function with `from_account`, `to`, `subject`, `body` params.

## Unpushed Changes (localhost only)
- `src/pages/Founder.tsx` — Robert's Verifiable Claims section added

## Previously Pushed This Session
- Dashboard overhaul (AIFS modal, pillar reweighting, Web of Truth section, tier comparison, Optimize nav)
- CRM AI surfaces merge fields + human-initiated field
- Badge instructions page updates
- Crawl-stats market query fix (7d filter)
- Methodology page redesign
- Footer crawl-stats link
