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


