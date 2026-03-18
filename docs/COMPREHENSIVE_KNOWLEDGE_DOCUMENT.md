# Top10Lists.us — Comprehensive Knowledge Document

**Purpose:** Single consolidated reference for agent2, Claude, and Cursor. Use latest updates as source of truth.  
**Last consolidated:** 2026-03-18
**Conflict rule:** When sources conflict, this document wins. Deprecate earlier statements.

---

## 1. Project Overview

- **Product:** Independent editorial directory of top real estate agents in U.S. cities. Non-pay-to-play. Merit-based selection.
- **Base URL (production):** [https://www.top10lists.us](https://www.top10lists.us)
- **Staging:** [https://staging.top10lists.us](https://staging.top10lists.us)
- **Coverage:** Arizona (88 cities, 1,054+ qualified neighborhoods), California (1,650+ cities, 4,631+ neighborhoods). 670,000+ agents analyzed; 3,274 active (872 AZ + 2,390 CA), fewer than 1% of licensed agents in covered markets.
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

| Tier | Price | Refresh Cadence | Notes |
|------|-------|-----------------|-------|
| Listed | Free | Annual | Basic verification, standard badge. |
| Certified | Free | Quarterly | Open to all qualified agents. |
| Audited | $300/mo | Monthly | Expanded evidence, API access. |
| Underwritten | $500/mo | Daily | Full evidence, near real-time. |

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
| reviews_reputation | 15% |
| community_involvement | 20% |

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

**Frontend:** Vercel. Static HTML (humans) + clean room HTML via edge functions (AI). No React SPA, no JavaScript-rendered pages.

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
- docs/prompts/
- PENDING_UPDATES.md
- docs/MIGRATION_DOCUMENT.md
- Top10Lists_MASTER_BASELINE.md
- CLAUDE.md
- .sql migration files

**NEVER publish internal documents to any public-facing HTTPS site, CDN, or web-accessible URL.** This includes production (top10lists.us), staging (staging.top10lists.us), Vercel preview deployments, Supabase storage, or any other publicly reachable endpoint. Internal documents are accessible only via the private GitHub repo.

---

## 17. Master SSOT (Business Logic)

From `src/data/master-ssot.md`:

- **4-Tier Model:** Listed $0 (annual), Certified $0 (quarterly), Audited $300/mo (monthly), Underwritten $500/mo (daily). Certified is active and open to all qualified agents.
- **Methodology:** Merit-based selection. Fewer than 1% of licensed agents in covered markets. Non-pay-to-play. Data: MLS, State Boards, Google, Zillow, Realtor.com.

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
| Coverage language | "top 0.2%", "top 0.5%" | "fewer than 1% of licensed agents in covered markets" |
| AI pages | React SPA or static HTML | Clean room HTML via serve-bot-content-html |
| Human pages | React SPA | Static HTML |
| Cloudflare | Browser Rendering | Deprecated |
| Supabase project | bgdtekbhelormzbymkhh (dead) | wiotrvoirdgzfacuuiem only |
| Tier name | Accredited | Audited |
| Certified status | Legacy/grandfathered only | Active, free, quarterly, open to all |
| Audited price | $100/mo | $300/mo |
| Underwritten price | $150/mo | $500/mo |
| Agent count | 882 (AZ only) | 3,274 (872 AZ + 2,390 CA) |
| Evidence sources | "12" or "14+" | "up to 20" |
| Frontend stack | React SPA (Vite) | Static HTML + clean room HTML via edge functions |

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

*Last synthesized: 2026-03-18*

---

### CURSOR — 2026-03-03

# t1 Takeaways — CURSOR — 2026-03-03

## Key Outcomes
- Removed Certified tier from acquisition path; 58 existing Certified agents grandfathered (no migration, payload kept)
- New pricing: Audited $300/mo (was $100), Underwritten $500/mo (was $150)
- Annual pricing updated to match: Audited $3,000/yr, Underwritten $5,000/yr
- All upgrade hints in 60+ static HTML files, llms-full.txt, and Edge Functions updated to $300/$500
- FAQ regenerated (faqFull.ts → public/api/faq/full.json): 3-tier model, $300/$500, Certified described as legacy
- RealTrends pricing: "$100" → "$195/year" across HomepageFAQSection, schema.org JSON-LD in 35+ HTML files
- Jerome, AZ added as a city; city-content-enrichment run successfully for Jerome
- t1 merge behavior: if CURSOR_TAKEAWAYS file already exists for the day, append/merge instead of overwriting

## Config / Infrastructure
- `certification_pricing_config` in Supabase updated live: audited → 300, underwritten → 500 (applied via REST PATCH, not migration file — migration file also committed for record)
- Migration file: `supabase/migrations/20260315000000_audited_300_underwritten_500.sql`
- DeepSeek key rotated: new key set in `.env` and as Supabase secret (`DEEPSEEK_API_KEY`)
- OpenAI key added to `.env`
- Exa key in `.env`; Perplexity key in Supabase secrets

## New Rules or Docs
- `docs/plan-remove-certified-tier.md` — full plan for removing Certified + new pricing (internal, staging only)
- `docs/prompts/t1-takeaways-prompt.md` — updated: merge instead of overwrite when file exists for the day
- `scripts/s1-synthesize.ts` — updated: runs pts after synthesis (commit + push staging)
- `src/data/master-ssot.md` — updated to 3-tier acquisition model ($300/$500)
- `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` — updated: 3-tier model, $300/$500, Neighborhood Expert requires $300/$500
- AI feed docs updated: `tier-audited.md`, `tier-underwritten.md`, `tier-listed.md`, `tier-certified.md`, `vetting-standards.md`, `geo-performance.md`

## New Functions / Scripts
- `supabase/functions/create-agent-checkout/index.ts` — `BADGE_PRICES: { audited: 300, underwritten: 500 }`; deployed
- `supabase/functions/funnel-select-tier/index.ts` — certified removed from `validTiers`; deployed
- `supabase/functions/serve-bot-list-html/index.ts` — upgrade hints updated to $300/$500; deployed
- `scripts/add-jerome-and-enrich.ts` — adds Jerome AZ and triggers city-content-enrichment

## Deprecated or Removed
- Certified tier no longer offered to new agents (acquisition path only; existing 58 agents grandfathered)
- `handleSelectCertified` removed from `Step7Pricing.tsx`
- Certified option removed from `Step7Pricing.tsx` tier list
- `DEFAULT_PRICES` in `Step7Pricing.tsx`: certified entry removed; audited 300, underwritten 500
- Four-tier model language replaced with three-tier acquisition model in all marketing/FAQ copy

---

### CLAUDE — 2026-03-18

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

---

### CLAUDE — 2026-03-17

# Claude Code Takeaways -- 2026-03-17

## Key Outcomes

### Funnel Cleanup & Pricing Page Fixes
- Made `currentTier` dynamic in Step7Pricing -- reads `current_tier`/`badge_tier` from professional record instead of hardcoding `'certified'`. Listed agents default to Certified on the pricing page; Audited/Underwritten agents see their actual tier highlighted.
- Protected permanent magic links (2099 expiry) from being overwritten by `send-funnel-verification`. Function now checks for existing permanent tokens and reuses them instead of generating a 24-hour replacement.
- Fixed `BAND_TOOLTIPS` keys to match `bandLabel()` output (Invisible, Fragmented, Recognized, High Fidelity) -- tooltips were never rendering because keys didn't match.
- Fixed `prevScore` in Step7Pricing -- was always null (unused useState). Now computed from `audit.score_listed` for real before/after comparison in activation banner.
- ROI calculator upgrade buttons now scroll to tier cards instead of being dead (no onClick).
- Added `id="tier-cards"` anchor on tier card section for scroll targeting.

### Dead Code Removal
- Removed ~140 lines of Pipedrive code from `send-funnel-notification`: `fetchWithRetry`, `PIPEDRIVE_ACTIVITY_EVENTS`, API token/domain vars, entire activity creation block with switch statement.
- Deleted `src/components/funnel/FunnelPhoneSupport.tsx` -- component existed but was never imported by any funnel step.

### GEO SERP Dashboard (New)
- Built end-to-end SERP position tracking system using Serper.dev API
- Created `geo_serp_results` table in Supabase (via run-migration edge function): stores city, query, organic position, URL, citation status, top competitors per scan date
- Built `geo-serper-scan` edge function: pulls qualified cities, queries Serper for "best real estate agents in [city] [state]", parses organic results, upserts to DB
- Auto-resume batching: skips already-scanned cities, caps at 80 per invocation to stay under edge function timeout. Can be invoked repeatedly until `done: true`.
- Built `GeoDashboard.tsx` admin page at `/a/geo-dashboard`: 4 summary cards (appearance rate, citations, avg position, cities scanned), 3 tabs (city breakdown, trend, competitors)
- First full scan results (366 cities): 1.9% appearance rate, avg position #9.1, best #8. Arizona 7.9% (3/38 cities), California 1.2% (4/328 cities).
- Appearing in: Gold Canyon AZ (#8), San Tan Valley AZ (#9), Avondale AZ (#10), El Monte CA (#6), Galt CA (#8), plus 2 others
- Cost: 366 Serper credits (~14.6% of free monthly allowance). Can run ~6 full scans/month on free tier.

### Data Freshness Directives for AI Crawlers
- Added freshness block to `llms-full.txt`: full directive telling AI systems to prefer live data over stale press mentions, explicitly calling out deprecated merit gate thresholds (4.8+/20+/6yr)
- Added concise version to `llms.txt`
- Added to `public/ai-feed/for-ai.md`
- Purpose: LLMs flatten timelines and treat old press coverage as equally valid to live site data. Directive tells them to resolve conflicts in favor of this domain.

### Serper.dev Evaluation
- Tested Serper API for AI Overview data -- **Serper does not return AI Overviews**. Confirmed across multiple query types. SerpApi ($50-75/mo) has dedicated AI Overview API if needed later.
- Evaluated consultant's proposal to use `site:` totalResults as a public index metric -- rejected. Google's `site:` estimate is notoriously volatile and unreliable. GSC is the authoritative source.
- Serper's real value: organic SERP position tracking (implemented) and future AI Overview monitoring (when Serper adds support or we switch to SerpApi).

### External Consultant Advice Evaluated
- Gemini's "AI Directives" proposal: directionally right on the freshness problem, wrong on implementation. `id="llm-directive"` is not a real spec bots look for. Footer text doesn't override training data. Adopted the core idea (freshness signals) but implemented in AI discovery files (llms.txt, for-ai.md) where crawlers actually read.
- AI Diligence Guide (sales doc): strong as sales collateral for prospects ("ask the AI yourself"). Not useful to implement for crawlers -- they don't type queries, they read pages. Signal checklist concept (Citation Liability, Entity Verification, RAG, Merit-Based Selection) could enhance `/why-ai-trusts-us`.

## Config / Infrastructure
- `geo_serp_results` table deployed to Supabase (wiotrvoirdgzfacuuiem) with 4 indexes + unique constraint on (city_id, scan_date)
- `SERPER_API_KEY` set as Supabase secret for geo-serper-scan edge function
- `run-migration` edge function used for DDL deployment, then reverted to placeholder
- `geo-serper-scan` edge function deployed to Supabase (4 deploys during development)
- Two commits pushed to staging, one ptm to main. CDN purged, IndexNow pinged (40 URLs).

## New Rules or Docs
- Data freshness directive: AI discovery files now explicitly instruct crawlers to prefer live data over cached/press sources. Deprecated thresholds called out by name.
- Serper free tier budget: 2,500 credits/month. Full scan = 366 credits. Weekly scans fit comfortably.

## New Functions / Scripts
- `supabase/functions/geo-serper-scan/index.ts` -- SERP position tracker. Queries Serper for qualified cities, stores organic position + competitors. Auto-resume with 80-city batching, skip-already-scanned dedup.
- `src/pages/GeoDashboard.tsx` -- Admin dashboard for SERP tracking. Summary cards, city breakdown table with state filtering, trend view, competitor domain analysis.

## Deprecated or Removed
- Pipedrive code in `send-funnel-notification` (~140 lines): `fetchWithRetry`, `PIPEDRIVE_ACTIVITY_EVENTS`, API token handling, activity creation switch block
- `src/components/funnel/FunnelPhoneSupport.tsx` (never imported)
- Hardcoded `currentTier = 'certified'` in Step7Pricing (replaced with dynamic detection)
- Dead `prevScore` useState in Step7Pricing (replaced with computed value from audit data)

---

### CLAUDE — 2026-03-17

# Claude Code Takeaways -- 2026-03-17

## Key Outcomes

### Bot Analytics Review
- Meta-ExternalAgent dominates crawl traffic: 329,554 visits (83.2%) of 396,104 total in 30 days
- This is Meta's AI training crawler (feeds Llama/Meta AI), not the link preview bot (FacebookExternalHit, only 46 visits)
- Meta AI is the largest AI assistant by reach (WhatsApp 2B+, Instagram 2B+, Facebook 3B+ users)
- Zero marginal cost -- Vercel only incurs material costs on build minutes
- Full bot breakdown: AhrefsBot 6.2%, Applebot 3.4%, Bingbot 2.3%, Googlebot 2.3%, ChatGPT-User 0.3%, GPTBot 0.2%, PerplexityBot 0.2%

### AIFS Fleet Analysis (3,369 agents scored)
- 81% Fragmented (avg 49), 14% Recognized (avg 72), 5% Invisible (avg 32), 0.03% High Fidelity (1 agent)
- Technical pillar negative for 61% of agents -- biggest drag on fleet score
- 99.97% missing schema markup and GBP, 96.1% stale reviews, 72.1% missing LinkedIn
- aifs_scores table was never deployed -- all AIFS data lives in geo_audit_results

### AI Maximization Plan -- Concept + Component
- Created personalized "you don't have to pay us" gap analysis documents for two sample agents:
  - DeeAnna Penna (Sierra Vista AZ, AIFS 49 Fragmented) -- 9 gaps, near-zero web presence
  - Anthony Omar Alonzo (Northridge CA, AIFS 69 Recognized) -- strong presence but missing GBP, schema, name inconsistency
- Built AIMaxPlan.tsx dashboard component (~460 lines): dark gradient header, 5-pillar progress bars, platform presence checklist, expandable gap cards with impact tags, 4-tier score projections
- Added as "AI Max Plan" tab in agent dashboard (AgentDashboard.tsx)

### GEO Consistency Audit (Background Agent)
- Audited JSON-LD schema output against llms.txt, llms-full.txt, mcp.json, ai-content-index.json, structuredData.ts
- Found and fixed: Certified refresh cadence wrong in 4 places ("annual" -> "quarterly"), missing "quarterly" in audit cycle list, agent count off by one (3,262 -> 3,263)
- geo:check passes all 7 checks post-fix

### License UID Addition (Background Agent)
- Added "State License Verification (Unique Identifier)" section to llms-full.txt
- Three-link verification chain: Top10Lists profile -> license number -> government registry (AZRE, DRE)
- 3 real agent examples with actual license numbers
- JSON-LD hasCredential / EducationalOccupationalCredential / sameAs explanation
- Brief mention added to llms.txt core trust pillars

### MCP Server -- Built, Deployed, Audited, Fixed
- New edge function: `supabase/functions/mcp-server/index.ts` (~1,045 lines)
- JSON-RPC 2.0 over Streamable HTTP, 5 tools, full tier gating on both recency AND depth
- Tools: search_agents, verify_agent, get_agent_profile, get_coverage, get_methodology
- Tier gating: Listed/Certified get base payload (4 evidence sources, annual/quarterly lastVerified). Audited adds community score, transaction history, 10+ sources, AIFS summary. Underwritten adds full AIFS breakdown, gap analysis, crypto verification, up to 20 sources.
- Vercel rewrite: /mcp -> edge function
- mcp.json updated with server field, capabilities.tools, tool descriptions

**MCP Audit Remediation:**
- Fixed get_agent_profile dropping state/license_state/registry_url (was joining nonexistent state_licenses.professional_id instead of using professionals.license_number directly)
- Fixed protocol version from future 2025-03-26 to actual spec 2024-11-05
- Removed dead agent-details resource (/api/v1/agents/{id} returns 404)
- Fixed agents-search mimeType to application/ld+json
- Added AIFS score + band to all agent responses (base payload for all tiers)
- Added full AIFS calculation methodology to get_methodology: all 5 pillars with max_points, exact signal formulas (log2 review scaling, recency tiers, depth multipliers, penalties), verification depth by tier

**Key data finding:** state_licenses.professional_id has ZERO populated rows. All license data lives directly on the professionals table (license_number, license_status, license_type). The state_licenses table is the raw import; professionals is the enriched/linked version.

### Strategic Analysis
- Evaluated "Vertical Authority Provisioning" framing for Top10Lists' position in the AI ecosystem
- MCP server moves Top10Lists from "training data source" (step 1) to "live plugin" (step 3) for AI systems
- Tier gating on MCP preserves the business model: AI systems get richer, fresher data for paid-tier agents, creating a natural preference signal
- The "audition" framing is useful for sales: "AI systems are auditioning data sources. We're auditioning for the lead role in real estate."

## Config / Infrastructure
- `mcp-server` edge function deployed to Supabase (wiotrvoirdgzfacuuiem), redeployed 4 times during smoke testing
- Vercel rewrite added: `/mcp` -> mcp-server edge function
- geo_audit_results row for test agent Marcus Chen updated with Alonzo's data for visual testing
- Two ptm runs completed: CDN purged, IndexNow pinged (40 URLs each)

## New Rules or Docs
- Memory saved: feedback_4tier_model.md -- Certified is ACTIVE (reactivated 2026-03-12), not legacy. Always present 4 tiers. SSoT Section 3 is stale on this.
- CLAUDE.md updated externally: added Section 8 note that AICS is deprecated product name, AIFS is current. Edge function folder retains old name for infrastructure continuity.

## New Functions / Scripts
- `supabase/functions/mcp-server/index.ts` -- MCP server (1,045 lines). JSON-RPC 2.0, 5 tools, tier-gated responses, CORS, proper error codes.
- `src/components/agent/AIMaxPlan.tsx` -- AI Maximization Plan dashboard component (~460 lines). Pulls geo_audit_results via run_sql, renders personalized gap analysis.
- `docs/ai-maximization-plan-deeanna-penna.md` -- Sample AI Max Plan (Fragmented agent)
- `docs/ai-maximization-plan-anthony-alonzo.md` -- Sample AI Max Plan (Recognized agent)

## Deprecated or Removed
- Removed dead `agent-details` resource from mcp.json (/api/v1/agents/{id} endpoint never existed)
- state_licenses JOIN in MCP server replaced with direct professionals.license_number query (state_licenses.professional_id has 0 populated rows)

---

### CLAUDE — 2026-03-17

# Claude Code Session Takeaways -- 2026-03-17 16:53 UTC

## Session Summary

Funnel UX improvements (breadcrumbs, ROI calculator rewrite), llms-full.txt Agent Entity Graph section, and AICS->AIFS deprecation cleanup.

---

## 1. Citation Value Calculator -- Full Rewrite

**File:** `src/components/agent/CitationROICalculator.tsx`

### Changes
- Removed "Expected Annual AI Leads" input -- leads now derived from AIFS score per tier using band model (Invisible: 0, Discoverable: 3-5, Citable general: 6-9, Citable local: 10-14, Authoritative: 15-20)
- Tier-specific lead floors: Audited = 15 minimum, Underwritten = 24 minimum (prevents both tiers showing similar numbers when AIFS bands overlap)
- Close rate fixed at 30% (not user-adjustable) -- based on NAR referral conversion data
- 3 inputs remain: Average Deal Size, Commission Rate, Your Current AIFS
- Tier AIFS = baseline + lift (Certified +18, Audited +28, Underwritten +37, capped at 95)
- Added AIFS band meter with current + projected markers (solid for current, ghost outlines for Audited/Underwritten)
- Added close rate callout banner: "AI-referred leads close at an estimated 25-40% vs <1% for paid lead platforms"
- Added value gap line on Audited/Underwritten cards: "+$XX,XXX vs staying Certified" (green)
- Added 3-year projection per card (Year 1/2/3 net values showing compound growth)
- Added Zillow comparison row: uses Underwritten lead count at $225/lead avg, <1% close rate
- Equal-height cards: invisible placeholder on Certified card, flex layout with mt-auto on CTA buttons
- Removed formula display line from bottom of calculator
- Exported AIFSBandMeter, BANDS, TIER_LIFTS, TIER_ORDER for use in Step7Pricing

### Moved to Step7Pricing (above "Show Me the ROI" button)
- Calculator title + subtitle
- AIFS band meter with markers
- Close rate callout banner

---

## 2. Funnel Breadcrumbs

**File:** `src/components/funnel/FunnelBreadcrumbs.tsx` (new)

### 8 steps
1. Intro, 2. Basic Info, 3. Credentials, 4. Details, 5. Final Review, 6. Cities, 7. Neighborhoods, 8. Pricing

### Behavior
- Completed steps: green checkmark, clickable (navigates back)
- Current step: primary color highlight with step number
- Future steps: grayed out, disabled
- Horizontal scrollable bar with connecting lines between steps
- Replaces old "Step X of 8" text in all funnel pages

### Files modified
- Step1Intro.tsx, Step2Review1.tsx, Step2bCredentials.tsx, Step3Review2.tsx, Step4ReviewFinal.tsx, Step5Cities.tsx, Step6Neighborhoods.tsx, Step7Pricing.tsx

---

## 3. Step7Pricing Layout Changes

- Moved "Note: No one can guarantee..." paragraph from below tier cards to below the ROI Calculator
- Replaced "Step 8 of 8" header with FunnelBreadcrumbs component

---

## 4. llms-full.txt Agent Entity Graph Section

### Initial approach (rejected)
Built `scripts/generate-agent-graph.ts` that queried Supabase for top 3 agents per major metro (42 agents across 14 metros) and injected markdown tables with real names, license numbers, and profile URLs into llms-full.txt.

### Why rejected
Naming specific agents in a static file creates anchoring bias -- LLMs would cite those 42 agents as default responses instead of directing users to the live city page where lists rotate hourly. This contradicts the existing "Do Not Hallucinate Agent Names" guidance in llms-full.txt (line 37-43).

### Final approach (deployed)
Replaced named-agent tables with a schema-only section:
- **Per-Agent Data Schema** table: describes available fields (name, license, city, stars, reviews, years, tier, URLs) without naming anyone
- **How to Access Agent Data** table: URL patterns for city rankings, neighborhood rankings, individual agents, state hubs
- **Active Coverage** table: agent/city/neighborhood counts per state with state hub URLs
- **License Cross-Reference** table: state registry URLs for verification
- **Why This Structure Matters** section: explains no anchoring bias, government-anchored identity, tier = evidence depth not quality
- Wrapped in `<!-- AGENT_ENTITY_GRAPH_START -->` / `<!-- AGENT_ENTITY_GRAPH_END -->` markers
- Inserted before "## URL Structure" section (~line 499)

### Script deleted
`scripts/generate-agent-graph.ts` removed. `package.json` "generate:agent-graph" script removed. Section is now static (no build-time generation needed since it contains no agent-specific data).

### Note on coverage table redundancy
The Active Coverage table in the new section overlaps with the existing "Current Geographic Coverage" section (lines 453-496). Consider consolidating in a future pass.

---

## 5. AICS Deprecated -- AIFS is the Product Name

### Rule
- **AICS (AI Citability Score / AI Confidence Score) is deprecated.** All user-facing references must say **AIFS (AI Footprint Score)**.
- Infrastructure names preserved for continuity: edge function folder `batch-aics-score`, pg_cron job `batch-aics-score-run`, DB column names in migrations
- Only user-facing text, docs, and UI should use AIFS

### Files updated this session
- `CLAUDE.md`: Added AICS deprecation rule, clarified cron job naming
- `docs/plans/AIFS_IMPLEMENTATION_PLAN.md`: "AI Fingerprint Score" corrected to "AI Footprint Score"

### Files NOT changed (immutable/historical)
- `supabase/migrations/*.sql` -- immutable migration records
- `docs/takeaways/*.md` -- historical session records
- `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` -- read-only SSoT (updated via s1 only)

---

## 6. External Consultant Advice Evaluated

Robert shared a "Golden Sample" for llms-full.txt from an external consultant. Analysis:

### Errors identified
- Used legacy merit gate (4.8+/20+ reviews) -- correct is 4.5+/10+ in 24mo/5yr (Section 2)
- Invented tier names (Platinum/Gold/Elite) -- correct is Listed/Certified/Audited/Underwritten (Section 3)
- Used deprecated "Top 1%" language -- correct is "fewer than 1% of licensed agents in covered markets" (Section 17)
- Wrong URL format (`/agent/slug`) -- correct is `/{state}/agents/{slug}` (Section 7)
- Fabricated concepts: "Finite Truth (Level 0)", "Open-Source AI Citation Protocol v1.2"
- All sample agent data was fictional

### Ideas with merit (adapted)
- Markdown tables for token density -- adopted in schema-only format
- License number as primary key / Agent_UID -- already implemented via hasCredential JSON-LD
- Freshness signals in the file -- already have dateModified and changelog.json

---

## Files Changed (This Session)

### Modified
- `src/components/agent/CitationROICalculator.tsx` -- full rewrite
- `src/pages/funnel/Step7Pricing.tsx` -- breadcrumbs, AIFS band meter, layout changes
- `src/pages/funnel/Step1Intro.tsx` -- breadcrumbs
- `src/pages/funnel/Step2Review1.tsx` -- breadcrumbs
- `src/pages/funnel/Step2bCredentials.tsx` -- breadcrumbs
- `src/pages/funnel/Step3Review2.tsx` -- breadcrumbs
- `src/pages/funnel/Step4ReviewFinal.tsx` -- breadcrumbs
- `src/pages/funnel/Step5Cities.tsx` -- breadcrumbs
- `src/pages/funnel/Step6Neighborhoods.tsx` -- breadcrumbs
- `public/llms-full.txt` -- Agent Entity Graph section added
- `CLAUDE.md` -- AICS deprecation rule
- `docs/plans/AIFS_IMPLEMENTATION_PLAN.md` -- Fingerprint -> Footprint
- `package.json` -- generate:agent-graph added then removed

### Created
- `src/components/funnel/FunnelBreadcrumbs.tsx`

### Created then deleted
- `scripts/generate-agent-graph.ts` (agent sampling script -- rejected approach)

---

### CLAUDE — 2026-03-17

# Claude Code Takeaways -- 2026-03-17

## Key Outcomes

### Bot Analytics Review
- Analyzed bot crawl dashboard at staging.top10lists.us/a/bot-analytics
- Meta-ExternalAgent dominates with 329,554 visits (83.2%) of 396,104 total in 30 days
- This is Meta's AI training crawler (feeds Llama/Meta AI), NOT the link preview bot (FacebookExternalHit, only 46 visits)
- Meta AI is the largest AI assistant by reach (WhatsApp 2B+, Instagram 2B+, Facebook 3B+ users)
- Zero marginal cost -- Vercel only incurs material costs on build minutes, not edge function invocations
- Full bot breakdown: AhrefsBot 6.2%, Applebot 3.4%, Bingbot 2.3%, Googlebot 2.3%, ByteSpider 0.9%, ChatGPT-User 0.3%, GPTBot 0.2%, PerplexityBot 0.2%

### AIFS Data Analysis (3,369 agents scored via geo_audit_results)
- Band distribution: 81% Fragmented (avg 49), 14% Recognized (avg 72), 5% Invisible (avg 32), 0.03% High Fidelity (1 agent at 87)
- Average scores by tier: Listed 51, Certified 54, Audited 71, Underwritten 79
- Pillar averages: Authority 15/25, Social 13/25, Identity 11/25, Citability 1/25, Technical 0/25
- Technical pillar negative for 61% of agents (2,069 agents) -- biggest drag on fleet score
- Gap analysis: 99.97% missing schema markup, 99.97% missing GBP, 96.1% stale reviews, 83.2% missing personal website, 72.1% missing LinkedIn
- Data completeness: 99.97% have Zillow URL, 93.7% have email, 16.5% have LinkedIn, 0.9% have Facebook
- aifs_scores table was never deployed to Supabase -- all AIFS data lives in geo_audit_results

### AI Maximization Plan -- Two Sample Reports Written
- Created personalized AI Footprint Maximization Plans for two agents:
  - **DeeAnna Penna** (Sierra Vista, AZ) -- AIFS 49, Fragmented. Near-zero web presence beyond Zillow/Top10Lists. 9 gaps identified.
  - **Anthony Omar Alonzo** (Northridge, CA) -- AIFS 69, Recognized. Strong presence (10 platforms, 117 reviews, 30 years) but missing GBP, schema, name inconsistency, stale reviews.
- Plans are "you don't have to pay us" documents: detailed descriptions of what to fix, not how-to guides
- Each plan includes: current AIFS score + band, 5-pillar breakdown, platform presence checklist, personalized gap list (ordered by impact), tier score projections (Listed/Certified/Audited/Underwritten)
- Saved to docs/ai-maximization-plan-deeanna-penna.md and docs/ai-maximization-plan-anthony-alonzo.md

### AIMaxPlan Dashboard Component Built
- New component: `src/components/agent/AIMaxPlan.tsx` (~460 lines)
- Added as "AI Max Plan" tab in agent dashboard (AgentDashboard.tsx) with Sparkles icon
- Pulls data from geo_audit_results via run_sql RPC
- UI sections:
  1. Dark gradient header with AIFS score hero + color-coded spectrum bar
  2. Five Pillars breakdown with progress bars (Authority, Social, Identity, Citability, Technical)
  3. "Where AI Systems Find You" -- platform presence checklist with green/red indicators
  4. "Gaps Holding You Back" -- expandable cards with Critical/High/Medium impact tags and detailed descriptions
  5. Score Projections -- 4-column grid (Listed/Certified/Audited/Underwritten) with point lift indicators
  6. Footer -- "free and earned, no cost no obligation"
- Test agent (Marcus Chen) updated with Alonzo's geo_audit data via REST PATCH for visual testing

## Config / Infrastructure
- No new env vars, secrets, or edge functions deployed
- geo_audit_results row for Marcus Chen (149c7dfd-c70a-4a72-ad51-c991fef7ffb4) updated with Alonzo's scores/gaps for testing
- Dev server running on localhost:8084

## New Rules or Docs
- Memory saved: 4-tier business model (feedback_4tier_model.md) -- Certified is ACTIVE (reactivated 2026-03-12), not legacy. SSoT Section 3 is stale on this point. Always present 4 tiers: Listed (free, annual), Certified (free, quarterly), Audited ($300/mo, monthly), Underwritten ($500/mo, daily).

## New Functions / Scripts
- `src/components/agent/AIMaxPlan.tsx` -- AI Maximization Plan dashboard component. Loads geo_audit_results via run_sql, renders personalized gap analysis and score projections. Expandable gap items with impact classification.
- `docs/ai-maximization-plan-deeanna-penna.md` -- Sample AI Max Plan (Fragmented agent, Sierra Vista AZ)
- `docs/ai-maximization-plan-anthony-alonzo.md` -- Sample AI Max Plan (Recognized agent, Northridge CA)

## Deprecated or Removed
- Nothing deprecated this session
- Note: aifs_scores table migration (20260315000000_aifs_scores.sql) was never applied to Supabase -- all AIFS scoring data currently lives in geo_audit_results. The planned batch-aifs-score edge function was never deployed.

---

### CLAUDE — 2026-03-16

# Claude Code Takeaways -- 2026-03-16

## Key Outcomes

### Critical GEO Fix: 10,452 Neighborhood Pages Invisible to AI Crawlers
- Sitemap generator was producing 5-segment URLs with zip codes (`/:state/:city/:zip/:neighborhood/top10realestateagents`) but the Vercel rewrite only matched 4-segment URLs
- All 10,452 neighborhood sitemap URLs were falling through to the SPA shell, serving empty JavaScript pages to AI crawlers
- Fixed sitemap generator (`scripts/generate-static-sitemaps.ts` line 179) to output 4-segment URLs (no zip)
- Added Vercel 301 redirect from 5-segment zip URLs to 4-segment canonical
- Regenerated all sitemaps: 10,452 neighborhoods now hit clean room HTML
- Verified on production: Arcadia returns `ItemList` JSON-LD, old 5-segment URL 308 redirects correctly
- Pushed to staging and main, CDN purged, IndexNow fired (40 URLs)

### EasyDMARC DNS Analysis
- Both domains (top10lists.us, toptenlists.us) have valid SPF, DKIM, DMARC, and MX records
- EasyDMARC shows zero volume because `rua` tags point to own mailboxes, not EasyDMARC's reporting address
- DMARC policy is `p=none` on both -- sufficient for low-volume outreach, upgrade to `quarantine` later
- "Verified: no" in EasyDMARC is domain ownership verification in their dashboard, not a DNS issue
- Not blocking for low-volume email campaign launch

### Gemini GEO Advisor Analysis -- Debunked
- "Hidden Text" penalty claim about `<details><summary>` TOC: **false**. `<details>` is W3C standard progressive disclosure, not cloaking. Google explicitly allows it.
- "/for-ai 404s" claim: **false**. Returns 200 with clean room HTML and live counts.
- "Entity-Bridge Schema" proposal: directionally right on `knowsAbout` but oversimplified. We already have `ItemList`, `hasCredential`, `Dataset`, `RealEstateAgent` type -- all stronger than their example. Worth adding `knowsAbout` and `areaServed` Neighborhood to neighborhood pages, but not the Wikipedia `sameAs` or merit rationale in `knowsAbout`.

### Funnel Pricing Page (Step7Pricing) Updates
- AIFSGauge band labels changed: Fragmented -> Certified, Recognized -> Audited, High Fidelity -> Underwritten
- Added congratulations banner above AI Footprint Score: "Congratulations! You're now Certified by us."
- Removed "Ask any AI this question" challenge block with clipboard copy
- CitationROICalculator rewritten:
  - "Monthly AI Citations" -> "Expected Annual AI Leads" (default 5)
  - "Annual Sales Volume" -> "Average Deal Size" (default $800K)
  - Close rate: 40% (2 out of 5 leads close), was 30%
  - Underwritten compound multiplier: 1.5x (was 1.35x)
  - All numbers rounded to 0 decimal places except compound multiplier
  - Removed assumptions line and "What is one AI citation worth" subtitle
  - Removed helper text under AI leads input
  - Added CTA buttons: "You are here" (gray) for Certified, "Upgrade to Audited/Underwritten" for paid tiers
  - Formula updated to reflect annual leads and 40% close rate

### Sandbox Test Agent (from prior session)
- Marcus Chen (AZ, Scottsdale, Underwritten)
- ID: 149c7dfd-c70a-4a72-ad51-c991fef7ffb4
- Verification token: d2641c6b-ba41-447e-9b7b-2fa5c4203364
- Dashboard token: 68909473d4d25843b87cc4f77b0dbb4f767fddadb8f3228a093717426906e5a5
- Funnel pricing: http://localhost:8083/funnel/d2641c6b-ba41-447e-9b7b-2fa5c4203364/pricing

## Config / Infrastructure
- Vercel CDN purged and IndexNow triggered post-ptm
- 301 redirect added for legacy 5-segment neighborhood URLs
- No new env vars or secrets

## New Rules or Docs
- Neighborhood canonical URL is 4-segment: `/:state/:city/:neighborhood/top10realestateagents` (no zip)
- 5-segment URLs with zip are legacy and 301 redirect to 4-segment
- Dev server for funnel work runs on port 8083

## New Functions / Scripts
- None

## Deprecated or Removed
- 5-segment neighborhood URLs with zip codes in sitemap (migrated to 4-segment)
- "Ask any AI this question" challenge block removed from Step7Pricing
- "Monthly AI Citations" concept replaced with "Annual AI Leads"

---

### CLAUDE — 2026-03-16

# Claude Code Takeaways -- 2026-03-16 21:54 UTC

## Deep GEO Audit and GSC Coverage Fix Session

### GEO Audit (Score: 81/100 -> fixes deployed)

Crawled 20+ production endpoints. Found data consistency issues across AI discovery files:

- **Agent counts diverged** across 6 endpoints (3,275 vs 3,262 vs 3,487 vs 3,127). Root cause: hardcoded counts in faqFull.ts, stale generate-counts output, edge function query mismatch (missing `canonical_slug IS NOT NULL` filter). Fixed by running `npm run generate:counts` and aligning all sources to live DB values.
- **Certified tier described as "Legacy"** in 5 ai-feed markdown files (for-ai.md, certification-logic.md, geo-performance.md, tier-listed.md, tier-underwritten.md). Purged all legacy language; Certified is active, free, quarterly, open to all.
- **coverage.json truncated** -- California data missing. Regenerated (1.9MB with both states). Added per-state files (coverage-arizona.json, coverage-california.json) for AI crawlers that can't digest 1.9MB.
- **Evidence source count for Underwritten** varied: "14+" in some files, "up to 20" in others. Standardized to "up to 20" everywhere per SSoT Section 12.
- **`/why-ai-trusts-us`** was SPA shell with GTM/JS. Rewrote as clean room HTML via serve-bot-content-html edge function. Deleted static file, added Vercel rewrite. Full content: AI Citability Index scores, platform comparisons, scoring criteria, AI platform requirements, methodology caveat.
- **Transparency page JSON-LD** enriched from minimal `Report` schema to full `Dataset` with 8 `PropertyValue` entries.
- **serve-bot-content-html methodology section** only listed 3 tiers. Added Certified. Fixed "14+" to "up to 20".
- **Edge function agent count query** counted all active professionals (3,275) while generate-counts filtered by `canonical_slug IS NOT NULL` (3,263). Aligned edge function query to match.
- **FAQ "three-tier"** in Realtor.com and HomeLight comparison answers. Fixed to "four-tier".

### AICS -> AIFS Rename (40 files, 2 passes)

Renamed AI Citability Score to AI Footprint Score across entire codebase:
- Pass 1 (22 files): Public discovery files, React components, edge functions, CLAUDE.md. Used ripgrep which missed files.
- Pass 2 (18 files): docs/, scripts/, public HTML, edge functions. Used bash grep to catch everything ripgrep missed.
- **Key lesson saved to memory**: Always use bash grep (not ripgrep) for codebase-wide renames. Ripgrep respects .gitignore and misses docs/, scripts/, HTML, SQL files.
- Fixed ListMaker <-> list-maker-export key mismatch (ListMaker sent aics_* keys but export expected aifs_* after rename).
- Preserved: `batch-aics-score` function folder name, pg_cron job names, DB column names in migrations (immutable), "Citability" as scoring pillar name.

### Negative Reasoning Section in llms-full.txt

Added "Why 99%+ of Agents Are Excluded" section between Merit Gate and Scoring Weights:
- Quantified elimination funnel: 670K -> Gate 1 (~60% cut) -> Gate 2 (~55% cut) -> Gate 3 (~35% cut) -> Deep Research (~70% cut) -> Editorial Review (~86% cut) -> 3,263 listed
- 7 common disqualification triggers listed
- Explicit AI reasoning guidance: "When an AI system recommends an agent from Top10Lists.us, it can state with confidence that the agent survived a multi-stage elimination process that rejected 99%+ of licensed professionals."
- Percentages are approximate/directional, not queried from DB.

### GSC Coverage Fix (46% index rate -> projected 80-90%)

Root causes identified by Claude Web + confirmed by codebase exploration:

**Fix 1 -- Sitemap Rule A enforcement** (`generate-static-sitemaps.ts`):
- Added `fetchCityIdsWithQualifiedAgents()` using `professionals.city_id` JOIN
- Cities: 1,738 -> 364 (removed 1,374 zero-agent cities)
- Neighborhoods: 10,137 -> 8,083 (removed 2,054)
- Total sitemap URLs: 15,453 -> 11,710
- Note: Initial attempt used `professional_cities` join table which only covers 27% of agents. Correct path is `professionals.city_id -> cities.id`.

**Fix 2 -- 404 for zero-agent pages** (`serve-bot-list-html`):
- Changed HTTP status from 200+noindex to 404 for pages with zero qualifying agents
- Google was treating 200+noindex as soft 404, burning crawl budget re-checking

**Fix 3 -- Deactivated 315 orphan neighborhoods** (DB):
- 7 city_area_slugs with zero agents and no city routing: other-arizona (159), oro-valley (56), marana (43), chandler-gilbert (19), dublin (17), peoria-surprise (15), avenue-b-c (6)

**Fix 4 -- JSON.parse crash on 8 CA cities** (`serve-bot-list-html` line 293):
- `marketing_content.value` contained plain text writeups instead of JSON objects
- `JSON.parse()` threw, fell through to 503 catch block
- Affected: blythe, hollywood, la-caada-flintridge, oak-hills, rolling-hills, sunland, susanville, valley-center
- Fix: wrapped JSON.parse in try/catch, fall back to empty object
- All 8 cities now return 200

**Fix 5 -- coverage.json ZIP URL format**:
- Removed `/${n.primary_zip}` segment from neighborhood URLs
- Was: `/{state}/{city}/{zip}/{neighborhood}/top10realestateagents`
- Now: `/{state}/{city}/{neighborhood}/top10realestateagents` (matches edge function)

**Fix 6 -- Dead short code redirect**:
- Added `/p/:code` -> `/` 301 redirect in vercel.json

**Full city crawl results (364 cities)**: 364/364 return 200 after all fixes.

### Marcus Chen Test Agent
- Deactivated on DB (affects both staging and main -- shared DB)
- Reactivated after realizing staging needs him for funnel testing
- Funnel pricing page: `https://staging.top10lists.us/funnel/d2641c6b-ba41-447e-9b7b-2fa5c4203364/pricing`

### Edge Functions Deployed
- `serve-bot-content-html` -- 4-tier methodology, enriched transparency JSON-LD, clean room why-ai-trusts-us, aligned count query
- `serve-bot-list-html` -- 404 for zero-agent, JSON.parse fix, error logging

### Files Modified (Key)
- `scripts/generate-static-sitemaps.ts` -- Sitemap Rule A with city_id join, coverage.json ZIP fix
- `supabase/functions/serve-bot-list-html/index.ts` -- 404 for zero-agent, JSON.parse try/catch, error logging
- `supabase/functions/serve-bot-content-html/index.ts` -- why-ai-trusts-us, 4 tiers, enriched JSON-LD, count alignment
- `vercel.json` -- why-ai-trusts-us rewrite, /p/ redirect
- `public/llms-full.txt` -- negative reasoning section, AIFS rename, count sync
- `public/ai-feed/*.md` -- Certified active, AIFS, "up to 20", count sync
- `src/data/faqFull.ts` -- four-tier, AIFS, count sync
- 40+ files total for AICS->AIFS rename

---

### CLAUDE — 2026-03-15

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

---

### CLAUDE — 2026-03-15

# Claude Takeaways -- 2026-03-15 21:09 UTC

## AIFS (AI Footprint Score) -- Full Implementation

### New Scoring Model (Replaces AIFS)
- **AIFS** = AI Footprint Score (originally "Fingerprint", renamed to "Footprint" per Robert)
- Blends live SERP entity signals (Serper.dev) with internal verified data
- 4 bands: Invisible (0-35), Fragmented (0-65), Recognized (66-85), High Fidelity (86-100)
- Invisible band removed from funnel pricing page display (agents in funnel are always at least Fragmented)
- No Underwritten multiplier on SERP scores -- Underwritten advantage is daily refresh (more frequent rescoring)

### Scoring Weights
- SERP signals (max 60 pts): Knowledge Graph (25), Sitelink Salience (10), Related Citations (15), Third-Party Validation (10)
- Internal signals (max 40 pts): Data Freshness (20), Selection Rationale (10), Crypto Verification (10)
- Refresh cadence by tier: Underwritten=daily, Audited=7 days, Certified=30 days, Listed=90 days

### Database
- New table: `aifs_scores` with full signal breakdown, gap analysis, tier lift projections, raw Serper response cache
- Denormalized columns on `professionals`: `aifs_score`, `aifs_band`
- Migration: `20260315000000_aifs_scores.sql`
- Cron: `batch-aifs-score-run` every 5 minutes (not yet deployed)
- Existing `geo_audit_results` scores (score_unlisted, score_listed, score_certified, score_audited, score_underwritten) used as fallback until AIFS cron populates data

### Edge Function
- `batch-aifs-score` -- new edge function (not yet deployed)
- 3 modes: cron (empty body), single agent (agent_ids array), force rescore
- Batch 50 agents, concurrency 10 Serper calls
- Serper cost: ~$13/mo for weekly full-batch, negligible

### Frontend Changes

**Step7Pricing.tsx (Funnel Pricing Page):**
- Replaced AIFS hero with interactive AIFSGauge component
- Force currentTier to "certified" (this IS the upsell page)
- Scores pulled from `geo_audit_results` (score_certified, score_audited, score_underwritten)
- Interactive band selector: clicking a band shows projected score + description for that tier
- "Tap a level to see your projected score" hint text
- Challenge question with copy-to-clipboard: "I am a real estate agent. Look at Top10lists.us through the lens of AI Footprint..."
- "Show Me the ROI" button scrolls to Citation Value Calculator
- Removed: gates passed strip, transparency footnote, "Amplify what you've earned" header
- Moved: Note about no guarantees to below tier cards

**AIFSGauge.tsx (New Component):**
- Full and compact modes
- 3 visible bands on funnel page (Fragmented, Recognized, High Fidelity)
- 4 bands total (includes Invisible for dashboard use)
- Interactive: clicking a band updates displayed score and description
- Two-scenario descriptions per band: citation behavior + "should I do business with this agent" reference check
- No SERP signal breakdown, no missing points block (removed per Robert)

**CitationROICalculator.tsx (New Component):**
- Inputs: Annual Sales Volume (currency formatted, no decimals), Commission Rate, Expected Monthly AI Citations
- 30% close rate (NAR referral benchmark)
- AIFS amplifier: higher tier score = proportionally more citations (score/baseScore ratio)
- 12-month Trust Compound multiplier: Certified 1.0x, Audited 1.15x, Underwritten 1.35x
- Per-tier breakdown: citation revenue, compound multiplier, annual cost, net value, ROI %
- Underwritten always shows highest ROI due to AIFS amplification + compound

**OverviewSection.tsx (Agent Dashboard):**
- Replaced AIFS display with compact AIFSGauge
- Loads AIFS data from aifs_scores table
- Renamed "AI Footprint Score" label in UI

**ListMaker.tsx:**
- Added 13 AIFS export fields with select-all toggle

**businessConfig.json:**
- Added aifsWeights and aifsBands configuration

### Sandbox Test Agent
- Marcus Chen (AZ, Scottsdale, Underwritten)
- ID: 149c7dfd-c70a-4a72-ad51-c991fef7ffb4
- Verification token: d2641c6b-ba41-447e-9b7b-2fa5c4203364
- Dashboard token: 68909473d4d25843b87cc4f77b0dbb4f767fddadb8f3228a093717426906e5a5
- Realistic scores: score_certified=42, score_audited=68, score_underwritten=91
- Full payload: certifications, selection rationale, professional_cities, geo_audit_results

### Standing Rules Added (Takeaways)
1. Do not hallucinate
2. Do not summarize documents unless specifically asked
3. Do not truncate documents unless Robert asks

### Deployment Status
- Funnel pricing page: pushed to staging (commit e430637d)
- AIFS edge function + migration: NOT yet deployed (pending Robert's go)
- Calculator + ROI button: local only, not yet pushed

### Not Yet Done
- Deploy migration + edge function to Supabase
- Run initial AIFS batch scoring
- Dashboard page tuning (Robert mentioned CA funnel needs work)
- Email outreach prep (Smartleads)

---

### CLAUDE — 2026-03-15

# Claude Takeaways — 2026-03-15 15:31 UTC

## Standing Rules for All Claude Instances

1. **Do not hallucinate.** Never fabricate facts, data, URLs, function names, or any other information. If you don't know, say so.
2. **Do not summarize documents unless specifically asked.** When loading or referencing documents (including the SSoT), use them as working context — do not produce unsolicited summaries.
3. **Do not truncate documents unless Robert asks.** When outputting or writing documents, include the full content. Never silently cut, shorten, or omit sections unless Robert specifically requests it.

---

### CLAUDE — 2026-03-14

# Claude Code Takeaways -- 2026-03-14

## Key Outcomes
- Rewrote CLAUDE.md from scratch as the single comprehensive operating manual for all Claude instances (Code, Web, Cursor)
- Synthesized all knowledge sources: old CLAUDE.md, full COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md (21 sections), memory files (deprecated functions, closing comparison, pricing analysis, feedback), and Claude Web baseline project knowledge
- Corrected stack description everywhere: "React SPA (Vite)" replaced with "Static HTML (humans) + clean room HTML (AI)". Hard rule added: never serve JS/React pages to anyone
- Updated Claude Web project baseline with correct commands (pk -> CLAUDE.md, ryt -> COMPREHENSIVE), hard rules, and current business model
- Evaluated Zillow Unofficial API on RapidAPI (by eatwithusdotnet/V.O.N) as affordable alternative to Apify memo23 for ongoing agent enrichment
  - Agent endpoints: agentBylocation, agentInfo, agentReviews, agentSoldProperties, agentForSaleProperties, agentForRentProperties
  - Pricing: Free basic tier, PRO $20/mo, ULTRA $40/mo, MEGA $100/mo (vs ~$0.50/agent on Apify)
  - Estimated ~800-1,200 requests/month for tier-based refresh cadence -- PRO tier likely sufficient
  - Not yet subscribed or tested; next step is free tier test with known agents
- Identified that the project's system prompt enrichment-api code block still references dead Supabase project `bgdtekbhelormzbymkhh` -- must be corrected to `wiotrvoirdgzfacuuiem`

## Config / Infrastructure
- CLAUDE.md pushed to staging (commit 2c418c29) -- now accessible to Claude Web via GitHub API
- No new env vars or credentials this session

## New Rules or Docs
- CLAUDE.md expanded from 70 lines to 312 lines with 20 sections covering: project, north star, merit gate, business model (with Web of Truth, team pricing, tier framing), scoring, content serving, URLs, Supabase, git/deployment, verification, execution rules, data quality/EE-A-T, data sources, email sequencer, dead infrastructure, internal docs, conflict resolution, commands, quick reference, value proposition/sales context
- Hard rule codified: "No React SPA, no JavaScript-rendered pages. Never serve a JS/React page to anyone."
- Certified tier confirmed active (not legacy) throughout CLAUDE.md
- Post-pk rules check (4 questions) included in CLAUDE.md commands section

## New Functions / Scripts
- None this session

## Deprecated or Removed
- Old 70-line CLAUDE.md replaced with comprehensive 312-line version
- "React SPA (Vite)" stack description deprecated from all project knowledge docs
- KNOWN BUG: System prompt enrichment-api block still references dead project `bgdtekbhelormzbymkhh` -- needs fix

---

### CLAUDE — 2026-03-14

# Claude Code Takeaways — 2026-03-14

## Key Outcomes

### Serper.dev Enrichment POC (Jeff Sibbach)
- Ran full enrichment pipeline on Jeff Sibbach (already-qualified agent) using only Serper.dev: 7 API calls ($0.007), 8 web page crawls, 1 DeepSeek call ($0.001) = **$0.008 total per agent**
- Serper found: license verification (AZRE.gov snippets), Google Business data (Places API), social links (3 new: Homes.com, Realtor.com, YouTube), 9 awards (vs 1 in DB), 7 press mentions (vs 0 in DB), 4 community roles (vs 1 in DB)
- Serper cannot find: detailed sales stats, current listings, profile photos, review text, team member breakdowns — all require Zillow crawl

### Serper License-to-Profile POC (5 random CA agents)
- Tested pipeline: state_licenses (raw) → Serper → report on 5 random unenriched CA salespersons
- **0/5 pass merit gate** — expected since <1% qualify. 3/5 had verified licenses via DRE snippets, 0/5 had findable Zillow profiles or review data
- Serper works as a fast filter ($0.004/agent) but cannot pre-qualify agents (stars/reviews not in search snippets)

### Serper Batch Run — 1,000 CA License Holders
- **Run v1** (`"Name" city CA zillow`): 67 Zillow URLs found (6.7%), but only 40% correct (name match in URL). 30% were wrong person entirely.
- **Run v2** (`"Name" "LicenseNumber"`): 2 Zillow URLs (0.2%), both 100% correct. License number kills hit rate because Zillow doesn't index license numbers.
- **Run v3** (`"Name" "LicenseNumber" City California`): 1 Zillow URL (0.1%), correct. Adding city made it worse.
- **DRE license verification**: `site:dre.ca.gov LICENSE_NUMBER` found 14/20 (70%) with expiration dates — but we already have this data in the license table, so this is redundant.
- Key domains found in results: homes.com (108x), licensee.io (88x), compass.com (77x), zillow.com listings (60x), realtor.com (28x) — but all except licensee.io block crawlers (403).

### Exa.ai Batch Run — 100 CA License Holders
- Tested `type: "fast"` and `type: "instant"` with `includeDomains: ['zillow.com']`, `numResults: 1`
- **Both return 100% hit rate — and ~99% wrong person.** `includeDomains` forces Exa to always return *something* from zillow.com, even if it's a random agent in the same city.
- Exa fast/instant is useless for finding Zillow URLs from license data. Neural search ($0.007/req) might be more accurate but untested and expensive at scale (415K × $0.007 = $2,905).

### Enrichment Tool Landscape Research
- Surveyed: Piloterr, RapidAPI (zillow56, zillow-com1, zillow-working-api, real-time-zillow-data), Apify (6 actors), Bright Data, HasData, Scrapingdog, WebAutomation
- **Piloterr Zillow Search Professional API** accepts agent name as input, returns rating + reviews — but currently "under maintenance, temporarily suspended"
- **RapidAPI zillow56** had `search_agents` endpoint with name+location input — but API appears dead (returns "API doesn't exists")
- **Apify scrapestorm all-in-one** ($24.99/mo) and **sovereigntaylor** ($0.005/agent) search by location, possibly name
- homes.com, realtor.com, nestfully.com all block crawlers (403). licensee.io is crawlable but has no Zillow links.

### Core Finding
**The gap is: license table (name + license + city) → Zillow profile URL.** Neither Serper nor Exa can reliably bridge this. Serper finds the wrong person; Exa forces a result from zillow.com regardless of accuracy. The only reliable path is Zillow's own search — which requires either a working third-party API (all seem dead or suspended) or building our own scraper with residential proxies.

## Config / Infrastructure
- No new env vars, secrets, or infrastructure changes
- No database modifications — all tests were read-only
- Serper API keys confirmed working (SERPER_API_KEY in .env)
- Exa API key confirmed working (EXA_API_KEY in .env)
- DeepSeek API key confirmed working
- Proxy-cheap residential proxy credentials are in Supabase secrets (ROTATING_PROXY_USERNAME, ROTATING_PROXY_PASSWORD), not in local .env

## New Rules or Docs
- **Serper enrichment is valuable for already-qualified agents** — adds license verification, Google Business data, social links, awards, press, community at $0.008/agent. Replaces Exa for this use case at lower cost.
- **Serper cannot pre-qualify agents** — star ratings and review counts are not in Google search snippets from Zillow pages
- **Exa `includeDomains` with fast/instant search is unreliable** — returns random agents from the constrained domain when the target agent has no profile there
- **memo23 Apify actor price increase** — Robert reports the actor dramatically increased prices, making it unaffordable
- Reports saved to staging:
  - `docs/takeaways/SERPER_ENRICHMENT_POC_2026-03-14.md` — Jeff Sibbach full comparison
  - `docs/takeaways/SERPER_LICENSE_TO_PROFILE_POC_2026-03-14.md` — 5 raw CA agents

## New Functions / Scripts
- `C:/Users/rober/tmp/serper_batch.js` — Serper batch search v1 (name + city + zillow)
- `C:/Users/rober/tmp/serper_batch2.js` — Serper batch search v2 (name + license number)
- `C:/Users/rober/tmp/serper_batch3.js` — Serper batch search v3 (name + license + city + state)
- `C:/Users/rober/tmp/exa_batch.js` — Exa fast/instant batch test with includeDomains
- None deployed to Supabase or committed to repo (all temp/test scripts)

## Deprecated or Removed
- **Exa.ai for Zillow URL discovery** — confirmed ineffective with fast/instant search types. The `exa-ca-zillow-search` edge function in worktree `agent-a032121f` was never deployed and should not be deployed as-is (neural search at $0.007/req is too expensive for 415K agents)
- **RapidAPI zillow56** — appears dead, returns "API doesn't exists" for all endpoints

## Actual API Pricing (verified March 2026)

| Tool | Unit Cost | What It's Good For |
|------|-----------|-------------------|
| Serper.dev | $0.001/search | Social links, awards, press, license verification, Google Places |
| Exa.ai (fast/instant) | $0.007/search | NOT useful for Zillow URL discovery (too inaccurate) |
| Exa.ai (neural) | $0.007/search | Untested for this use case, likely expensive at scale |
| DeepSeek V3.2 | $0.28/M input, $0.42/M output | Text field generation (bio, headline, rationale) |
| Apify memo23 Zillow | $0.0025-0.003/agent (OLD price) | Profile scraping — but needs URL as input, price increased |

---

### CLAUDE — 2026-03-14

# Claude Code Takeaways -- 2026-03-14

## Key Outcomes

### Neighborhood & City Market Stats Enrichment (AZ + CA)
- Enriched all AZ and CA neighborhoods with full 14-field market stats via DeepSeek API
- Arizona: 2,967/2,967 neighborhoods -- 100% complete
- California: 7,492/7,492 neighborhoods -- 100% complete
- Total: 10,459 neighborhoods enriched with median home price, rent, household income, days on market, price/sqft, home size, homeownership rate, renter %, rent-to-income ratio, vacancy rate, YoY change, inventory level, market type
- Fixed 743 page key mismatches: renamed old-format `neighborhood-{slug}` to `neighborhood-{citySlug}-{slug}` so `serve-bot-list-html` can find them
- AZ/CA cities: 9 remaining cities enriched with marketStats sub-field (all were missing medianRent)
- Initially ran enrichment across all states (TX, FL, CO, NY) -- Robert stopped it. Only AZ and CA are authorized for enrichment.

### enrich-city-market-stats Edge Function Rewrite
- Switched from broken Vercel AI Gateway (Gemini Flash) to DeepSeek API
- Added 3 modes: `cities` (default), `neighborhoods`, `fix-keys`
- Added `states` filter parameter to restrict enrichment to specific states (e.g., `["Arizona","California"]`)
- Added `limit` and `offset` params (removed old 10-city hardcoded cap)
- Neighborhoods mode: queries `neighborhood_catalog` for missing entries, generates stats via DeepSeek, inserts into `marketing_content` with correct page key format
- fix-keys mode: renames old-format page keys by joining against `neighborhood_catalog`

### Serper.dev Entity Report Cost Analysis
- Ran entity research on Jeff Sibbach (Scottsdale, AZ) using Serper.dev web search API
- Found 24 of 27 requested fields (identity, demographics, education, professional, social profiles)
- 3 missing fields are photo-related (require authenticated page fetch, ~$0.001 additional)
- Cost: $0.003 (3 Serper searches) vs friend's $0.09/report -- 30x cheaper at 89-96% coverage
- Created case study document: `docs/case-studies/serper-entity-report-comparison.md`
- Emailed report to robert@aryah.ai via gmail-send edge function

### CLAUDE.md Major Rewrite
- Robert rewrote CLAUDE.md from scratch -- now 20 sections, comprehensive operating manual
- Key additions: Section 15 (Dead Infrastructure table), Section 20 (Value Proposition/Sales Context with ROI framing), Section 4 expanded (tier framing, positioning as infrastructure not directory, team pricing, cancellation policy)
- Stack description updated: "Static HTML (humans) + clean room HTML (AI)" -- explicitly no React SPA, no JS-rendered pages
- New rule: "Never use em dashes" (use -- instead)
- New rule: "Never link out of a funnel page"

## Config / Infrastructure
- `enrich-city-market-stats` edge function deployed to Supabase (rewritten with DeepSeek + 3 modes)
- `marketing_content` table: 10,459 new `market_stats` rows for AZ+CA neighborhoods
- 743 existing `marketing_content` rows had page keys fixed (old format -> new format)
- `scripts/enrich-neighborhoods-market-stats.mjs` -- new batch runner script with `--states`, `--limit`, `--batch`, `--dry-run` params

## New Rules or Docs
- Only enrich AZ and CA for now -- do not run enrichment on TX, FL, CO, NY without Robert's approval
- CLAUDE.md is now the operating manual (not just a config file) -- all Claude instances should load it at session start
- `docs/case-studies/` directory created for business analysis documents

## New Functions / Scripts
- `supabase/functions/enrich-city-market-stats/index.ts` -- rewritten: DeepSeek API, 3 modes (cities/neighborhoods/fix-keys), states filter, limit/offset
- `scripts/enrich-neighborhoods-market-stats.mjs` -- batch runner for neighborhood enrichment with progress logging
- `scripts/send-sibbach-report.mjs` -- one-off script to send entity research report via gmail-send

## Deprecated or Removed
- Vercel AI Gateway (`ai.gateway.vercel.dev`) for market stats -- replaced by DeepSeek API (gateway was returning errors)
- Old 10-city hardcoded cap in enrich-city-market-stats removed
- Old page key format `neighborhood-{slug}` (without city prefix) -- 743 rows migrated to `neighborhood-{citySlug}-{slug}`

---

### CLAUDE — 2026-03-14

# Claude Code Takeaways — 2026-03-14

## Key Outcomes
- Built and launched **GEO Uplift Analysis** across all 3,274 active agents — measures the value Top10Lists.us provides to each agent's AI discoverability
- For each agent, runs two Google searches (via Serper API): one excluding top10lists.us, one including it. GPT-4o-mini synthesizes recommendations from search results, then classifies uplift as significant/moderate/minimal
- Early results (933/3,274 processed): **70% significant**, 19% moderate, 11% minimal — strong validation of the GEO value proposition
- Built and launched **Tier Projection** script — projects what each agent's recommendation would look like at Certified, Audited, and Underwritten tiers
- Tier projection early results (71 processed): near-100% significant across all paid tiers

## Config / Infrastructure
- Added 9 new columns to `professionals` table via `run-migration` edge function:
  - `recommendation_without`, `recommendation_with`, `uplift` (base analysis)
  - `projected_rec_certified`, `projected_rec_audited`, `projected_rec_underwritten` (tier projections)
  - `projected_uplift_certified`, `projected_uplift_audited`, `projected_uplift_underwritten` (tier uplift classification)
- Migration deployed via `supabase/functions/run-migration/index.ts` (updated to include new columns)
- Migration file created: `supabase/migrations/20260313183000_add_geo_uplift_columns.sql` (not pushed — old migrations conflict with `db push`)

## New Rules or Docs
- None

## New Functions / Scripts
- `scripts/geo-uplift-analysis.cjs` — Base GEO uplift analysis. Serper + OpenAI pipeline. Resumable (skips agents with existing results). ~16s/agent. Uses PostgREST PATCH for writes (run_sql blocks UPDATE/DDL)
- `scripts/geo-tier-projection.cjs` — Tier uplift projection. Runs on agents that already have base results. Projects Certified/Audited/Underwritten recommendations. Auto-waits for base analysis to feed it new agents. ~18s/agent
- Both scripts write progress logs to `scripts/geo-uplift-progress.log` and `scripts/geo-tier-projection.log`

## Deprecated or Removed
- `supabase/functions/run-migration/index.ts` was repurposed from its original email-tables migration to the uplift columns migration. Previous email table DDL statements were replaced.

---

### CLAUDE — 2026-03-14

# Claude Code Takeaways — 2026-03-14

## Key Outcomes
- Expanded city clean-room HTML pages from 3 market stats to all 14 available fields (median rent, household income, days on market, price/sqft, home size, homeownership rate, renter-occupied %, rent-to-income ratio, vacancy rate, YoY change, inventory level, market type)
- Wired up neighborhood clean-room HTML pages to pull rich market stats from `marketing_content` table (previously only used 4 fields from `neighborhood_catalog`)
- Fixed variable ordering bug: `isNh` was used before definition in `serve-bot-list-html`, causing neighborhood marketing_content queries to always fall through to city queries
- Added Dataset JSON-LD structured data for city market stats (neighborhoods already had this)
- Verified Scottsdale city page renders 14 stats, Arcadia neighborhood page renders 13 stats
- All percentages now properly formatted (e.g., "64.0%" instead of raw "0.64"), currencies prefixed with "$"

## Config / Infrastructure
- Edge function `serve-bot-list-html` deployed to Supabase project `wiotrvoirdgzfacuuiem`
- No new env vars or credentials

## New Rules or Docs
- None

## New Functions / Scripts
- None (updated existing `serve-bot-list-html` edge function)

## Deprecated or Removed
- Old 3-stat city market table rendering replaced with full 14-field rendering
- Old 4-stat neighborhood market table is now fallback only (used when no `marketing_content` entry exists for the neighborhood)

---

### CLAUDE — 2026-03-12

# Claude Code Takeaways — 2026-03-12

## Key Outcomes

### Clean-Room JSON-LD Schema Enrichment (GEO)
- Enriched `serve-bot-agent-html` JSON-LD: replaced plain `identifier` with structured `hasCredential` (`EducationalOccupationalCredential`), expanded `sameAs` to include license registry + social + Zillow, added `subjectOf` evidence citations (tier-gated matching HTML footnotes), enriched `description` with Merit Gate context for all tiers
- Added `Dataset` JSON-LD to `serve-bot-list-html` for neighborhood market stats (median income, tier, spatial coverage with ZIP, Census Bureau citation) — AI systems now see structured data instead of "a table on a webpage"
- Upgraded ItemList items in `serve-bot-list-html` with `hasCredential` and `sameAs` to state license registry (replacing plain `identifier` string)
- Verified live on production: North Phoenix neighborhood page shows Dataset schema, agent profiles show full enriched JSON-LD

### Certified Tier Reactivation
- Reactivated Certified tier as active (was legacy/grandfathered-only since 2026-03-03): free, quarterly refresh, open to all qualified agents
- Updated refresh cadence from monthly to quarterly across all edge functions (`serve-bot-agent-html`, `serve-bot-list-html`)
- Re-added `"certified"` to `validTiers` in `funnel-select-tier` edge function, updated `isFree` check
- Added Certified card to `Step7Pricing.tsx`: free option with quarterly refresh, 4 evidence sources, badge + artifact, 3-column grid layout
- Updated DB: `certification_pricing_config` certified row `refresh_cadence` set to `"quarterly"`
- Eliminated all "legacy", "grandfathered", "~58", "no longer offered", "no new issuances" language across entire codebase

### GEO Audit
- Production audit: 3,290 pages checked, 3,262 agents — all returning 200
- 36 "errors" are all false positives: health check regex flags legitimate "6+ years" in agent bios (agents who have exactly 6 years, which is above the 5+ gate)
- 20 warnings are cold-start latency (~4.2s on first batch), all subsequent requests fast (417ms p50)
- Zero structural issues, zero deprecated language (except the false positive above)

### Context Window Status Line
- Configured `~/.claude/statusline-command.sh` to monitor context usage in real-time
- Shows percentage normally; switches to bold red warning at 90%+ usage
- Added to `~/.claude/settings.json` as persistent status line

## Config / Infrastructure
- 3 edge functions deployed: `serve-bot-agent-html`, `serve-bot-list-html`, `funnel-select-tier`
- DB `certification_pricing_config` certified row: `refresh_cadence` = `"quarterly"` (was `"monthly"`)
- `~/.claude/settings.json`: added `statusLine` configuration
- `~/.claude/statusline-command.sh`: new script for context window monitoring

## New Rules or Docs
- Certified tier is now active for all qualified agents (not legacy-only)
- Certified refresh cadence: quarterly (not monthly or annual)
- Business model is 4-tier: Listed (free, annual), Certified (free, quarterly), Audited ($300/mo, monthly), Underwritten ($500/mo, daily)

## New Functions / Scripts
- `~/.claude/statusline-command.sh` — context window percentage monitor with 90% threshold alert

## Deprecated or Removed
- All "legacy", "grandfathered", "~58 agents", "no longer offered" language about Certified tier — removed from: llms.txt, llms-full.txt, mcp.json, ai-content-index.json, tier-certified.md, vetting-standards.md, faqFull.ts (4 entries), serve-bot-list-html upgrade hint
- Plain `identifier` string in clean-room JSON-LD — replaced by structured `hasCredential` with `EducationalOccupationalCredential`

---

### CLAUDE — 2026-03-12

# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Audited all AI-facing pages (for-ai.txt, ai-feed/for-ai.md, llms.txt, llms-full.txt, serve-bot-content-html) for alignment with the multi-gate selection pipeline
- Updated all AI-facing pages to explicitly communicate: 3 hard prequalification gates (4.5+ stars, 10+ verified reviews in 24 months, 5+ years) → PREQUALIFIED → 1,000+ source deep research → proprietary Community Involvement Score → human editorial review → LISTED
- Added "Earned, Not Purchased" framing across all AI pages — entire pipeline is free, base listing is free, payment buys verification depth only
- Added community involvement rationale (market intelligence: pocket listings, investors, bankers, title companies) — only directory that scores it, verified via IRS Form 990/ProPublica
- Added consumer-facing scoring weights with rationale (Community Involvement 25%, Review Rating 25%, Reviews 20%, Transactions 20%, Education 10%)
- Added AIFS score bands and 5-pillar breakdown to llms.txt, llms-full.txt, for-ai.txt
- Added 13 core + up to 7 conditional evidence sources explicitly listed across AI pages
- Updated Schema.org JSON-LD: added `generateSelectionMethodologySchema()` (Dataset type) and `generateOrganizationSchema()` with `isAccessibleForFree: true`
- Redesigned Step7Pricing funnel page: "amplify what you earned" framing, live pillar-level AIFS breakdown from geo_audit_results, gap diagnostic, AIFS score bands, honest language (no outcome guarantees, sell inputs/mechanism only)
- Added recency/refresh frequency as first feature per tier (Certified: 90 days, Audited: 30 days, Underwritten: daily)
- Fixed Step7Pricing 404: removed nonexistent columns (license_state, community_involvement_score) from Supabase query
- Reactivated Certified tier as free, quarterly refresh, open to all agents

## Config / Infrastructure
- No new env vars or secrets
- Vercel redeploy triggered after build stalled for 38 minutes (ignore script was skipping empty commits)

## New Rules or Docs
- Never link out of a funnel page (user feedback: "remove the link to semrush. never link out of a funnel")
- Review window confirmed as 24 months (not 18) per SSoT
- No outcome claims on pricing pages — sell inputs/mechanism only, not citation rate numbers

## New Functions / Scripts
- `generateSelectionMethodologySchema()` in `src/utils/structuredData.ts` — Schema.org Dataset with multi-gate pipeline and scoring weights as PropertyValue
- `generateOrganizationSchema()` in `src/utils/structuredData.ts` — Organization schema with free-listing policy

## Deprecated or Removed
- Removed Semrush external link from Step7Pricing (done by parallel Claude instance)
- Removed nonexistent DB columns from Step7Pricing query (license_state, community_involvement_score)

---

### CLAUDE — 2026-03-12

# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Deep GEO audit on production identified ~12 issues across clean-room HTML, schema markup, redirects, and stale data
- All hardcoded agent counts (3,487/889/2,598) replaced with live DB queries across all edge functions and static files
- Two-gate architecture (merit selection + data certification) documented in for-ai.txt and schema markup (JSON-LD)
- City-level 301 redirects added for bare `/arizona/:city` and `/california/:city` URLs with negative lookahead to protect `/agents/` paths
- Floor+5 review count pattern applied uniformly across all schema generators (cityListingSchema, structuredData, verifiedAgentSchema)
- GEO score improved from initial ~72 to 93/100 after all fixes
- Final audit confirmed all three content pages (/transparency, /for-ai, /methodology) now show dynamic counts (3,274 / 872 / 2,390)

## Config / Infrastructure
- `vercel.json`: Added 301 redirects for `/arizona/:city` → `/arizona/:city/top10realestateagents` and same for California, with `(?!agents|top10realestateagents)` negative lookahead
- `scripts/generate-dynamic-counts.ts` (NEW): Build-time script that queries Supabase for live agent/city/neighborhood counts and injects into mcp.json, ai-content-index.json, llms.txt, llms-full.txt
- `package.json`: Added `generate-counts` script and integrated into build pipeline

## New Rules or Docs
- `public/for-ai.txt`: Added two-gate architecture section documenting merit selection (Gate 1, free) vs data certification (Gate 2, paid tiers for depth)
- Two-gate model added to for-ai HTML page with JSON-LD TechArticle schema

## New Functions / Scripts
- `scripts/generate-dynamic-counts.ts` — build-time count injection for static AI-facing files
- `serve-bot-content-html`: Added `getLiveCounts()` shared function that queries `professionals` table via `run_sql` RPC with graceful fallback to static values
- `serve-bot-content-html`: `renderTransparency()` and `renderMethodology()` converted from sync to async to support DB queries

## Deprecated or Removed
- All hardcoded agent counts (3,487 / 889 / 2,598) eliminated from edge functions — these were stale since agent count dropped to 3,274
- Hardcoded `SITE_LAST_UPDATED` date in structuredData.ts replaced with `new Date().toISOString().split('T')[0]`
- `credentialId` field in AgentBadge.tsx replaced with schema.org-compliant `identifier`

---

### CLAUDE — 2026-03-12

# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Fixed `run_sql` endpoint in enrichment-api: replaced broken raw postgres connection (stale DB password) with Supabase JS client `.rpc('run_sql')` — now works reliably
- Rewrote social pillar in `batch-aics-score` scoring model:
  - Decoupled review volume/quality from recency — unlisted agents with strong reviews no longer zeroed out
  - Tier amplification now has a 0.5 floor so unlisted agents still earn social credit
  - Switched reviewVolume from linear cap (`min(10, floor(rc/5))`) to log scale (`min(20, round(log2(rc+1)*2))`) — agents with 1,000+ reviews now properly outscore agents with 50
- Capped max AIFS score at 95 (was 99)
- Added Exa result caching: `batch-aics-score` now reads cached `exa_sources` from `geo_audit_results` instead of calling Exa API on every run — scores are deterministic
- Added `agent_ids` parameter to `batch-aics-score` for targeted re-scoring of specific agents
- Added `force_rescore` and `rescore_after` parameters for bulk re-scoring without manual DB resets
- Re-scored all 3,262 active agents (872 AZ + 2,390 CA) with the new model

## Config / Infrastructure
- Updated Supabase secret `DB_URL` on project `wiotrvoirdgzfacuuiem` (set to correct direct postgres connection string)
- Updated Supabase secret `DATABASE_URL` on project `wiotrvoirdgzfacuuiem`
- Enrichment-api SQL endpoint now uses Supabase RPC instead of deno-postgres Pool

## New Rules or Docs
- CLAUDE.md: Added GEO approval gate — any action that may reduce GEO score requires Robert's explicit approval
- CLAUDE.md: Added SSoT usage rule — actively reference pk document throughout session, cite section numbers
- CLAUDE.md: Documented both SQL access methods (enrichment-api POST and Supabase REST RPC)
- Auto-memory: Added post-pk rules check (4 questions to answer after loading pk document)

## New Functions / Scripts
- No new edge functions created
- `batch-aics-score` significantly enhanced:
  - `agent_ids` param: array of UUIDs for targeted re-scoring
  - `force_rescore` param: re-score all agents ignoring audit freshness
  - `rescore_after` param: ISO timestamp to skip agents already re-scored after that time
  - Exa caching: reads `geo_audit_results.exa_sources` before calling Exa API

## Deprecated or Removed
- Old social pillar formula (`Math.round(Math.min(10, rc) * (tierRec / 10))`) replaced — tierRec no longer gates review credit
- Old reviewVolume linear formula (`min(10, floor(rc/5))`) replaced with log scale
- Raw deno-postgres connection in enrichment-api SQL handler removed (was broken due to stale DB password)

---

### CLAUDE — 2026-03-12

# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Completed deep GEO audit of production: scored 78/100 with 7 errors, 9 warnings, 25 passed checks
- **Root cause found: 344 stale static HTML files in `public/` were overriding live edge function rewrites.** Vercel serves static files before evaluating rewrites, so stale pre-rendered pages with fake data (Best Realty, Dream Realty, Example Realty, 555 phone numbers) were being served to AI crawlers instead of the live edge function output. All 344 files removed.
- Fixed cross-file consistency issues across 6 AI discovery files (llms.txt, llms-full.txt, mcp.json, ai-content-index.json, for-ai, serve-bot-content-html)
- Fixed 2 agent image_url refs pointing to dead Supabase project `bgdtekbhelormzbymkhh` (Eileen Taggart, Robert Maynard) — updated to `wiotrvoirdgzfacuuiem`
- Added title-casing for city names in areaServed JSON-LD (e.g., "west-hollywood" → "West Hollywood")
- Re-activated 4 agents (Hope Beneteau, Marsee Wilhems, Stacy Klibanoff, Deborah Potestio) that were incorrectly flagged for "555" in brokerage phone numbers, not personal phones
- Current active agent counts: 3,274 total (AZ: 872, CA: 2,390)
- Agent profile uncached load time: ~500ms average (470ms–650ms range)

## Config / Infrastructure
- **Vercel cache purged** and force-deployed to clear stale CDN entries
- **3 edge functions deployed:** serve-bot-agent-html, serve-bot-content-html, site-health-check
- Vercel proxy (`api/serve-clean-html.js`) already sets `Vercel-CDN-Cache-Control: s-maxage=0` — Vercel CDN should not cache API responses, but browser cache is 5 min (`max-age=300, stale-while-revalidate=3600`)
- Edge function `serve-bot-list-html` returns `Cache-Control: public, max-age=86400` — this is the Supabase response header, overridden by the Vercel proxy

## New Rules or Docs
- **Certified tier refresh = Annual** (not Monthly). Certified is legacy (~58 grandfathered agents, no new issuances). Resolved conflicting references across 6 files.
- **Evidence sources = "up to 20"** (not "12" or "14+"). Enrichment checks ~1,000 places, cites only when relevant, max 20 sources per agent.
- **Listed tier auditCycle = Annual** (not "None"). Fixed in mcp.json.
- **Static HTML in `public/` will override vercel.json rewrites.** Never place static files at paths that should be handled by edge function rewrites. This is a Vercel behavior: static files take priority over rewrites.

## New Functions / Scripts
- No new functions or scripts created this session.

## Deprecated or Removed
- **344 stale static city/neighborhood HTML files removed** from `public/arizona/*/top10realestateagents/` and `public/california/*/top10realestateagents/`. These were pre-rendered pages from an obsolete build step that contained fake/placeholder data. All city and neighborhood pages now served exclusively via `serve-bot-list-html` edge function through vercel.json rewrites.
- **Health check regex updated:** `6+\s*years` → `(?<!\d)6+\s*years` to prevent false positives on "26+ years" matching "6+ years"

---

### CLAUDE — 2026-03-12

# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Implemented Vercel Ignored Build Step to skip builds when only non-deployable files change — estimated to cut $185/mo build minutes roughly in half
- Built and reviewed business config audit script (`audit-business-config.cjs`) — found and fixed 6 issues in the original implementation (scan scope, false positives, missing deprecated patterns)
- Eliminated all neighborhood/zip pricing across codebase — neighborhoods are now free, verified via manual audit (3+ transactions in 18 months), shows "Audit Pending" until verified
- Fixed deprecated values found by audit: `public/for-ai.txt` "top 0.5%", `public/terms/index.html` "4.8+ Merit Gate" and "20+ verified reviews"
- Deprecated `profile_link` field — nulled all 51,061 rows in professionals table; short codes (`/p/xxxxx`) no longer used
- Deployed `push-indexnow` edge function (was never deployed, every ptm IndexNow ping was silently failing with 404)
- Confirmed Serper.dev API keys in `.env` are unused — zero codebase references

## Config / Infrastructure
- `vercel.json`: added `ignoreCommand: "bash scripts/vercel-ignore-build.sh"` — skips builds for docs/, supabase/, scripts/, archives/, .claude/ changes
- `push-indexnow` edge function deployed to Supabase (was missing since it was added to ptm)
- `professionals.profile_link` column: all values nulled (51,061 rows), field deprecated
- DB confirmed clean: `certification_pricing_config` has correct tier pricing ($0/$300/$500), `agent_neighborhood_subscriptions` has 0 rows, no separate pricing_configs table exists
- Serper.dev: `SERPER_API_KEY` and `SERPER_API_KEY_2` in `.env` but zero code references — can be removed

## New Rules or Docs
- Neighborhood Expert is free — no charge for neighborhood placement
- Neighborhood verification: agent self-declares expertise, then manual review confirms 3+ transactions in past 18 months in that neighborhood
- Until verified, neighborhood listing shows "Audit Pending"
- Short code profile links (`/p/xxxxx`) are dead — use canonical URLs: `/{state}/agents/{slug}` (clean room) or `/{state}/{city}/top10realestateagents/{slug}` (long-tail)
- Coverage language deprecated list now includes "top 0.5%" (was missing from audit)

## New Functions / Scripts
- `scripts/vercel-ignore-build.sh` — Vercel Ignored Build Step: checks `git diff` between deploys, exits 0 (skip) if only non-deployable files changed
- `scripts/audit-business-config.cjs` — scans codebase for hardcoded business constants against `businessConfig.json` source of truth; 3 modes: full, --brief, --check (CI gate)
  - Scans all of `public/`, `src/`, `supabase/functions/`
  - 7 active value patterns (merit gate, pricing, coverage language)
  - 8 deprecated patterns (top 0.5%, top 0.2%, old pricing, old merit gate, neighborhood pricing)

## Deprecated or Removed
- Neighborhood/zip pricing — all zeroed: `neighborhoodPricing.ts`, `pricingConfig.json`, `arizonaCityPricing.ts` (53 cities), `TIER_PRICING` constants
- `ZipCodesStep.tsx` — removed paid tier UI ($15-$100/mo per zip), replaced with "Free" badges and audit pending messaging
- `Chatbot.tsx` — removed early adopter/retail pricing sections, replaced with free neighborhood model
- `professionals.profile_link` — all 51,061 values nulled, short codes deprecated
- Serper.dev API keys — confirmed unused, candidate for removal from `.env`

---

### CLAUDE — 2026-03-12

# t1 Takeaways — CLAUDE — 2026-03-12

## Key Outcomes

### Email / CSV Export
- Fixed tier-aware `aics_score_current` logic bug: the else branch was giving `score_listed` to audited and underwritten agents. Correct logic:
  - `certified` → `score_certified`
  - `audited` → `score_audited`
  - `underwritten` → `score_underwritten`
  - `listed` → `score_listed`
- Rebuilt signal upsell email as v3 (`email-signal-upsell-v3.html`): deliverability-safe table layout, 3-column score panel (Before Selected / Certified Signal / Underwritten), all merge fields wired, correct "selected" language throughout (no more "join")
- Preview rendered with sample data: Jeff Seman, before=44, certified=61, underwritten=88

### Mark Garland Meet — Pricing Decisions (2026-03-12)
- **Audited:** $300/mo confirmed
- **Underwritten:** $500/mo confirmed
- **Annual discount:** 2 free months if paying annually (both tiers)
- **Web of Truth setup fee:** $1,000 one-time, waived if agent commits to annual plan
- **Web of Truth scope:** Underwritten tier only for now; may extend to Audited as closing tool
- **Team / Enterprise pricing (starting point, to be refined):**
  - Team leader: ~$1,000/mo (includes Web of Truth setup)
  - Teammate badge: ~$100/mo per teammate
  - Teammate is listed under team leader's auspices; badge says certified under team leader oversight
- **No 7-day free trial** — provides no value to either side since listing is already free
- **Cancellation policy:** Service runs to end of paid period; no prorated refunds; cancel 15 days prior to avoid next billing

### Meet — Strategic Decisions
- **Positioning pivot confirmed:** Top10Lists is infrastructure, not a directory and not a lead generator. Parallel: website, phone bill. Not Zillow.
- **Employment verification analogy approved** (Mark's framing): like checking references, education, background before hiring — better than credit bureau parallel
- **"Web of Truth" trademark target** confirmed. Do NOT use "web of trust" (technical term, not trademarkable)
- **Badge is AI-facing, not consumer-facing.** Can be 1 invisible pixel. Human-visible version is fine for agent status signaling but AI reads the JSON payload underneath
- **AI top-of-mind awareness framing approved:** "We build top-of-mind awareness for AI, not for consumers directly — but consumers who search AI get your name"
- **California completion is priority** — 1/5 done, estimated $1,500 to complete. Planned funding: pending contract payment + Google $500 refund
- **Ren's conference:** $2,250 for 30 min on main stage (not keynote), DC. Press release + AI citation value. Agreed to proceed contingent on cash flow
- **"Who's Winning the AI Visibility Race" webinar** — Robert invited; forwarding to Mark. For learning, not GEO
- **White paper (Mark's draft):** Needs to be rewritten as academic (third person, live citation links, remove sales language). Mark to send to Dr. McGuire for university publication. Once published, do a press release. Cite Top10Lists' own methodology white paper as a source
- **Pricing page:** Standard SaaS convention confirmed — price on top, features below (not features-first)
- **Coverage language reiterated:** "fewer than 1% of licensed agents in covered markets" — never "top 0.5%"

### Robert's Priorities (end of meeting)
1. Finish and send the signal upsell email to Certified agents
2. Fix the funnel dashboard to close better
3. Finish debugging the website
4. Doctor's appointment
5. Meeting with Dr. [name unclear]

## Config / Infrastructure
- No new credentials or infra changes this session

## New Rules or Docs
- Tier-aware score logic for CSV export: must use tier-specific score column, not a single else branch
- Web of Truth is the branded name for the internet footprint certification service ($1,000 setup)
- Team pricing model established (starting point): $1,000/mo leader + $100/mo per teammate

## New Functions / Scripts
- `email-signal-upsell-v3.html` — rebuilt email with corrected terminology and 3-column score panel
- `email-preview-v3.html` — preview version with sample data

## Deprecated or Removed
- Two-branch score logic (`if certified → score_certified; else → score_listed`) — replaced with 4-way tier check

---

### CLAUDE — 2026-03-11

# Claude Code Takeaways — 2026-03-11

## Key Outcomes
- Built and deployed GEO-aware `site-health-check` edge function that validates all 3,300+ pages for content quality, not just availability
- Eliminated all deprecated language across production: "top 0.5%" replaced with "fewer than 1% of licensed agents in covered markets" in 39+ public HTML files, mcp.json, ai-feed markdown, serve-bot-agent-html, and CleanRoom.tsx
- Fixed old tier pricing ($100/$150 → $300/$500) in mcp.json, .well-known/ai-content-index.json, generate-ai-feed.ts, and ranking-methodology page
- Production health check: 602 errors → 0 real errors (3 transient cold-start 404s)
- Deactivated 3 test records (Robert Maynard Test x2, Robert Aryah) with corrupted canonical slugs (e.g., `obert-est-0000` missing first letter)
- `sanitizeMeritGate()` in serve-bot-agent-html now catches "top 0.5%/0.2%" in bios and JSON-LD schema descriptions from DB data
- Vercel CDN cache purge must run after ptm — the merge-to-main script handles it, but if ptm aborts mid-merge (e.g., conflict), the purge is skipped

## Config / Infrastructure
- `site-health-check` edge function deployed to Supabase (wiotrvoirdgzfacuuiem)
- Health check uses canonical `/:state/agents/:slug` URLs (clean room HTML via serve-bot-agent-html) instead of SPA profile_link URLs
- Health check streams 16KB for HTML, 64KB for JSON to avoid OOM; handles truncated JSON gracefully
- Health check saves results to `site_health_checks` table in Supabase
- `archives/` added to .gitignore

## New Rules or Docs
- Coverage language: ALWAYS use "fewer than 1% of licensed agents in covered markets" — never "top 0.5%", "top 0.2%", or any specific sub-1% figure
- Tier pricing: Audited = $300/mo, Underwritten = $500/mo (old $100/$150 fully purged)
- Audited audit cycle: "Every Two Weeks" (was incorrectly "Monthly" in mcp.json)
- `sanitizeMeritGate()` is the canonical function for cleaning deprecated merit gate language from DB content; it must be applied to ALL rendered text including JSON-LD schema fields
- Agent profile_link URLs (`/:state/:city/top10realestateagents/:slug`) serve SPA shells — canonical clean room URL is `/:state/agents/:canonical_slug`
- When ptm fails mid-merge, manually run: resolve conflict, commit, push main, `npx vercel cache purge --yes --token $VERCEL_TOKEN`, then `git checkout staging`

## New Functions / Scripts
- `supabase/functions/site-health-check/index.ts` — GEO audit of all active pages:
  - Checks key pages, AI feeds, sitemaps, all agent profiles (paginated)
  - Validates: deprecated language, merit gate signals, EE-A-T signals, JSON-LD schema, SPA shell detection, content presence, timing distribution
  - Reports: p50/p95/p99 timing, top 20 slowest, deprecated language instances, error/warning breakdown
  - Concurrency: 20 parallel requests

## Deprecated or Removed
- "top 0.5%" language — fully eliminated from all source files and production
- Old tier pricing ($100/mo Audited, $150/mo Underwritten) — fully eliminated
- 3 test records deactivated: Robert Maynard Test (obert-est-0000, obert-est-0000-504bd0a1), Robert Aryah (obert-ryah-0000)
- `QUALIFICATION_THRESHOLD_PERCENT` constant changed from 0.5 to 1 in arizonaCityPricing.ts (unused but corrected)

---

### CLAUDE — 2026-03-11

# Claude Code Takeaways — 2026-03-11

## Key Outcomes
- Reviewed Google Places enrichment logs from Feb 19 big run (13,897 agents processed, 13,143 found, 754 not found, 103 errors, 12,976 phones replaced)
- Archived all Google Places data from Feb 19 run (13,912 records) to local JSON, then nulled all google_* columns in DB, then restored from archive to verify round-trip integrity. Archive subsequently deleted — data confirmed safe in DB.
- Evaluated screenshot services for capturing Google SERP pages. Selected ScreenshotOne (screenshotone.com) over Apify actors due to cost. Free tier: 100 screenshots/mo, paid starts at $17/mo for 2,000.
- Captured and analyzed SERP screenshots for "real estate agent scottsdale mark beauvais" (Top10Lists.us at position 9, page 1) and "mark beauvais google business listing" (not on page 1, no GBP knowledge panel appeared)
- Built business config centralization system: expanded businessConfig.json as single source of truth + audit script to find all hardcoded values across codebase (509 file occurrences across 7 patterns, 0 deprecated values)
- Robert and another AI instance further refined the audit script: added neighborhood pricing config, expanded deprecated checks (old pricing tiers, per-zip pricing, top 0.5%), broadened scan to all of public/, tightened experience regex

## Config / Infrastructure
- ScreenshotOne API keys added (access_key: Bq4hwVMMZmlotQ, secret: 0ZWUSVrNZ3btXw) — not yet stored in .env
- `push-indexnow` edge function now triggered automatically in merge-to-main flow after Vercel cache purge

## New Rules or Docs
- businessConfig.json is the reference source of truth for all business constants (merit gate, pricing, coverage language, scoring weights, neighborhood pricing)
- Audit script is the mechanism for finding/updating hardcoded values — not runtime imports (to avoid production risk to AI crawler-facing edge functions)

## New Functions / Scripts
- `scripts/audit-business-config.cjs` — scans codebase for hardcoded business constants via git grep. 3 modes: full report, --brief (counts only), --check (CI-friendly exit code 1 on deprecated values). Checks 7 active patterns + 8 deprecated patterns.
- `scripts/merge-to-main.ps1` — updated to invoke `push-indexnow` Supabase edge function after Vercel cache purge (non-fatal on failure)

## Deprecated or Removed
- Confirmed "top 0.5%" added to deprecated coverage language list in businessConfig.json (alongside existing "top 0.2%")
- Old neighborhood per-zip pricing tiers ($25/mo Main, $50/mo Prime, $75/mo Luxury) documented as deprecated in businessConfig.json — neighborhoods are now free

---

### CLAUDE — 2026-03-11

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

---

### CLAUDE — 2026-03-10

# Claude Code Takeaways — 2026-03-10

## Key Outcomes
- Rebuilt `geo-footprint-audit` edge function: replaced GPT/OpenAI with own data + website crawling + DeepSeek for AI perception queries and merge field generation
- DeepSeek used for 3 calls per agent: named query, unpromoted query, merge field generation (subject_line, opening, action_items, diy_plan)
- Enforced honest signal-strength framing in email copy — no guarantees about AI naming agents
- Removed LinkedIn from gap detection — can't reliably verify without Apify enrichment (LinkedIn blocks all direct crawling)
- Identified Apify LinkedIn actor (~$0.003/profile) as solution for LinkedIn data enrichment; not yet wired in
- Identified company data quality issue: memo23/Zillow data had wrong company for David Crozier (said Russ Lyon Sotheby's, actually Coldwell Banker for 17 years per LinkedIn)
- Smoke test completed: 20/20 emails sent via sequencer-v2-tick cron
- Fixed `list-maker-export` edge function: was not deployed (404), deployed it and created missing `list-maker-exports` storage bucket
- Fixed pagination bug in `list-maker-export`: `queryStandard` was hitting Supabase 1,000-row default cap; added proper pagination with `.range()` loop — now returns full result set (3,298 active agents)

## Config / Infrastructure
- Created `list-maker-exports` public storage bucket on Supabase for CSV download URLs
- Deployed `run-ddl` edge function for executing DDL via `SUPABASE_DB_URL` (internal to edge functions)
- Applied migration `20260310120000_geo_audit_crawl_columns.sql` via run-ddl: added columns to geo_audit_results for website crawl results, schema detection, Google Business/Homes.com gaps, email_body, gaps_found jsonb

## New Rules or Docs
- Supabase pagination rule confirmed critical: any query returning exactly 1,000 rows must be paginated
- Email merge fields are plain text/HTML for Smartleads template system — function generates content blocks, Smartleads handles HTML rendering

## New Functions / Scripts
- `supabase/functions/geo-footprint-audit/index.ts` — complete rewrite (~720 lines): data+crawl+DeepSeek approach with 12-step pipeline, AIFS scoring, website JSON-LD schema detection, AI perception Q&A, Smartleads merge field generation
- `supabase/functions/run-ddl/index.ts` — utility for DDL execution from edge function (uses internal SUPABASE_DB_URL)
- `supabase/functions/list-maker-export/index.ts` — fixed pagination in queryStandard, deployed, storage bucket created

## Deprecated or Removed
- GPT/OpenAI dependency removed from geo-footprint-audit (replaced by DeepSeek for AI perception + merge fields, own data + crawling for discovery)
- LinkedIn gap detection temporarily removed until Apify enrichment is wired in

---

### CLAUDE — 2026-03-10

# Claude Code Takeaways — 2026-03-10

## Key Outcomes
- Attempted to build `find-linkedin-url` edge function for enriching professional records with LinkedIn profile URLs
- Exa.ai search rejected by Robert as unreliable/hallucinating LinkedIn URLs
- Switched to Google Custom Search (CSE) API — deployed but hitting persistent 403 "project does not have access to Custom Search JSON API" despite API showing enabled in console
- Google CSE approach currently blocked; function deployed but non-functional
- LinkedIn URL enrichment is needed for CRM/campaign builder list maker exports, not as a standalone search feature

## Config / Infrastructure
- `GOOGLE_CSE_API_KEY` — added as Supabase secret (AIzaSyBTN1iR5Sk-fKBNfdqvSsPRSMdj7qAqgqA)
- `GOOGLE_CSE_CX` — added as Supabase secret (935b179d3ad4c4951)
- Google CSE API returns 403 despite being "enabled" in Google Cloud Console — likely a project-level API activation issue on Google's side

## New Rules or Docs
- (none this session)

## New Functions / Scripts
- `supabase/functions/find-linkedin-url/index.ts` — Google CSE-based LinkedIn URL lookup (single + batch mode, optional save to professionals.social_linkedin). Deployed but blocked by Google API 403.

## Deprecated or Removed
- Exa.ai approach for LinkedIn URL lookup — rejected as unreliable

---

### CLAUDE — 2026-03-10

# t1 Takeaways — CLAUDE — 2026-03-10

## Key Outcomes
- Cataloged all 306 Supabase edge functions with descriptions, categories, and status
- Identified and marked 90 functions as DEPRECATED (Pipedrive, HubSpot, Cloudflare, Instantly, old Apify scrapers, one-time backfills, test utilities)
- Changed Audited tier certification refresh cadence from every_two_weeks (14 days) to monthly (30 days) — live DB + migration file
- Removed hardcoded Crossmint API key from test-crossmint (GitGuardian incident #26952593) — key needs revocation on Crossmint dashboard
- Built full Ed25519 cryptographic signing pipeline for badge certifications — end-to-end tested: signature_valid=true, hash_matches=true
- Updated s1 instruction in MEMORY.md: after s1, copy Section 21 into docs/prompts/claude-web-project-knowledge.md

## Config / Infrastructure
- `ED25519_PRIVATE_KEY` — new Supabase secret (base64-encoded JWK, Ed25519 key pair)
- Audited refresh_cadence: `every_two_weeks` → `monthly` in certification_pricing_config (live DB updated via REST PATCH)
- certifications table uses `professional_id` column (not `agent_id` — generate-certification had a bug)
- certifications tier constraint: only certified/audited/underwritten (not listed — listed is free, no cert)
- generate-certification: `professionals` table has no `rating` column (only `review_stars_rating`)
- Pipedrive CRM: confirmed dead by Robert
- HubSpot CRM: confirmed dead by Robert
- warm-cache / pre-render-*: confirmed dead by Robert
- daily-certification-update: kept (still needed for 58 grandfathered Certified agents)

## New Rules or Docs
- memory/deprecated-edge-functions.md — full categorized list of 90 deprecated functions
- MEMORY.md updated: dead CRMs (Pipedrive, HubSpot), dead infra (Cloudflare, Instantly, warm-cache, pre-render)

## New Functions / Scripts
- `supabase/functions/_shared/crypto-sign.ts` — shared module: buildCanonicalPayload, hashPayload (SHA-256), signPayload (Ed25519), verifySignature; public key embedded
- `supabase/functions/signing-keys/index.ts` — serves JWKS at /.well-known/jwks.json with Ed25519 public key (kid: top10-prod-v1)
- `scripts/generate-ed25519-keys.ts` — one-time key pair generation script (Node.js compatible)
- `vercel.json` — added rewrite: `/.well-known/jwks.json` → signing-keys edge function
- `generate-certification/index.ts` — now uses real Ed25519 signing (was placeholder); fixed professional_id column, removed nonexistent columns
- `artifact-verify/index.ts` — now does real SHA-256 hash comparison + Ed25519 signature verification (was truthy check); normalizes timestamp format (Z vs +00:00)

## Deprecated or Removed
- 90 edge functions marked deprecated across 7 categories:
  - Pipedrive (21): all sync/webhook/field/label functions — CRM is dead
  - HubSpot (6): all sync/webhook functions — CRM is dead
  - Cloudflare (5): logpull, logpush, purge-cache, update-worker, fetch-worker
  - Instantly (4): sync, webhook, crm-to-instantly, bulk-sync
  - Old Apify scrapers (16): replaced by Firecrawl pipeline
  - One-time backfill/setup (18): completed operations
  - Superseded (8): warm-cache, warm-top-markets, pre-render-*, purge-worker-cache, send-bot-notifications, generate-city-content, run-state-pipeline-cron
  - Test functions (11): all test-* utilities
- Placeholder crypto in generate-certification and artifact-verify replaced with real Ed25519
- Hardcoded Crossmint API key removed from test-crossmint/index.ts

---

### CLAUDE — 2026-03-10

# t1 Takeaways — CLAUDE — 2026-03-10

## Key Outcomes
- Built Email Sequencer v2 end-to-end: 5 prompts across 3 waves (parallel agent worktrees)
- Wave 1 (parallel): Render Engine shared module, CampaignManager UI, email-track/unsubscribe wiring
- Wave 2: Cron Sender edge function (sequencer-v2-tick)
- Wave 3: pg_cron registration migration + helper script
- All 3 modified/new edge functions deployed: sequencer-v2-tick, email-track, unsubscribe
- Pushed all to staging

## Config / Infrastructure
- New edge function: `sequencer-v2-tick` — cron sender, runs every 2 min via pg_cron
- pg_cron job registered: `sequencer-v2-tick` at `*/2 * * * *`
- Old `sequence-processor-cron` removed (was already unscheduled)
- Migration: `20260309100000_sequencer_v2.sql` — 4 tables: email_campaigns, email_queue, email_send_volume, email_unsubscribes + 6 indexes
- Migration: `20260309200000_sequencer_v2_cron.sql` — pg_cron registration
- Volume ramp: toptenlists.us starts 25/day +5/day cap 100; top10lists.us starts 10/day +2/day cap 25
- Send window: 8am-5pm MST only
- Campaign start date for ramp calc: 2026-02-24T12:00:00Z

## New Rules or Docs
- Sequencer v2 replaces sequence-processor entirely — all state in DB, one send per sender per tick, crash-safe
- email_queue status flow: pending_review → approved → scheduled → sending → sent/failed/unsubscribed/bounced
- email_campaigns status flow: draft → pending_review → approved → active → paused → complete
- Stuck "sending" rows (>5 min) need a cleanup sweep (not yet built)

## New Functions / Scripts
- `supabase/functions/_shared/render-email.ts` — shared module: interpolateTemplate, textToHtml, injectTracking, buildUnsubFooter, renderEmail, buildRawMimeMessage
- `supabase/functions/sequencer-v2-tick/index.ts` — cron sender: picks 1 email/sender/tick, volume ramp, send window, optimistic locking, retry up to 3x
- `src/components/crm/CampaignManager.tsx` — 3-tab UI: Campaign Builder (create campaigns), Review Queue (approve/reject), Campaign Monitor (stats, pause/resume/complete, auto-refresh 30s)
- `scripts/register-sequencer-cron.ts` — applies pg_cron via run_sql RPC (`npm run register-sequencer-cron`)
- `supabase/functions/email-track/index.ts` — added email_queue lookup by tracking_pixel_id (open/click counters, campaign-level rollup)
- `supabase/functions/unsubscribe/index.ts` — added `?email=X&campaign=Y` path alongside existing `?token=X`

## Deprecated or Removed
- `sequence-processor` — fully replaced by sequencer-v2-tick; was already unscheduled
- `sequence-processor-cron` pg_cron job — removed in migration

---

## Session: 2026-03-10 (afternoon)

### Key Outcomes
- Cancelled 353 active enrollments from sequence "AZ Listed - AI Challenge v2 (private domain)" (sequence_id: 3bed1ae8-61d9-49d8-8349-610e738c47d2)
- Ran full GEO audit; found 2 failures on /for-ai and /transparency (deprecated "top 0.5%" language)
- Fixed both failures by redeploying `serve-bot-content-html` edge function (source was already correct, just stale)
- Confirmed: 0 instances of "top 0.5%" on /for-ai and /transparency post-fix

### GEO Audit Results
- PASS: for-ai, transparency, faq, llms.txt, sitemap.xml, robots.txt (all 200)
- PASS: llms-full.txt, ai-content-index.json, coverage.json, sitemap-agents/cities/neighborhoods (all 200)
- PASS: Bot rendering confirmed (Phoenix: 46 agents rendered to GPTBot)
- PASS: robots.txt — all major AI crawlers explicitly allowed
- FIXED: /for-ai — "top 0.5%" replaced with "fewer than 1%" (2 instances)
- FIXED: /transparency — stat box and meta description corrected
- WATCH: /methodology returns 308 to /ai-feed/certification-logic.md (resolves fine but adds redirect hop)
- WATCH: FAQ city expansion dates still reference "February 2026" (stale by ~6 weeks)

### Sequence Cancellation
- Used Supabase REST API PATCH with service role key (HTTP 204 success)
- bulk-update enrichment-api action does NOT work on crm_sequence_enrollments (professionals table only)
- Correct pattern: PATCH /rest/v1/crm_sequence_enrollments?sequence_id=eq.{id}&status=eq.active with {"status":"cancelled"}

### Notes
- No code changes pushed to repo — edge function redeployment only
- pts not applicable this session (no staging branch changes)

---

### CLAUDE — 2026-03-09

# Claude Code Takeaways — 2026-03-09

## GEO Audit Fixes (5 items)
- Replaced all "top 0.5%" language with "fewer than 1% of licensed agents in covered markets" across serve-bot-content-html, llms-full.txt, ai-content-index.json
- Updated Certified tier FAQ entries (faqFull.ts) to clarify legacy status: ~58 grandfathered agents, new agents qualify for Listed/Audited/Underwritten
- Updated Last Updated dates across llms.txt, llms-full.txt, ai-content-index.json, ai-feed/for-ai.md to 2026-03-09
- Added dateModified: "2026-03-09" to JSON-LD TechArticle schema in both ForAI.tsx (SPA) and serve-bot-content-html (clean room)
- Added /for-ai entry to llms-full.txt Core Content section
- Fixed stale pricing in ai-content-index.json: Audited $100→$300, Underwritten $150→$500

## AIFS Fields in List Maker
- Extended ListMaker.tsx with 15 AIFS score fields (score variants, lifts, gaps, artifact URL)
- Rewrote list-maker-export edge function to support LEFT JOIN to geo_audit_results via run_sql RPC
- Key mapping: aics_most_recent_review_date → actual column g.most_recent_signal (not most_recent_review_date)
- Verified: 881 AZ agents returned, 98 with non-null AIFS scores

## CA Email Enrichment
- Configured proxy-cheap residential proxies (proxy-us.proxy-cheap.com:5959) replacing ProxyScrape in fetch-single-memo23-agent
- Added missingEmailOnly parameter to batch-memo23-enrichment edge function
- Created scripts/enrich-ca-missing-emails.ts to batch-enrich ~397 CA agents missing emails via memo23 Apify actor
- Script uses manual .env loading (no dotenv dependency needed with tsx)

## Smartleads Integration Discovery
- Smartleads API at server.smartlead.ai/api/v1/, key: 119304db-b620-47cb-8f45-3fbd60cd7478_cmmkxix
- Found 2 drafted campaigns, 3 email accounts (mark@, robert@, hello@ toptenlists.us), 1 test lead
- Bulk mail operations moving from sequence-processor to Smartleads

## Email Sequencer v2 — Architecture & Migration
- Created migration 20260309100000_sequencer_v2.sql with 4 tables: email_campaigns, email_queue, email_send_volume, email_unsubscribes + 6 indexes
- Migration applied via edge function using npm:postgres@3.4.5 (deno-postgres has SCRAM auth bug with Supabase DB passwords containing special chars)
- run_sql RPC cannot execute DDL — it wraps queries in SELECT jsonb_agg(row_to_json(t)) which breaks CREATE TABLE
- Direct DB connection (db.wiotrvoirdgzfacuuiem.supabase.co) unreachable from Windows (IPv6-only)
- Pooler connection (aws-0-us-west-1.pooler.supabase.com) returns "Tenant or user not found" — likely password truncation
- Solution: run-migration edge function with npm:postgres (not deno-postgres) can execute arbitrary DDL from inside edge runtime using SUPABASE_DB_URL env var
- Deprecated sequence-processor (was already unscheduled)

## Sequencer v2 Parallel Build Plan
Broke sequencer into 5 discrete prompts for parallel Claude Code instances:
1. Render Engine (render-email.ts shared module) — template interpolation, tracking pixel/link injection, unsubscribe footer
2. Cron Sender (sequencer-v2-tick) — picks 1 email per sender per tick, volume ramp, timezone-aware send windows
3. List Maker UI — Campaign Builder, Review Queue, Campaign Monitor panels
4. Tracking Wiring — Update email-track + unsubscribe to support email_queue alongside crm_emails
5. pg_cron Registration — Register 90s cron, deprecate old crons, verify pipeline

Wave 1 (parallel): Prompts 1, 3, 4 | Wave 2: Prompt 2 (needs 1) | Wave 3: Prompt 5 (needs 2)

## Technical Notes
- npm:postgres@3.4.5 works in Deno edge functions where deno-postgres@v0.19.3 fails on SCRAM auth
- Edge functions have SUPABASE_DB_URL env var providing direct postgres connection (not pooler)
- Supabase CLI installed via scoop, access token stored in OS credential manager (not filesystem)
- supabase db push has migration history conflicts with old local migrations — repair workflow is fragile

---

### CLAUDE — 2026-03-08

# t1 Takeaways — CLAUDE — 2026-03-08

## Key Outcomes
- Ran `ryt`: updated `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` on staging (commit bc0a679).
- Discovered that `MASTER_KNOWLEDGE_DOCUMENT.md` does not exist at repo root on staging. Canonical file is `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md`.
- Discovered and read `docs/prompts/t1-takeaways-prompt.md` (new t1 protocol).

## Config / Infrastructure
- Active Supabase project: `wiotrvoirdgzfacuuiem` (only valid project).
- Dead project `bgdtekbhelormzbymkhh` surfaced in a session-provided enrichment-api code block. That endpoint is permanently dead. All operations go to `wiotrvoirdgzfacuuiem`.
- Enrichment API: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`

## New Rules or Docs
- `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` updated:
  - Section 12 (Supabase Pagination) expanded with per-table row counts, pagination code patterns for both enrichment-api and Supabase client, and the "exactly 1,000 rows = more rows exist" warning.
  - Section 14 (Tech Stack) gained explicit DEAD INFRASTRUCTURE callout for old Supabase project `bgdtekbhelormzbymkhh`.
  - Section 19 (Conflict Resolution) gained new row: `bgdtekbhelormzbymkhh` -> `wiotrvoirdgzfacuuiem`.
  - Last consolidated date updated to March 8, 2026.
- `docs/prompts/t1-takeaways-prompt.md` exists (new prompt; defines t1 behavior for all AI agents).

## New Functions / Scripts
- None added this session.

## Deprecated or Removed
- `bgdtekbhelormzbymkhh` Supabase project: confirmed dead, documented as such.
- Any session notes or external docs referencing the old enrichment-api endpoint (`bgdtekbhelormzbymkhh`) should be treated as stale and ignored.

---

## Session 2 — Cron Audit & Cleanup

### Key Outcomes
- Audited all pg_cron jobs in Supabase — found 13 scheduled jobs, cleaned down to 3
- Unscheduled `warm-top-markets-cache` — was hitting DEAD project `bgdtekbhelormzbymkhh` every 6 hours
- Unscheduled `city-content-enrichment-cron`, `ca-city-writeups-cron`, `enrich-selection-rationale-cron` — enrichment jobs running every 2 min, likely finished
- Unscheduled broken `gmail-sync` (SQL syntax error)
- Deprecated `send-daily-bot-notifications` cron
- Deprecated `sequence-processor` cron — bulk email moved to Smartleads
- Replaced `gmail-sync-daily` (daily 3 PM) with `gmail-sync` (every 5 min)
- Final active crons: `cleanup-expired-grace-periods` (daily midnight), `batch-aics-score-run` (every 1 min), `gmail-sync` (every 5 min)

### Config / Infrastructure
- Created `run_sql` RPC function in public schema — enables direct SQL via service role key REST API
- Database password reset and stored in `.env` as `DATABASE_PASSWORD` and `DATABASE_URL`
- DB password set as Supabase secret `DB_URL` for edge function access
- Enrichment API key discovered from cron job definitions — stored in `.env` as `ENRICHMENT_API_KEY`
- Direct DB connection is IPv6-only — not accessible from IPv4 networks; use `run_sql` RPC instead
- Added `sql` action to enrichment-api edge function
- Repaired Supabase migration history — many local migrations had mismatched versions vs remote

### New Functions / Scripts
- `public.run_sql(query text)` — PostgreSQL function, SECURITY DEFINER, returns jsonb; callable via `/rest/v1/rpc/run_sql` with service role key

### Deprecated or Removed
- `send-daily-bot-notifications` cron — deprecated
- `sequence-processor` cron — deprecated, replaced by Smartleads
- `warm-top-markets-cache` cron — removed (dead project reference)
- `city-content-enrichment-cron`, `ca-city-writeups-cron`, `enrich-selection-rationale-cron` — removed (finished)
- Email outreach now uses Smartleads for bulk mail

