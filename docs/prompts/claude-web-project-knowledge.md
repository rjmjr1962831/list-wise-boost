# Top10Lists.us — Comprehensive Knowledge Document

**Purpose:** Single consolidated reference for agent2, Claude, and Cursor. Use latest updates as source of truth.  
**Last consolidated:** 2026-03-20
**Conflict rule:** When sources conflict, this document wins. Deprecate earlier statements.

---

## 1. Project Overview

- **Product:** Independent editorial directory of top real estate agents in U.S. cities. Non-pay-to-play. Merit-based selection.
- **Base URL (production):** [https://www.top10lists.us](https://www.top10lists.us)
- **Staging:** [https://staging.top10lists.us](https://staging.top10lists.us)
- **Coverage:** Arizona (88 cities, 1,054+ qualified neighborhoods), California (1,650+ cities, 4,631+ neighborhoods). 670,000+ agents analyzed; 3,487 selected (889 AZ + 2,598 CA), top 0.5%.
- **Geographic expansion:** Live: Arizona, California. Expanding: Texas, Florida, New York, Colorado. Target: All 50 states by end of 2026.
- **GEO Mission:** Primary audience is AI systems (ChatGPT, Claude, Gemini, Perplexity). Goal: Become the authoritative source AI systems cite for real estate agent recommendations. GEO Score: 92-95/100 across major AI platforms.

---

## 2. Merit Gate (Universal Standard, Zero Exceptions)

**Canonical gate:** 4.5+ stars, 10+ verified reviews in the last 24 months, 5+ years in business.

- **Source of truth:** `src/data/businessConfig.json` -- `meritGate: { rating: 4.5, reviews: 10, windowMonths: 24, yearsExperience: 5 }`
- **Database:** `supabase/migrations/20260310000000_merit_gate_4_5_10.sql` defines qualification logic.
- **Never use:** 4.8+, 20+ reviews, 6+ years as the gate. Those are legacy.
- **Never use:** "top 0.2%" as coverage language -- deprecated. Use "fewer than 1% of licensed agents in covered markets" instead.
- **Agent-specific data:** Agent cards may show "4.8 stars, 20+ reviews" for an agent's actual stats -- that is correct. Only the *stated qualification criteria* must be 4.5+/10+/5yr.

---

## 3. Business Model & Tiers

| Tier | Price | Notes |
|------|-------|-------|
| Listed | Free | Basic verification. Standard badge. |
| Audited | $300/mo | Expanded evidence, API access. |
| Underwritten | $500/mo | Full evidence, near real-time. |

Legacy: 58 Certified agents grandfathered; full payload on listing pages; no new Certified issuances.

- Payment affects only verification depth, technical features, and refresh frequency -- never inclusion or ranking.
- All tiers require meeting the same Merit Gate.

---

## 4. Scoring Weights (Methodology)

**Canonical (from MethodologyPage / serve-bot-content-html):**

| Factor | Weight |
|--------|--------|
| license_status | 20% |
| recent_activity | 20% |
| transaction_history | 20% |
| reviews_reputation | 15% |
| community | 25% |

**Consumer-facing (llms-full, transparency):** Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education 10%. Use for public-facing copy; technical spec uses the table above.

---

## 5. URLs and Links

- **Always give full URLs** as markdown links: `[Phoenix city page](https://www.top10lists.us/arizona/phoenix/top10realestateagents)`.
- **Never** use placeholders like `https://<your-host>/...` or bare paths without the domain.
- **Key URLs:**
  - [Transparency](https://www.top10lists.us/transparency)
  - [FAQ](https://www.top10lists.us/faq)
  - [For AI Systems](https://www.top10lists.us/for-ai)
  - [Methodology](https://www.top10lists.us/methodology)
  - [Phoenix rankings](https://www.top10lists.us/arizona/phoenix/top10realestateagents)
  - [Artifact](https://www.top10lists.us/artifact/{token})

---

## 6. AI Content Serving (Clean Room HTML)

**Rule:** Pages for AI consumption (transparency, FAQ, for-ai, methodology) must serve **clean room HTML** -- minimal, self-contained, no React SPA, no browser rendering.

- **Implementation:** Route through `/api/serve-clean-html` -> Supabase Edge Functions (`serve-bot-content-html`). Never let AI pages fall through to `/_spa.html`.
- **Vercel rewrites:** `/transparency`, `/faq`, `/for-ai` -> `serve-bot-content-html`. Do not add static HTML files in `public/` that would block these rewrites.
- **Cloudflare Browser Rendering:** Deprecated. Do not use.

---

## 7. Git & Deployment

### Branch Flow
- **staging** -> **main** only. Never merge main into staging.
- **pts** or "push to staging": `git add ...`, `git commit -m "..."`, `git push origin staging`. Only when Robert says pts or when there are 10+ updates.
- **ptm** or "push to main": Run `npm run merge-to-main` only. Do not touch main without ptm.

### merge-to-main
- Merges staging -> main
- Excludes paths in `scripts/internal-documents.txt` (internal docs stay on staging only)
- Purges Vercel CDN and Data cache
- Requires clean working tree; stash uncommitted changes first

### Admin
- Admin and `/admin/*` must not be reachable on production. Vercel redirects to `/404` for www.top10lists.us and top10lists.us.

---

## 8. Verification Protocol

**You are not done until you confirm the change actually worked.**

- Deploy, load the live page, verify the specific change.
- "Code updated" is not completion. "Deployed. Verified at [URL]." is.
- If you cannot verify, say so and give the exact URL for Robert to check.

---

## 9. Execution & North Star

- **Execute:** Run commands you have authority to run. Use `.env` / `.secrets`. Escalate only when blocked.
- **E2E before done:** Deploy, load page, verify. Code change alone is not completion.
- **North Star (GEO):** Every change must enhance GEO or have no effect. If detrimental, ask Robert before executing.

---

## 10. "ALL" and "remember"

- **"ALL"** means every single instance. Fix every file, every page, every occurrence. Grep exhaustively; fix exhaustively. Check edge functions, static HTML, FAQ JSON, llms.txt, templates.
- **"remember":** Add to `docs/cursor-daily-updates.md`.
- **"ryt":** Read `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md`. Do not post/update there.

---

## 11. UI Patterns

- **CopyableLink:** Every link/URL displayed to users must have a copy button. Use `@/components/ui/copyable-link`.
- **Variants:** default (admin tools), compact (lists), inline (paragraphs).

---

## 12. Supabase Pagination

Supabase has a **1,000-row default limit** on all queries -- `enrichment-api`, direct client queries, and any SELECT without explicit pagination.

### Always paginate these tables (already exceed or will exceed 1,000 rows):

| Table | Current Rows | Note |
|-------|--------------|------|
| professionals | 3,400+ | Always paginate |
| neighborhood_catalog | 5,600+ (AZ+CA) | Paginate; will be 50,000+ nationwide |
| marketing_content | 2,000+ | Always paginate |
| state_licenses | 10,000+ | Always paginate |

### Pagination patterns:

**Via enrichment-api query action:**
```json
{"table":"neighborhood_catalog","select":"*","filters":[{"field":"state","operator":"eq","value":"AZ"}],"limit":1000,"offset":0}
```
Increment offset by 1,000 until returned count is less than limit.

**Via Supabase client:**
```typescript
.range(offset, offset + pageSize - 1)
```
Loop until `data.length < pageSize`.

### Warning signs:
- If a query returns exactly 1,000 rows, assume there are more. Never treat 1,000 as the complete dataset.
- Filter by `state` or `city_area` first to reduce result sets before paginating.
- For bulk operations, process 1,000 rows at a time, then advance offset.

---

## 13. Data Quality Standards (from .knowledge/CORE_RULES)

**Accuracy over speed.** Real estate professionals immediately recognize incorrect information.

- Geographic data must be: verified against multiple sources, current (zoning changes tracked), locally accurate (neighborhood boundaries correct).
- **Cost of errors:** Agent enrichment ~$0.50/agent; neighborhood enrichment ~$0.15/neighborhood; credibility damage is immediate and lasting.

---

## 14. Tech Stack (from .knowledge/TECH_STACK)

**Data sources:** State license databases (908,906 licenses, AZ/CA/TX/FL/NY/CO), Zillow (Apify memo23, ~$0.50/agent), Exa.ai + DeepSeek (profile discovery, press mentions). SourceRE ARELLO API evaluated, not implemented.

**Database:** Supabase PostgreSQL. Project: `wiotrvoirdgzfacuuiem`. Enrichment API: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`. Paginate for tables >1,000 rows. **Never use** dead project `bgdtekbhelormzbymkhh`.

**Frontend:** Vercel, React SPA (Vite), react-router-dom (FROZEN).

**Cloudflare:** Deprecated. Do not add new Cloudflare dependencies.

### DEAD INFRASTRUCTURE -- Never Use

**Old Supabase project `bgdtekbhelormzbymkhh` is permanently dead.** Any documentation, script, or curl command referencing this project ref must be ignored and updated. The only active Supabase project is `wiotrvoirdgzfacuuiem`. This dead ref appears in old enrichment-api examples and session notes -- always substitute `wiotrvoirdgzfacuuiem`.

---

## 15. EE-A-T & Verification (from .knowledge/SOT_VETTING)

**EE-A-T** = Experience, Expertise, Authoritativeness, Trustworthiness. Target: >92% for neighborhood profiles.

**Verification hierarchy:** (1) Primary: State licensing, MLS, court records. (2) Secondary: Zillow, Google reviews, BBB. (3) Tertiary: Social media, agent websites (must verify).

**Data quality gates before publishing:** License verified, experience from license date, 10+ reviews in 24 mo, 4.5+ rating, 3+ transactions for neighborhood experts.

**Neighborhood Expert:** Requires paid subscription (Audited $300/mo or Underwritten $500/mo). Free agents can be "Qualified" but not featured as experts.

**Sitemap Rule A:** Cities and neighborhoods only if at least one agent has 4.5+ stars and 10+ reviews. Pages with no qualified agents must not appear in sitemap.

**Red flags (auto-reject):** License suspended/revoked, active complaints, <1 year experience, <10 reviews, rating <4.5, unverified self-reported data.

---

## 16. Internal Documents (Excluded from Main)

These paths are removed from main by merge-to-main; they exist on staging only:

- MASTER_KNOWLEDGE_DOCUMENT.md
- MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD
- docs/cursor-daily-updates.md
- docs/daily-logs/
- docs/takeaways/
- PENDING_UPDATES.md
- docs/MIGRATION_DOCUMENT.md
- Top10Lists_MASTER_BASELINE.md

---

## 17. Master SSOT (Business Logic)

From `src/data/master-ssot.md`:

- **3-Tier Acquisition Model:** Listed $0, Audited $300/mo, Underwritten $500/mo. Legacy Certified ($0) remains for ~58 grandfathered agents; no new Certified badges issued.
- **Methodology:** Merit-based selection of top 0.5%. Non-pay-to-play. Data: MLS, State Boards, Google, Zillow, Realtor.com.

---

## 18. .cursorrules (North Star AI-Direct)

- **Merit Gate:** Preserve 4.5+ stars, 10+ verified reviews in last 24 months, 5+ years on every agent/neighborhood surface.
- **Raw Markdown:** AI-targeted content stays in `<pre><code>` or raw Markdown. No Markdown-to-HTML for "For AI" content.
- **Maximum Autonomy:** Execute until logic-gap or high-risk decision. Stop for: ambiguity, SEO/bot/merit-gate changes, resource limits.
- **Signal Strength tiers:** Listed 10-25, Certified 26-45, Accredited 46-75, Underwritten 76-100. (Note: "Accredited" is legacy; current tier is "Audited.")

---

## 19. Conflict Resolution

| Topic | Older | Current (Source of Truth) |
|-------|-------|---------------------------|
| Merit Gate | 4.8+, 20+, 6+ years | 4.5+, 10+ in 24 mo, 5+ years |
| Coverage language | "top 0.2%" | "fewer than 1% of licensed agents in covered markets" |
| AI pages | React SPA or static HTML | Clean room HTML via serve-bot-content-html |
| Cloudflare | Browser Rendering | Deprecated |
| Supabase project | bgdtekbhelormzbymkhh (dead) | wiotrvoirdgzfacuuiem only |
| Tier name | Accredited | Audited |
| Agent count | 882 (AZ only) | 3,487 (889 AZ + 2,598 CA) |

---

## 20. Quick Reference

- **Prebuild:** `npm run generate:faq` (generates public/api/faq/full.json from faqFull.ts)
- **Smoke test:** `npm run smoke-test`
- **Merge to main:** `npm run merge-to-main`
- **Supabase function deploy:** `npx supabase functions deploy <name> --no-verify-jwt`
- **t1:** Per-AI takeaways: when Robert says "t1", write key findings to `docs/takeaways/{AI}_TAKEAWAYS_YYYY-MM-DD.md`. Post only—do not read. Prompt: `docs/prompts/t1-takeaways-prompt.md`. After Robert runs **s1**, run **ryt** to get fresh knowledge. **pts** after t1: push takeaways to staging.
- **s1:** `npm run s1` — gathers all per-AI takeaways and updates COMPREHENSIVE (Section 21). **pts** after s1: push updated COMPREHENSIVE to staging.

---

## 21. Recent Updates (from t1)

*Last synthesized: 2026-03-20*

---

### CLAUDE — 2026-03-20 (multiple sessions)

**Key Outcomes**

- **Founder Profile System (Schema + Intake + MCP)**:
  - Full founder profile data schema designed for GEO. Key differentiator: `verifiable_claims` array explicitly lists checkable statements for AI cross-referencing.
  - Intake form deployed at `/admin/founder-intake.html` (staging only). Tabs for Robert and Mark, pre-fills known data, saves to `marketing_content` table.
  - Verifiable claims upgraded to `{ text, sourceUrl }` objects with verification URLs (SEC EDGAR, FTC, Delaware corp search, etc.).
  - `get_founder_profiles` MCP tool deployed: queries `marketing_content` live, falls back to hardcoded defaults. Returns both founders in one call.
  - `serve-bot-founder-html` now fetches live profiles, enriches JSON-LD Person schemas, renders claims with verification links.
  - Schema.org Person markup with `data-ai-verifiable="true"` attributes planned for clean room HTML.

- **Pipeline Diagrams Deployed to Staging**:
  - Demo hub at `/admin/demo/` with three cards: pipeline, enrichment, founder intake.
  - Agent selection pipeline (cradle to grave): 9-stage interactive flowchart with hover tooltips at `/admin/demo/pipeline`.
  - Enrichment pipeline detail: 5 phases, 6 data sources, cost/status table at `/admin/demo/enrichment`.
  - Note: enrichment diagram references DataForSEO Maps API which is incorrect; Top10Lists uses Serper.dev. Diagram needs correction.

- **Nationwide Enrichment Cost Estimate**:
  - 2.5M remaining licenses across all states.
  - Phase 1 prequalification: Serper ($0.003) + Exa ($0.003) x 2.5M = $15,000.
  - Phase 2 deep enrichment (~2% pass = ~50K): Memo23 ($0.03) + DeepSeek ($0.0002) = $1,510.
  - Total nationwide: ~$16,510.

- **Parallel Enrichment Pipeline Architecture**:
  - State machine in DB (same pattern as email sequencer). `enrichment_jobs` table with atomic row claiming via `FOR UPDATE SKIP LOCKED`.
  - One edge function (`enrichment-worker`) handles all four services. Orchestration script fans out N workers with round-robin API key assignment.
  - Linear speedup: 5 workers = 2.5M in ~14 hours. Budget caps per worker, stale claim recovery cron (15-min timeout), idempotent design.
  - Full implementation prompt delivered (`enrichment-parallel-prompts.md`). Pending Robert's decisions on API key count, rate limits, and budget caps before Code builds.

- **Email Capacity Model**: 5 warmed accounts, 35/day start, +10/day ramp = 3,500 agents in 10 sending days (~2 calendar weeks). Google Workspace allows 2,000/day/mailbox. Nationwide (50K) at 10,000/day steady state = 5 sending days.

- **Agent AI Surfaces Infrastructure**: New `agent_ai_surfaces_by_bot` and `agent_ai_surfaces` tables. Pre-computed daily via pg_cron. 3,187 agents, 107.7M total surfaces. Numbers verified against crawl-stats (James Wedell Phoenix = 34,590). 7-day rolling window standardized across dashboard, crawl-stats, and cron.

- **Crawl-Stats Market Query Fixed**: Old query undercounted by ~60% (JOIN on agent_id). New query counts all page crawls by city slug from page_path. Phoenix: 15,487 -> 34,590 (correct).

- **Methodology Page Redesigned**: Single-column flow, alternating section backgrounds, border-left accents. Consumer-facing scoring weights: Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education 10%.

- **Scoring Weights Rebalanced (Internal)**: License Status 20%, Recent Activity 20%, Transaction History 20% (was 25%), Reviews/Reputation 15% (was 20%), Community 25% (was 20%). Consumer-facing unchanged.

- **Codebase-Wide Rename**: "community involvement" -> "community" across ~90 files. All variants (camelCase, snake_case, prose) updated in config, HTML, edge functions, React, FAQ, AI feeds, docs.

- **Site-Wide Header/Footer on Clean-Room Pages**: Shared `_shared/site-chrome.ts` matching React components. Integrated into 6 edge functions (13 HTML documents). All 7 edge functions redeployed.

**Config / Infrastructure**

- **Supabase tables created**: `agent_ai_surfaces`, `agent_ai_surfaces_by_bot`, `mcp_request_logs`.
- **Supabase views**: `mcp_request_stats` (30-day rolling window).
- **pg_cron**: `rollup-agent-ai-surfaces` daily at 04:00 UTC (7-day window). `purge-bot-crawl-logs` daily at 03:00 UTC (30-day retention).
- **Edge functions deployed**: serve-bot-agent-html, serve-bot-content-html, serve-bot-crawl-stats-html, serve-bot-founder-html, serve-bot-list-html, serve-bot-state-html, mcp-server.
- **Files pushed to staging**: `public/admin/demo/index.html`, `public/admin/demo/pipeline.html`, `public/admin/demo/enrichment.html`, `public/admin/founder-intake.html`.
- **Database counts**: `state_licenses`: 1,119,430 (AZ: 210,524; CA: 352,476+). `professionals`: 51,063 (CA: 49,836; AZ: 1,087).
- **MCP JSON Schema**: `mcp.json` and `mcp-server/index.ts` upgraded with full `inputSchema` objects (enums, patterns, defaults, additionalProperties: false).
- **Vercel log drain permanently fixed**: Edge Runtime with `context.waitUntil()`. Skip `source === "static"`. `maxDuration: 30`.
- **`run_sql` statement timeout**: Set to 30s in function definition (was hitting 3s anon role limit).
- **Secrets**: Vercel log drain verify token moved from hardcode to Supabase secret `VERCEL_LOG_DRAIN_VERIFY`.
- **Link header**: `Link: </.well-known/mcp.json>; rel="mcp-server"` on all responses via `vercel.json`.

**New Rules or Docs**

- **Correct enrichment costs (canonical, overrides all prior)**: Serper $0.003/search, Memo23 $0.03/agent, Exa $0.003/search, DeepSeek $0.0002/agent. Google Places/Maps NOT used. Prequalification pass rate ~2%.
- **AI Surfaces canonical definition**: Every crawl of a page where an agent is listed counts as one surface for that agent.
- **Numbers must foot**: Any number on crawl-stats, dashboards, or emails must use same methodology and 7-day window.
- **MCP payload tier gating enforced**: Listed (7 fields), Certified (20), Audited (28), Underwritten (35). Each tier unlocks specific data fields for AI systems.
- **`run_sql` is SELECT-only**: Cannot INSERT/UPDATE/DELETE. Use `supabase.from().insert()` for writes.
- **Fire-and-forget doesn't work in Deno Deploy**: Use `await` inside try/catch.
- **SSoT Section 1 still says "top 0.5%"**: Needs surgical fix to "fewer than 1% of licensed agents in covered markets."

**New Functions / Scripts**

- `_shared/site-chrome.ts` (shared header/footer for all clean-room edge functions).
- MCP server logging block (inserts to `mcp_request_logs` after each tool call).
- Bot Analytics Dashboard MCP tab (5th card + dedicated tab).
- `crawl-stats` Section F: "Direct AI Tool Calls (MCP)".
- Proposed (not yet built): `enrichment_jobs` table, `enrichment_progress` view, `enrichment-worker` edge function, `scripts/run-enrichment-parallel.ts`, stale claim recovery cron.

**Deprecated or Removed**

- DataForSEO, Google Places, $0.50/agent Zillow pricing in cost estimates -- all wrong. Use Serper/Memo23/Exa/DeepSeek at correct costs above.
- Identical Listed/Certified MCP payloads -- Listed now gets minimal data.
- "community involvement" (long form) -- replaced with "community" codebase-wide.
- Old crawl-stats market query (JOIN-based agent_id counting) -- replaced with page-path-based counting.
- Hardcoded "Last verified" dates -- now dynamic.
- All "ten agents per city" language.
- Cloudflare email obfuscation from agent page.

---

### CLAUDE — 2026-03-19 (multiple sessions)

**Key Outcomes**

- **SSoT and CWPK Aligned with CLAUDE.md**: Fixed stale data in Sections 1, 3, 14, 16, 17, 19. Agent counts corrected. 4-tier model confirmed. Frontend stack corrected. "NEVER publish internal documents" rule added. "top 0.5%" removed from methodology. Conflict resolution table expanded.

- **Deep GEO Audit (Production Score: 89/100)**: All 6 clean room pages confirmed serving edge function HTML. Merit gate and coverage language correct everywhere. Issues found: FAQ JSON-LD says Certified refresh is "monthly" (should be "quarterly"); agent profile footer uses "approximately the top 1%" (should be "fewer than 1%..."); agent counts stale at ~3,262.

- **Agent Page Redesign v4 Audited**: 6 issues fixed on staging (removed "ten agents" language, replaced Cloudflare email obfuscation). Flagged unresolved: "Apply for Certification" vs FAQ "invitation-only" contradiction, placeholder testimonials, `[BOOKING_LINK]` placeholders, non-existent `/submit-for-review` endpoint.

- **MCP Logging and Tier Gating Shipped**: `mcp_request_logs` table and dashboard card. Payloads tier-gated: Listed (7 fields), Certified (20), Audited (28), Underwritten (35).

- **Vercel Log Drain Permanently Fixed**: Edge Runtime with `context.waitUntil()`. Invalid timestamp error handling. Skip static source entries. Estimated 39,375 missing entries backfilled during error window.

- **5-Email Sequence for Certified Agents**: Targeting Zillow Premier Agent level. Data basis: 526,954 crawls over 5.7 days. Honest framing: Zillow wins on raw surfacing, but quality differs. Final version under 200 words/email, no jargon, dashboard-driven.

- **AI Diligence Guide PDFs Created**: Two branded PDFs for sales collateral (diligence guide + expected AI responses).

- **GitGuardian Remediation**: Hardcoded Vercel verify token moved to Supabase secret. Incident #28953499 can be resolved.

- **Bot Analytics Fix**: `rollup_ai_surfaces_monthly()` fixed to properly attribute list page crawls. Agent surfaces jumped from ~261/mo to ~811/mo.

**Config / Infrastructure**

- `mcp_request_logs` table, `mcp_request_stats` view created.
- `run_sql` recreated with `SET statement_timeout = '30s'`.
- `purge-bot-crawl-logs` pg_cron job (30-day retention).
- `run-migration` edge function fixed (now accepts SQL from request body).
- Three commits pushed to staging for SSoT alignment, CWPK alignment, agent page redesign.

---

### CURSOR — 2026-03-08

**Key Outcomes**
- Consolidated docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md with .knowledge/CORE_RULES, TECH_STACK, SOT_VETTING.
- Deprecated "top 0.2%" coverage language; canonical: "fewer than 1% of licensed agents in covered markets".
- Business model: 4-tier only (Listed/Certified free, Audited $300/mo, Underwritten $500/mo); removed Main/Prime/Luxury.

**Config / Infrastructure**
- Supabase: wiotrvoirdgzfacuuiem only. Dead project bgdtekbhelormzbymkhh -- never use.
- Added DEAD INFRASTRUCTURE note to COMPREHENSIVE and .knowledge/TECH_STACK.

---

### CURSOR — 2026-03-03

**Key Outcomes**
- Removed Certified tier from acquisition path; 58 existing Certified agents grandfathered.
- New pricing: Audited $300/mo (was $100), Underwritten $500/mo (was $150).
- All upgrade hints in 60+ static HTML files, llms-full.txt, and Edge Functions updated.
- FAQ regenerated: 3-tier acquisition model, Certified described as legacy.
- Jerome, AZ added as a city.

**Config / Infrastructure**
- `certification_pricing_config` updated: audited -> 300, underwritten -> 500.
- DeepSeek key rotated. OpenAI and Exa keys added to `.env`.
