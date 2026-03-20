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
| transaction_history | 25% |
| reviews_reputation | 20% |
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

### CLAUDE — 2026-03-19 & 2026-03-20

**Key Outcomes**
- **SSoT and Claude Web Project Knowledge Aligned**: Fixed stale data in both `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` and `docs/prompts/claude-web-project-knowledge.md`. Updates: Agent counts corrected to 3,274; 4-tier model with Certified active confirmed; Frontend stack corrected to "Static HTML + clean room HTML"; Added "NEVER publish internal documents to any public-facing HTTPS site" rule; Removed "top 0.5%" from methodology; Expanded conflict resolution table.
- **Deep GEO Audit (Production Score: 89/100)**: All clean room pages confirmed serving edge function HTML. Merit gate (4.5+/10+/5yr) and "fewer than 1%" language correct everywhere. Issues found: FAQ JSON-LD says Certified refresh is "monthly" (should be "quarterly"); Agent profile footer uses "approximately the top 1%" (should be "fewer than 1%..."); Agent counts stale at ~3,262 on edge pages.
- **Agent Page Redesign v4 Audited & Fixed**: Reviewed and fixed 6 issues on staging: Removed all "ten agents per city"/"10 spots" language; Replaced Cloudflare email obfuscation with plain `hello@top10lists.us`. Flagged unresolved issues: "Apply for Certification" vs. FAQ's "invitation-only" contradiction; Placeholder testimonials; `[BOOKING_LINK]` placeholders; Non-existent `/submit-for-review` endpoint.
- **MCP Logging & Tier Gating Shipped**: New `mcp_request_logs` table and dashboard card deployed. MCP payloads are now tier-gated: Listed (7 fields), Certified (20), Audited (28), Underwritten (35). Previously Listed and Certified were identical.
- **Vercel Log Drain Permanently Fixed**: Architecture changed to Edge Runtime with `context.waitUntil()` to prevent health monitor errors. Added error handling for invalid timestamps. Skip `source === "static"` entries (CDN cache hits).
- **Bot Analytics & Data Fixes**: Fixed `run_sql` statement timeout (set to 30s). Fixed bot crawl data rollup (`rollup_ai_surfaces_monthly()`) to properly attribute list page crawls, increasing average agent surfaces from ~261/mo to ~811/mo. Created `purge-bot-crawl-logs` pg_cron job (30-day retention).
- **GEO & Positioning Enhancements**: Added Link header `rel="mcp-server"` to all responses. Enhanced `/about` page with "trust infrastructure" positioning statement. Updated DynamicCategoryList H1 to "Best {category} in {city}, {state}". Added `data-ai-facts="true"` sr-only blocks to city/neighborhood pages. Added 3 new AI-focused FAQ entries.
- **Founder Page & Staging Fixes**: Fixed founder photos not serving on production (updated `vercel.json` SPA exclusion). Fixed staging deploy regression after rebase (updated ignore script). Removed internal-sounding "bank/credit bureau" paragraph from founders page.
- **Transaction Gate Analysis**: At 100 minimum verified transactions, 872 agents (26.6%) would be disqualified; at 50, 309 (9.4%). Transaction data is all-side (buy+sell combined from Zillow), not sell-side only. 248 agents have team stats included. Median is 196 transactions.
- **Gemini Merit Gate Hallucination**: Gemini still cites 4.8+ stars despite all live pages serving correct 4.5+. Issue is Gemini's parametric memory, not our content.
- **Freshness as AI Trust Signal -- Resolved**: AI systems do read verification dates and factor them into confidence. Evidence is behavioral -- Claude consistently flags stale dates as GEO deficiencies during audits. Defensible framing for tier model: "AI systems read verification dates and treat current data as more reliable."

