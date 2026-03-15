# Claude Code Session Takeaways -- 2026-03-15 21:10 UTC

## Session Summary

Large session covering three major work streams: GEO audit remediation, bot crawl merge field system for email campaigns, and AIFS (AI Fingerprint Score) implementation planning.

---

## 1. GEO Audit Fix -- Completed & Deployed

**Commit:** `2003c974` -- GEO audit fixes: resolve data contradictions across AI-facing surfaces

### What was done

A GEO audit prompt (scoring 78/100) was reviewed against the actual codebase. **9 of the prompt's claimed issues were already fixed** in prior sessions (faqFull.ts stale counts, em dashes, three-tier, monthly refresh, press weights, SPA FAQ JSON-LD). The prompt also had a **root cause error** on the 401 API issue -- it was a vercel.json routing bug, not a missing auth problem.

### Fixes deployed (edge functions live, vercel.json pushed to staging):

| Fix | File(s) | Status |
|-----|---------|--------|
| Certified tier on /for-ai -- "Legacy" changed to "Free, quarterly, open to all" | serve-bot-content-html | Deployed + verified |
| Both scoring models labeled on /transparency | serve-bot-content-html | Deployed + verified |
| llms-full.txt link added to /for-ai footer | serve-bot-content-html | Deployed + verified |
| Singular/plural "1 real estate agents" grammar | serve-bot-list-html | Deployed + verified |
| dateModified added to agent JSON-LD schema | serve-bot-agent-html | Deployed + verified |
| agents-search-api review threshold 50->10 (Merit Gate) | agents-search-api | Deployed + verified |
| agents-search-api dead URL format -> canonical | agents-search-api | Deployed + verified |
| /api/v1/agents/search 401 fix (vercel.json routing) | vercel.json | Pushed to staging |
| /coverage-stats endpoint (new edge function, live JSON) | coverage-stats + vercel.json | Deployed + verified |
| Missing URLs in push-indexnow | push-indexnow | Deployed |
| Deprecated "top 1%" language in ai-content-index.json | ai-content-index.json | Committed |
| Em dashes removed from llms.txt (25) and llms-full.txt (58) | llms.txt, llms-full.txt | Committed |
| geo-consistency-check script (npm run geo:check) | scripts/geo-consistency-check.cjs | All checks pass |
| changelog.json for AI re-crawlers | public/changelog.json | Committed |
| Dynamic counts refreshed | mcp.json, ai-content-index.json, llms files | 3,262 agents |

### Prompt errors documented for future reference:
- Section 1.2 root cause was wrong (routing, not auth)
- Section 1.5 was entirely stale (all issues already fixed)
- "press (15%)" weight never existed in faqFull.ts
- agents-search-api had two bugs not mentioned in the prompt (50-review threshold + dead URL format)

---

## 2. Bot Crawl Merge Fields -- Completed & Deployed

**Commit:** `532ae736` -- Bot crawl merge fields: email personalization + agent dashboard card

### Database changes (live):
- **View created:** `agent_bot_crawl_stats` -- rolling 30-day stats from bot_crawl_logs (221K+ rows)
- **Function created:** `rollup_bot_crawl_daily()` -- upserts into agent_bot_visit_summary
- **Cron scheduled:** `rollup-bot-crawl-daily` at 4am UTC daily
- **Initial rollup:** 3,163 agents populated

### Email merge field system:
- **Location:** `src/components/crm/ListMaker.tsx` -- merge happens at queue insertion time
- **Detection:** Only runs bulk fetch if template contains `{{variables}}`
- **Variables:** `{{first_name}}`, `{{full_name}}`, `{{bot_crawl_total}}`, `{{bot_crawl_profile}}`, `{{bot_crawl_list}}`, `{{bot_crawl_bots}}`, `{{bot_crawl_bots_count}}`, `{{city}}`, `{{profile_url}}`
- **Bot display mapping:** Filters SEO tools (AhrefsBot, semrushbot, DotBot), maps raw names to friendly (ChatGPT-User -> "ChatGPT", Meta-ExternalAgent -> "Meta AI")
- **Graceful fallback:** Zero-crawl agents get empty strings, not raw placeholders

