# t1 Takeaways — CLAUDE — 2026-03-11

## Key Outcomes
- Fixed agent profile 503 bug in `serve-bot-agent-html`: JavaScript temporal dead zone (TDZ) — `const cycle = ac(t)` declared on line 460 but used on line 277. Moved declaration to line 210. All 3,286 agent profiles now return 200 (were 503 for 15 days, Feb 24 – Mar 11).
- Fixed `serve-bot-state-html` stale deploy: `/arizona/top10realestateagents` and `/california/top10realestateagents` returning 404. Redeployed edge function; both now return 200.
- Fixed `cleanup-expired-grace-periods` cron: was downgrading lapsed agents to `badge_tier = 'certified'` (legacy tier). Updated live pg_cron job and `grace_period_cron.sql` to downgrade to `badge_tier = 'listed'` instead.
- Regenerated all sitemaps with `lastmod: 2026-03-11`. Added 11 ai-feed/ pages to sitemap-pages.xml (were missing entirely). Added state hub pages to sitemap-states.xml. sitemap-agents.xml rebuilt from DB (3,286 canonical URLs, was 3,477 stale).
- Fixed FAQ stale dates: replaced 9 instances of "As of February 2026" with "As of March 2026" in `src/data/faqFull.ts` and 18 instances in `public/api/faq/full.json`.
- ptm completed for all bug fixes and sitemap changes.
- FAQ date fix committed to staging only (not ptm'd — Robert to run ptm when ready).

## Config / Infrastructure
- Active crons confirmed (4): `cleanup-expired-grace-periods` (daily midnight), `batch-aics-score-run` (every 1 min), `gmail-sync` (every 5 min), `sequencer-v2-tick` (every 2 min).
- Vercel rewrite confirmed: `/:state/agents/:slug` → `serve-bot-agent-html` edge function (not SPA).
- State hub Vercel rewrite confirmed: `/arizona/top10realestateagents` and `/california/top10realestateagents` → `serve-bot-state-html`.
- ptm uses GitHub Merge API (not PowerShell script) when running from Claude Web environment.

## New Rules or Docs
- **CRITICAL RULE: Claude never runs ptm without Robert's explicit instruction.** All commits go to staging only. ptm requires express permission each time.
- Agent canonical URL pattern is `/:stateSlug/agents/:canonicalSlug` — legacy `/:city/:slug` pattern hits CityLanding (Coming Soon), do not use.
- When ptm creates a divergence between staging and main (e.g., internal doc removal commits on main), use GitHub Contents API to push individual files directly to main rather than attempting a merge.

## New Functions / Scripts
- None this session.

## Deprecated or Removed
- Nothing deprecated this session.