**Config / Infrastructure**
- **Supabase**: `mcp_request_logs` table and `mcp_request_stats` view created. `run_sql` function recreated with `SET statement_timeout = '30s'`. `purge-bot-crawl-logs` pg_cron job added.
- **Secrets**: Hardcoded Vercel log drain verify token moved to Supabase secret `VERCEL_LOG_DRAIN_VERIFY`.
- **Vercel**: `vercel.json` updated: Added `maxDuration: 30` for log drain; Added `images` to SPA catch-all exclusion; Added global `Link` header for MCP discovery.
- **Edge Functions**: `run-migration` function fixed to accept SQL from request body (was broken). `vercel-log-drain` error handling improved. MCP server enhanced with typed JSON Schema `inputSchema` objects for machine-parsable validation.

**New Rules or Docs**
- **"NEVER publish internal documents to any public-facing HTTPS site"** rule added to SSoT Section 16 and CWPK.
- **"Ten agents per city" is wrong.** It's a brand name, not a cap. Remove all references.
- **MCP payload tier gating is now enforced.** Each tier unlocks specific data fields for AI systems.
- **`run_sql` does not support INSERT/UPDATE/DELETE** -- only SELECT. Use `supabase.from().insert()` for logging.
- **Fire-and-forget doesn't work in Deno Deploy** -- use `await` inside try/catch.
- **Required Reading**: Claude Web must load CLAUDE.md, SSoT, and CWPK at session start.
- **"Apply" vs "invitation-only"** is an unresolved GEO contradiction between the agent page redesign and the FAQ JSON-LD. One must change before both are live simultaneously.

**New Functions / Scripts**
- **MCP server logging block** added to MCP server function.
- **Bot Analytics Dashboard MCP tab** added.
- **`crawl-stats` Section F** updated with "Direct AI Tool Calls (MCP)" data.

