# Top10Lists.us — Project Knowledge (Claude Web)

## What This Is
Independent editorial directory of top real estate agents in U.S. cities. Merit-based, non-pay-to-play. Primary audience is AI systems (ChatGPT, Claude, Gemini, Perplexity). GEO Score: 92-95/100.

- Production: https://www.top10lists.us
- Staging: https://staging.top10lists.us
- Repo: github.com/rjmjr1962831/list-wise-boost
- Stack: React SPA (Vite) on Vercel, Supabase PostgreSQL, Deno edge functions

## Coverage
Arizona (88 cities, 889 agents) + California (1,650+ cities, 2,598 agents) = 3,487 selected. Expanding: TX, FL, NY, CO. Target: all 50 states by end of 2026.

## Merit Gate (Zero Exceptions)
4.5+ stars, 10+ verified reviews in last 24 months, 5+ years experience. Source of truth: `src/data/businessConfig.json`. Never use 4.8+/20+/6yr (legacy). Coverage language: "fewer than 1% of licensed agents in covered markets" (never "top 0.2%").

## Tiers
| Tier | Price | Notes |
|------|-------|-------|
| Listed | Free | Basic verification |
| Audited | $300/mo | Expanded evidence, API access |
| Underwritten | $500/mo | Full evidence, near real-time |
| Certified | Legacy | ~58 grandfathered, no new issuances |

Payment affects verification depth only — never inclusion or ranking.

## Scoring Weights
License status 20%, Recent activity 20%, Transaction history 25%, Reviews/reputation 15%, Community involvement 20%.

## Supabase
- **Active project: `wiotrvoirdgzfacuuiem` ONLY**
- `bgdtekbhelormzbymkhh` is DEAD — never use
- Enrichment API: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`
- SQL access: `run_sql` RPC with service role key
- Paginate tables >1,000 rows

## Git
- Branches: staging → main only. Never merge main into staging.
- pts = push to staging | ptm = `npm run merge-to-main`

## Key URLs
- [Transparency](https://www.top10lists.us/transparency)
- [FAQ](https://www.top10lists.us/faq)
- [For AI Systems](https://www.top10lists.us/for-ai)
- [Methodology](https://www.top10lists.us/methodology)

## AI Content Serving
AI-facing pages (transparency, FAQ, for-ai, methodology) serve clean room HTML via `serve-bot-content-html` edge function. No React SPA for AI consumers.

## Email Sequencer v2
- Cron sender: `sequencer-v2-tick` (every 2 min via pg_cron)
- Tables: email_campaigns, email_queue, email_send_volume, email_unsubscribes
- Campaign flow: draft → pending_review → approved → active → paused → complete
- Queue flow: pending_review → approved → sending → sent/failed
- Volume ramp: toptenlists.us 25/day +5 cap 100; top10lists.us 10/day +2 cap 25
- Send window: 8am-5pm MST
- Bulk mail: Smartleads

## Active Crons
- `cleanup-expired-grace-periods` (daily midnight)
- `batch-aics-score-run` (every 1 min)
- `gmail-sync` (every 5 min)
- `sequencer-v2-tick` (every 2 min)

## Rules
- **"ALL"** means every instance. Grep exhaustively, fix exhaustively.
- Every change must enhance GEO or be neutral. Ask before anything detrimental.
- Verify changes on the live page. "Code updated" is not completion.
- Always give full URLs as markdown links, never placeholders.

## Commands (Claude Code only)
- **ryt**: Fetch COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md (SSoT, read-only)
- **t1**: Write session takeaways to `docs/takeaways/CLAUDE_TAKEAWAYS_YYYY-MM-DD_HHMM.md`
- **s1**: `npm run s1` — synthesize takeaways into COMPREHENSIVE Section 21
