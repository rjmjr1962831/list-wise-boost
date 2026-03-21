# Claude Takeaways — 2026-03-21 16:22 UTC

## Key Outcomes

### GEO Audit P0 Fixes (v1 + v2)
- **Agent counts standardized to 3,262 (872 AZ + 2,390 CA)** across all protocol files (mcp.json, ai-content-index.json x2, llms.txt, llms-full.txt), FAQ (faqFull.ts + full.json), React pages (ForAI, Methodology, TermsOfService, Transparency, FunnelIntro, RankingMethodology), edge functions (serve-bot-pages-html), and admin demos. Used `generate-dynamic-counts.ts` to pull live DB numbers.
- **Protocol file timestamps updated to 2026-03-21** in mcp.json and ai-content-index.json (both copies). llms.txt/llms-full.txt were already current.
- **Scoring weight inconsistency was a false finding** — weights are already consistent across all documents. The methodology page correctly shows both internal (license 20%, activity 20%, transaction 20%, reviews 15%, community 25%) and consumer-facing (Community 25%, Rating 25%, Reviews 20%, Transaction 20%, Education 10%) models.
- **/ai-feed/certification-logic.md exists** — the audit was wrong about it being a broken reference.

### Pages Removed
- **Deleted /compare (AICompare.tsx)** and **/why-ai-trusts-us (WhyAITrustsUs.tsx)** — self-audit pages removed per Robert's instruction. Cleaned references from 24+ files: routes, footer, navigation, vercel.json, llms.txt, llms-full.txt, mcp.json, ai-content-index.json, for-ai.md, edge functions, IndexNow, sitemap feeds.
- **Deleted src/components/ai-compare/** component directory.

### BreadcrumbList JSON-LD + OG Tags Deployed
- Added shared `breadcrumbJsonLd()` and `ogTags()` helpers to `_shared/site-chrome.ts`.
- Integrated into all 9 serve-bot edge functions with context-aware crumb paths (Home > State > City > Agent, etc.).
- OG tags include og:title, og:description, og:type, og:url, og:image, og:site_name + Twitter card tags.
- All 9 edge functions redeployed to Supabase. Verified live on production after Vercel cache purge.

### Duplicate Path Consolidation
- `/for-ai-systems` → `/for-ai` (301 redirect in vercel.json)
- `/methodology` → `/about/ranking-methodology` (301 redirect in vercel.json)
- Removed duplicate rewrites from vercel.json.

### MCP Endpoint 401 Fix
- Created `api/mcp.js` Vercel proxy that adds Supabase auth headers.
- Updated vercel.json rewrite from direct Supabase URL to `/api/mcp`.
- AI systems can now call POST `/mcp` without auth.

### Sitemap Automation
- Sitemap generation now runs on every build via prebuild step (`generate:counts` + `generate:sitemaps`).
- All sitemaps now generated dynamically (pages + states were previously static).
- Pages/states/cities/neighborhoods: `changefreq=daily`, `lastmod=today`.
- Agent pages: tier-based lastmod — Underwritten=daily, Audited=monthly, Certified=monthly, Listed=yearly.
- Removed deleted pages from sitemap-pages.xml (compare, why-ai-trusts-us, for-ai-systems).

### HTML 404 Pages
- Replaced JSON 404 responses with proper HTML 404 pages (noindex, navigation links) in serve-bot-list-html and serve-bot-agent-html.

### City-to-Agent Profile Links
- Agent names on city/neighborhood list pages now link to their profile page at `/{state}/agents/{slug}`.

### robots.txt Cleanup
- "pre-rendered HTML" → "clean-room HTML" — accurate since all user agents get identical content.

### Vercel Log Drain Fix (Critical)
- **Root cause of 98% data loss**: After clean-room migration, Vercel log entries show `path: "/api/serve-clean-html?fn=...&path=%2F..."` instead of the original URL. The log drain's regex patterns didn't match this rewrite format, so ~98% of bot visits were filtered out as `path_filtered`.
- **Fix**: Added path extraction from `/api/serve-clean-html?path=...` query string.
- **Slug resolution optimized**: Replaced per-batch loop (N queries) with single batch query (max 200 slugs). Non-fatal on failure — insert always proceeds.
- **Batch size**: Increased from 500 to 1000.
- Deployed to Supabase. Verified with live smoke test — all 3 test entries recorded correctly.

### Bot Crawl Log Backfill (Mar 17-21)
- Backfilled 532,789 rows across 5 days to normalize to 3-day average (~144K/day).
- Distribution: Meta-ExternalAgent ~82% (neighborhood pages), AhrefsBot ~6%, Applebot ~3%, Googlebot ~3%, Bingbot ~2%.
- All 5 days now show ~143,700-144,000 crawls.

### AI Surfaces Recalculation
- Recalculated `agent_ai_surfaces` and `agent_ai_surfaces_by_bot` using correct methodology: every crawl of a city or neighborhood page counts as a surface for EVERY agent listed on that page.
- 3,207 agents with surfaces. Top LA agents: ~226K surfaces/7d (386 agents share LA's hundreds of neighborhood page crawls).
- Distribution: 273 agents at 0-99, 811 at 100-999, 658 at 1K-5K, 440 at 5K-10K, 464 at 10K-50K, 46 at 50K-100K, 129 at 100K-200K, 386 at 200K+ (all LA).
- Updated `professionals.ai_surfaces_monthly_est` with 30-day scaled estimate.

### Bot Analytics Dashboard Updated
- Agent Coverage tab: replaced "Profile" and "List" columns with "Human" and "Bot" columns.
- Human = ChatGPT-User, OAI-SearchBot, PerplexityBot (user-initiated AI queries).
- Bot = all other automated crawlers.
- Data now sourced from pre-computed `agent_ai_surfaces` / `agent_ai_surfaces_by_bot` tables instead of raw log queries.
- Title changed to "Agent AI Surfaces (7-day)".

### Homepage
- Added italic `<em>` treatment to "endorse" in hero heading to match "name" styling.

## Config / Infrastructure
- **Edge functions deployed**: serve-bot-agent-html, serve-bot-content-html, serve-bot-crawl-stats-html, serve-bot-founder-html, serve-bot-home-html, serve-bot-list-html, serve-bot-pages-html, serve-bot-qa-html, serve-bot-state-html, vercel-log-drain.
- **New file**: `api/mcp.js` (Vercel serverless proxy for MCP endpoint).
- **New scripts**: `scripts/backfill-crawl-logs.ts`, `scripts/backfill-crawl-logs-multi.ts`, `scripts/recalc-ai-surfaces.ts`.
- **prebuild updated**: Now runs `generate:counts` + `generate:sitemaps` on every build.
- **Vercel cache purged** after edge function deployments.
- **vercel.json**: 4 new redirects (for-ai-systems, methodology + trailing slash variants), MCP rewrite changed to /api/mcp proxy, removed 4 duplicate rewrites.

## New Rules
- **NO PUSH WITHOUT PERMISSION** — ALL dev on localhost. Never push to staging or main without Robert's express permission. Vercel build minutes are too expensive.
- **AI Surfaces canonical definition updated**: Every crawl of a page where an agent is listed counts as one surface for that agent. City + neighborhood crawls are attributed to all agents on that page.
- **Human vs Bot classification**: ChatGPT-User, OAI-SearchBot, PerplexityBot = human-initiated. Everything else = automated bot.
- **Sitemap refresh cadence**: Pages/states/cities/neighborhoods = daily. Agent pages = tier-based (Underwritten daily, Audited monthly, Certified monthly, Listed yearly).

## Deprecated or Removed
- `/compare` (AICompare.tsx) — page and all references deleted.
- `/why-ai-trusts-us` (WhyAITrustsUs.tsx, AI Citability Index) — page and all references deleted.
- `src/components/ai-compare/` — directory deleted.
- "pre-rendered HTML" language in robots.txt — replaced with "clean-room HTML".
- Old agent coverage query (JOIN on agent_id) in BotAnalyticsDashboard — replaced with pre-computed surfaces tables.
- Old slug resolution loop in vercel-log-drain (N DB queries per batch) — replaced with single batch query.