**Deprecated or Removed**
- **Identical Listed/Certified MCP payloads** -- Listed now gets minimal data.
- **All "ten agents per city" language** removed from agent page redesign.
- **Cloudflare email obfuscation** removed from agent page (doesn't work on Vercel).
- **Hardcoded "Last verified" date** in NeighborhoodOverview -- now dynamic.
- **Placeholder strings in MCP payloads** replaced with actual data gating.

---

### CURSOR — 2026-03-08

**Key Outcomes**
- Consolidated docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md with .knowledge/CORE_RULES, TECH_STACK, SOT_VETTING.
- Deprecated "top 0.2%" coverage language; canonical: "fewer than 1% of licensed agents in covered markets".
- Business model: 4-tier only (Listed/Certified free, Audited $300/mo, Underwritten $500/mo); removed Main/Prime/Luxury.
- ryt: Read docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md; do not post there.
- t1: Per-AI takeaways, post only; s1: npm run s1 synthesizes into COMPREHENSIVE Section 21.

**Config / Infrastructure**
- Supabase: wiotrvoirdgzfacuuiem only. Dead project bgdtekbhelormzbymkhh -- never use.
- Added DEAD INFRASTRUCTURE note to COMPREHENSIVE and .knowledge/TECH_STACK.

**New Rules or Docs**
- docs/prompts/t1-takeaways-prompt.md -- per-AI takeaways, post only.
- docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md -- single SSoT; project-knowledge.mdc points to it.
- public/ai-feed/for-ai.md -- added Data Freshness subsection (paginated, live API data).

**New Functions / Scripts**
- scripts/s1-synthesize.ts -- npm run s1; gathers *TAKEAWAYS*.md, updates COMPREHENSIVE Section 21.

**Deprecated or Removed**
- "top 0.2%" as coverage language.
- Main/Prime/Luxury neighborhood pricing ($25/$50/$75).
- MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD -- now a pointer to COMPREHENSIVE.

---

### CURSOR — 2026-03-03

**Key Outcomes**
- Removed Certified tier from acquisition path; 58 existing Certified agents grandfathered.
- New pricing: Audited $300/mo (was $100), Underwritten $500/mo (was $150).
- Annual pricing updated to match: Audited $3,000/yr, Underwritten $5,000/yr.
- All upgrade hints in 60+ static HTML files, llms-full.txt, and Edge Functions updated to $300/$500.
- FAQ regenerated: 3-tier acquisition model, $300/$500, Certified described as legacy.
- RealTrends pricing: "$100" → "$195/year" across HomepageFAQSection, schema.org JSON-LD in 35+ HTML files.
- Jerome, AZ added as a city; city-content-enrichment run successfully.

**Config / Infrastructure**
- `certification_pricing_config` in Supabase updated live: audited → 300, underwritten → 500.
- Migration file: `supabase/migrations/20260315000000_audited_300_underwritten_500.sql`.
- DeepSeek key rotated; new key set in `.env` and as Supabase secret.
- OpenAI key added to `.env`; Exa key in `.env`; Perplexity key in Supabase secrets.

**New Rules or Docs**
- `docs/plan-remove-certified-tier.md` -- full plan for removing Certified + new pricing (internal, staging only).
- `docs/prompts/t1-takeaways-prompt.md` -- updated: merge instead of overwrite when file exists for the day.
- `scripts/s1-synthesize.ts` -- updated: runs pts after synthesis (commit + push staging).
- `src/data/master-ssot.md` -- updated to 3-tier acquisition model ($300/$500).
- `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` -- updated: 3-tier model, $300/$500, Neighborhood Expert requires $300/$500.
- AI feed docs updated: `tier-audited.md`, `tier-underwritten.md`, `tier-listed.md`, `tier-certified.md`, `vetting-standards.md`, `geo-performance.md`.

**New Functions / Scripts**
- `supabase/functions/create-agent-checkout/index.ts` -- `BADGE_PRICES: { audited: 300, underwritten: 500 }`; deployed.
- `supabase/functions/funnel-select-tier/index.ts` -- certified removed from `validTiers`; deployed.
- `supabase/functions/serve-bot-list-html/index.ts` -- upgrade hints updated to $300/$500; deployed.
- `scripts/add-jerome-and-enrich.ts` -- adds Jerome AZ and triggers city-content-enrichment.

**Deprecated or Removed**
- Certified tier no longer offered to new agents (acquisition path only; existing 58 agents grandfathered).
- `handleSelectCertified` removed from `Step7Pricing.tsx`.
- Certified option removed from `Step7Pricing.tsx` tier list.
- `DEFAULT_PRICES` in `Step7Pricing.tsx`: certified entry removed; audited 300, underwritten 500.
- Four-tier model language replaced with three-tier acquisition model in all marketing/FAQ copy.

---

### CLAUDE — 2026-03-08

**Key Outcomes**
- Ran `ryt`: updated `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` on staging.
- Discovered that `MASTER_KNOWLEDGE_DOCUMENT.md` does not exist at repo root on staging. Canonical file is `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md`.
- Discovered and read `docs/prompts/t1-takeaways-prompt.md` (new t1 protocol).

**Config / Infrastructure**
- Active Supabase project: `wiotrvoirdgzfacuuiem` (only valid project).
- Dead project `bgdtekbhelormzbymkhh` surfaced in a session-provided enrichment-api code block. That endpoint is permanently dead. All operations go to `wiotrvoirdgzfacuuiem`.
- Enrichment API: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`

**New Rules or Docs**
- `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` updated:
  - Section 12 (Supabase Pagination) expanded with per-table row counts, pagination code patterns, and the "exactly 1,000 rows = more rows exist" warning.
  - Section 14 (Tech Stack) gained explicit DEAD INFRASTRUCTURE callout for old Supabase project `bgdtekbhelormzbymkhh`.
  - Section 19 (Conflict Resolution) gained new row: `bgdtekbhelormzbymkhh` -> `wiotrvoirdgzfacuuiem`.
  - Last consolidated date updated to March 8, 2026.
- `docs/prompts/t1-takeaways-prompt.md` exists (new prompt; defines t1 behavior for all AI agents).

**New Functions / Scripts**
- None added this session.

**Deprecated or Removed**
- `bgdtekbhelormzbymkhh` Supabase project: confirmed dead, documented as such.
- Any session notes or external docs referencing the old enrichment-api endpoint (`bgdtekbhelormzbymkhh`) should be treated as stale and ignored.