### Agent dashboard component:
- **BotCrawlCard** (`src/components/agent/BotCrawlCard.tsx`) -- shows in OverviewSection
- Progress bar, crawl count, AI bot pills, profile vs list breakdown, contextual upsell
- Auto-hides if agent has zero crawls

### Admin preview page:
- **MergeFieldPreview** at `/admin/merge-preview`
- Top 50 agents by crawl count, searchable
- Click agent to see all merge fields resolved
- Live template editor with rendered preview
- Bot name mapping visualization (SEO bots shown struck-through)

### Note: render-email.ts already had interpolateTemplate()
The prompt stated "No merge variable support exists" -- this was wrong. `_shared/render-email.ts` already has `interpolateTemplate()` used at send time in sequencer-v2-tick. However, it was NOT used at queue insertion time (ListMaker copied template_html directly to html_body). The new code adds merge at insertion time, which is the correct place per the prompt's design.

---

## 3. AIFS (AI Fingerprint Score) -- Plan Only

**Commit:** `2ccf970a` -- AIFS implementation plan + scaffolding (not yet wired)

### Deliverables:
- `docs/plans/AIFS_IMPLEMENTATION_PLAN.md` -- full implementation plan for handoff
- `supabase/migrations/20260315000000_aifs_scores.sql` -- table schema
- `src/components/agent/AIFSGauge.tsx` -- dashboard component (already used by OverviewSection)
- `supabase/functions/batch-aifs-score/index.ts` -- edge function scaffold

### Key design decisions in the plan:
- SERPER_API_KEY already exists in .env (no new secrets)
- 5-min cron, 50 agents/batch, priority by tier refresh cadence
- Underwritten 1.4x multiplier on SERP portion only, capped at 60
- Serper raw JSON cached to avoid redundant API spend
- ~2,000 Serper queries/month (fits $50 plan)

---

## 4. City Bundles (Funnel Step 5) -- Diagnosed, Not Fixed

The funnel's "Select Cities" step (`Step5Cities.tsx`) only shows bundles for Arizona. California agents see "No bundles available" because:
- `arizonaPackages.ts` only defines AZ bundles
- Line 78: `if (stateFilter === 'arizona')` -- no else branch
- No `californiaPackages.ts` exists

**Decision needed:** Create CA bundles (requires knowing city slug groupings) or add individual city selection as fallback.

---

## 5. Process Notes

- **Dev server switched to localhost** -- Robert requested local dev to reduce Vercel build costs. Running at `http://localhost:8084/`.
- **run-ddl edge function** was already deployed from a prior session; used it for DDL operations (CREATE VIEW, CREATE FUNCTION, cron.schedule).
- **coverage-stats edge function** had a bug on first deploy (neighborhood_catalog.state uses full names "Arizona" not "AZ"). Fixed and redeployed.
- **geo:check** added to package.json as `npm run geo:check`. All 7 checks pass.

---

## Files Changed (This Session)

### Modified:
- `supabase/functions/serve-bot-content-html/index.ts`
- `supabase/functions/serve-bot-list-html/index.ts`
- `supabase/functions/serve-bot-agent-html/index.ts`
- `supabase/functions/agents-search-api/index.ts`
- `supabase/functions/push-indexnow/index.ts`
- `vercel.json`
- `public/llms.txt`, `public/llms-full.txt`
- `public/.well-known/ai-content-index.json`, `public/mcp.json`
- `public/api/faq/full.json`
- `package.json`
- `src/components/agent/OverviewSection.tsx`
- `src/components/crm/ListMaker.tsx`
- `src/routes/manifest.tsx`

### Created:
- `supabase/functions/coverage-stats/index.ts`
- `scripts/geo-consistency-check.cjs`
- `public/changelog.json`
- `src/components/agent/BotCrawlCard.tsx`
- `src/pages/admin/MergeFieldPreview.tsx`
- `supabase/migrations/20260315000000_bot_crawl_stats_view_and_rollup.sql`
- `docs/plans/AIFS_IMPLEMENTATION_PLAN.md`
- `supabase/migrations/20260315000000_aifs_scores.sql`
- `src/components/agent/AIFSGauge.tsx`
- `supabase/functions/batch-aifs-score/index.ts`
