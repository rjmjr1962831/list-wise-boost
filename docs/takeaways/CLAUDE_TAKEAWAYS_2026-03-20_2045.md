# Claude Takeaways — 2026-03-20 20:45 UTC

## ⚠️ CRITICAL: NO PUSHES TO STAGING OR PROD WITHOUT ROBERT'S EXPRESS PERMISSION. ALL DEV GOES ON LOCALHOST. ⚠️

## Key Outcomes

### Agent Dashboard Overhaul
- **AIFS Score modal**: "What is this?" link opens modal explaining AIFS is derived from the agent's entire internet footprint, not just Top10Lists. Lists all scoring inputs (license, reviews, transactions, community, press, data depth/refresh).
- **Tier descriptions rewritten**: Now explain what each tier means to AI citation, not just verification specs. E.g., Certified: "AI can confirm you exist... but may hedge or omit you." Underwritten: "Highest probability of being named first with full conviction."
- **Web of Truth card**: Removed "Artifact" from title. All tiers get Web of Truth. Disabled state shows "Enable" button → badge instructions page. Enabled state shows status.
- **Nav renamed**: "AI Max Plan" → "Optimize". "Badge & sharing" → "Web of Truth".

### AIFS Pillar Reweighting (was 5×25=125, now totals 100)
| Pillar | Old Max | New Max | Rationale |
|--------|---------|---------|-----------|
| Identity | 25 | 25 | Must disambiguate first |
| Citability | 25 | 25 | Can AI extract and cite? |
| Social Proof | 25 | 20 | Strong but secondary |
| Authority | 25 | 15 | Strengthens conviction |
| Technical | 25 | 15 | Enables everything else |

### Pillar "How to Fix" Redesign
- Each pillar's fix list now leads with two checkable items: (1) Upgrade to Underwritten, (2) Enable Web of Truth — with checkmarks if active.
- "Or:" section follows with manual action items, each showing estimated point impact (e.g., "+3 pts").
- Point estimates derived from actual `computeScore()` formula in `geo-footprint-audit/index.ts`.

### Score Projections Redesign
- Removed Listed tier from projections (agents are Certified at minimum).
- 3 columns: Certified / Audited / Underwritten.
- Each shows AI citation meaning instead of cost/points.
- "Active" badge on current tier and below; "Upgrade" button on higher tiers.
- Collapsible "What does Underwritten actually give AI that Certified doesn't?" section with side-by-side payload comparison (4 sections/11KB vs 8 sections/16KB, quarterly vs daily, etc.).

### Web of Truth Section (New Dashboard Tab)
- Created `WebOfTruthSection.tsx` — inline dashboard section replaces external navigation.
- Active state: Shows "Your Web of Truth is active" + list of platforms where it's placed + platforms where it should be added.
- Inactive state: Shows checklist of all platforms with instructions for each + "Enable Your Web of Truth" button.

### Badge Instructions Page Updates
- Header changed to "Your Web of Truth is now enabled" with green banner + "Follow the directions below to maximize your AIFS."
- Added Realtor.com and RealTrends/Tom Ferry sections.
- Removed sales CTAs — page is purely instructional.
- Fixed `htmlSnippet` undefined bug, added `ChevronRight` import.
- Page now looks up by `dashboard_token` in addition to `verification_token`.

### CRM List Maker — AI Surfaces Merge Fields
Added to mail merge:
- `{{ai_surfaces_total}}` — Total surfaces (7d)
- `{{ai_surfaces_human}}` — Human-initiated (ChatGPT-User, OAI-SearchBot, PerplexityBot, YouBot)
- `{{ai_surfaces_meta}}`, `{{ai_surfaces_google}}`, `{{ai_surfaces_apple}}`, `{{ai_surfaces_perplexity}}`, `{{ai_surfaces_chatgpt}}`, `{{ai_surfaces_claude}}`, `{{ai_surfaces_bing}}`, `{{ai_surfaces_gptbot}}`, `{{ai_surfaces_other}}`
- `{{ai_surfaces_top5_bots}}` — Top 5 bot names (comma-separated)
- Pulls from pre-computed `agent_ai_surfaces_by_bot` table (7d rolling, cron daily 04:00 UTC).

### Crawl-Stats Market Query Fixed
- Old: JOIN-based counting via `agent_id` → `professionals.business_city`. Under-counted by ~60%.
- New: Page-path-based counting + agent counts via `served_cities`. 7-day filter added.
- Phoenix: 15,487 (old) → 34,590 (correct, 7d).

### Email Infrastructure
- Confirmed `gmail-send` edge function works for sending emails from `robert@top10lists.us`.
- Successfully sent staging links to mark@aryah.ai via CRM email infrastructure.

### Vercel Cost Analysis ($620/month)
- **$212 build minutes** — 2,251 commits in billing period. Biggest cost driver.
- **$137 edge requests (73M)** — Mostly SPA assets, not bots.
- **$88 function invocations (146M)** — Inflated by log drain feedback loop (drain function logs its own execution → generates new log → triggers another drain).
- **Bot crawls are cheap** — 1M/week would add only ~$15-20/month.
- **Fix priorities**: (1) Reduce commit frequency / batch pushes. (2) Remove console.log from log drain to kill feedback loop. (3) Consider moving bot detection out of log drain entirely.

## Config / Infrastructure
- **pg_cron**: `rollup-agent-ai-surfaces` updated to use 7-day filter. Runs daily 04:00 UTC.
- **Edge function**: `serve-bot-crawl-stats-html` redeployed with page-path-based market query + 7-day filter.
- **Vercel ignore script**: Working correctly but even skipped builds consume container spin-up time.

## New Rules
- **⚠️ NO PUSHES TO STAGING OR PROD WITHOUT ROBERT'S EXPRESS PERMISSION. ALL DEV ON LOCALHOST.**
- **Numbers must foot**: Dashboard, crawl-stats, and cron all use `crawled_at >= now() - interval '7 days'`. Any published number must use the same methodology.
- **Web of Truth available to all tiers** — no tier gating.
- **Badge instructions page is instructional only** — no sales CTAs.

## Deprecated or Removed
- "Badge & sharing" nav label → now "Web of Truth"
- "AI Max Plan" nav label → now "Optimize"
- Listed tier removed from score projections
- Old 5×25=125 pillar weights → now Identity 25, Citability 25, Social 20, Authority 15, Technical 15 = 100
- Old crawl-stats market query (JOIN-based, no time filter)
