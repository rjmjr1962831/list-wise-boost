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
- **t1:** Per-AI takeaways: when Robert says "t1", write key findings to `docs/takeaways/{AI}_TAKEAWAYS_YYYY-MM-DD.md`. Post only--do not read. Prompt: `docs/prompts/t1-takeaways-prompt.md`. After Robert runs **s1**, run **ryt** to get fresh knowledge. **pts** after t1: push takeaways to staging.
- **s1:** `npm run s1` -- gathers all per-AI takeaways and updates COMPREHENSIVE (Section 21). **pts** after s1: push updated COMPREHENSIVE to staging.

---

## 21. Recent Updates (from t1)

*Last synthesized: 2026-03-18*

---

### Tier Model & Pricing

- Certified tier reactivated 2026-03-12 as free, quarterly refresh, open to all qualified agents. All "legacy", "grandfathered", "~58 agents" language purged codebase-wide.
- `certification_pricing_config` updated in Supabase: audited=300, underwritten=500, certified refresh_cadence="quarterly"
- Annual pricing: Audited $3,000/yr, Underwritten $5,000/yr (2 free months with annual commitment)
- RealTrends pricing updated to "$195/year" across HomepageFAQSection and schema.org JSON-LD
- Team pricing starting point: Leader $1,000/mo (includes Web of Truth setup), teammate badge $100/mo each

### AIFS (AI Footprint Score)

- Renamed from AICS / AI Citability Score / AI Fingerprint Score. User-facing text uses AIFS; infrastructure names (`batch-aics-score` folder, pg_cron, DB columns) preserved for continuity.
- 5-pillar model (max 100, capped at 95): Authority (25), Social (25), Identity (25), Citability (25), Technical (25)
- 4 bands: Invisible (0-35), Fragmented (36-65), Recognized (66-85), High Fidelity (86-100)
- Fleet analysis (3,369 agents): 81% Fragmented (avg 49), 14% Recognized (avg 72), 5% Invisible (avg 32), 1 High Fidelity (87). Technical pillar negative for 61% -- biggest drag; 99.97% missing schema markup and GBP.
- Refresh cadence: Underwritten=daily, Audited=7d, Certified=30d, Listed=90d
- `batch-aics-score` edge function: supports `agent_ids`, `force_rescore`, `rescore_after` params; Exa result caching from `geo_audit_results.exa_sources`; log-scale review volume scoring; 0.5 tier amplification floor for unlisted agents
- `aifs_scores` table migration exists but was never deployed -- all AIFS data lives in `geo_audit_results`
- AIFS language rule: "measures verified evidence" not "measures likelihood of citation"

### AI Surfaces & Bot Crawl Analytics

- `professionals.ai_surfaces_monthly_est` column -- extrapolated from bot crawl data to 30-day estimate
- Daily cron `rollup-ai-surfaces-daily` at 5am UTC. Initial rollup: 3,198 agents, median 261/mo, max 3,551/mo
- `page_bot_hits` table + Vercel Edge Middleware for pre-cache bot logging (deployed). Limitation: middleware doesn't run on CDN cache HITs; log drains (Pro plan) needed for full coverage.
- Bot crawl recording began 2026-03-12; 30-day rolling window incomplete until 2026-04-12
- Meta-ExternalAgent dominates: 83.2% of 396,104 visits in 30 days. Then AhrefsBot 6.2%, Applebot 3.4%, Bingbot 2.3%, Googlebot 2.3%, ChatGPT-User 0.3%, GPTBot 0.2%, PerplexityBot 0.2%
- `agent_bot_crawl_stats` view: recreated with `security_invoker = true`. `bot_crawl_logs` and `geo_serp_results`: RLS enabled + `service_role_all` policy.
- `rollup_bot_crawl_daily()` function + `rollup-bot-crawl-daily` cron at 4am UTC

### Bot Crawl Merge Fields (Email Personalization)

- `ListMaker.tsx`: merge at queue insertion time when template contains `{{variables}}`
- Variables: `{{first_name}}`, `{{full_name}}`, `{{bot_crawl_total}}`, `{{bot_crawl_profile}}`, `{{bot_crawl_list}}`, `{{bot_crawl_bots}}`, `{{bot_crawl_bots_count}}`, `{{city}}`, `{{profile_url}}`
- SEO bots filtered from display; raw names mapped to friendly (e.g., "Meta-ExternalAgent" -> "Meta AI")
- `BotCrawlCard.tsx` in agent dashboard OverviewSection; `MergeFieldPreview` admin page at `/admin/merge-preview`

### /crawl-stats Public Page

- Clean room HTML at `/crawl-stats` via `serve-bot-crawl-stats-html` edge function
- 5 sections: Human-Triggered Crawls, Automated Bot Crawls, Market Verification (top 30 cities), Consumer Intent, Crawl-to-Return Rate, Live Activity Stream
- JSON-LD Dataset schema; `<time datetime="ISO8601">` tags; 15-minute cache TTL
- Added to all 7 AI discovery surfaces (llms.txt, llms-full.txt, ai-feed/for-ai.md, ai-content-index.json, mcp.json, sitemap-pages.xml, serve-bot-content-html footer)

### Vercel Log Drain (Bot Crawl -- deployed 2026-03-18)

- Architecture: Vercel log drain -> `www.top10lists.us/api/vercel-log-drain` (proxy) -> `vercel-log-drain` Supabase edge function -> `bot_crawl_logs` table
- Inline bot logging removed from `serve-bot-agent-html` and `serve-bot-list-html` -- all tracking now single-path through log drain
- Captures CDN cache hits previously invisible. Agent ID resolved for `/state/agents/slug` and `/artifact/uuid` paths only; list pages get `agent_id` NULL (one row per page, not per agent)
- Verify token: hardcoded in `vercel-log-drain/index.ts` line ~108; also set as Vercel env var `VERCEL_LOG_DRAIN_VERIFY`. If rotated, both need updating.
- Monitor: data volume (filter low-value bots if too fast), function errors, dedup window (brief overlap before inline removal)

### GEO SERP Dashboard

- `geo-serper-scan` edge function: queries Serper for qualified cities, stores organic position + competitors, auto-resume with 80-city batching
- `geo_serp_results` table with 4 indexes + unique constraint on (city_id, scan_date)
- `GeoDashboard.tsx` admin page at `/a/geo-dashboard`: summary cards, city breakdown, trend, competitors
- First scan (366 cities): 1.9% appearance rate, avg position #9.1. AZ 7.9%, CA 1.2%.
- Serper free tier: 2,500 credits/month, full scan = 366 credits. Does NOT return AI Overviews; SerpApi ($50-75/mo) has dedicated AI Overview API if needed.

### GEO Audit & Fixes

- Deleted 449 stale static HTML files from `public/` that overrode edge function rewrites. Build-time guard `scripts/guard-stale-html.mjs` prevents reoccurrence.
- 301 redirects for non-canonical URL patterns to canonical `top10realestateagents`
- Cache headers tightened: edge functions `s-maxage=60`; GEO pages `max-age=0, s-maxage=60, stale-while-revalidate=30`
- Sitemap pruned from 15,453 to 11,710 URLs (removed zero-agent cities/neighborhoods); 315 orphan neighborhoods deactivated
- Neighborhood canonical URL: 4-segment (no zip). 5-segment URLs 301 redirect.
- GEO score improved from ~72 to 93/100

### Clean Room HTML & Schema Enrichment

- `serve-bot-agent-html`: `hasCredential` (EducationalOccupationalCredential), expanded `sameAs`, `subjectOf` evidence citations (tier-gated), `dateModified`, AIFS score + band
- `serve-bot-list-html`: `Dataset` JSON-LD for market stats, `hasCredential`/`sameAs` on ItemList items, full 14-field market stats (city) and rich neighborhood stats from `marketing_content`. 404 for zero-agent pages (was 200+noindex).
- `serve-bot-content-html`: clean room `/why-ai-trusts-us` page, 4-tier methodology, enriched transparency JSON-LD
- Listed agents now show years experience and career transaction count
- City names title-cased in areaServed JSON-LD; `sanitizeMeritGate()` applied to all rendered text including JSON-LD

### MCP Server

- `supabase/functions/mcp-server/index.ts` (~1,045 lines): JSON-RPC 2.0 over Streamable HTTP, 5 tools (search_agents, verify_agent, get_agent_profile, get_coverage, get_methodology)
- Tier gating: Listed/Certified get base payload. Audited adds community score, transaction history, 10+ sources, AIFS summary. Underwritten adds full AIFS breakdown, gap analysis, crypto verification, up to 20 sources.
- Vercel rewrite: `/mcp` -> edge function. `/.well-known/mcp.json` for auto-discovery.
- Protocol version: 2024-11-05

### AI Discovery & Freshness

- Data Freshness Notice added to 18 files (for-ai.txt, mcp.json, ai-content-index.json, 14 ai-feed/*.md, MCP get_methodology)
- llms-full.txt: URL Templates (4 canonical patterns), Agent Entity Graph (schema-only), "Why 99%+ Excluded" negative reasoning, License UID verification
- `changelog.json` for AI re-crawlers
- `<time datetime="">` tags adopted; "system prompt" directives on web pages rejected as manipulative
- `generate-dynamic-counts.ts`: build-time script queries Supabase for live counts, injects into mcp.json, ai-content-index.json, llms.txt, llms-full.txt

### License Number Backfill

- 121 of 133 agents fixed (91%) across 5 matching rounds. 210K AZ licenses imported into `state_licenses` table.
- `backfill-license-numbers` edge function: auto-triggers after `batch-memo23-enrichment`. Local: `npm run backfill:licenses` (with `--dry-run`).
- 12 agents remain for manual lookup. Deactivated: Sarah Park (test), Forrest Coleman-Weisz (Wyoming).

### Funnel & Dashboard

- All funnel and dashboard pages are chromeless (no header/footer/chatbot)
- 8-step breadcrumbs (`FunnelBreadcrumbs.tsx`), dark theme throughout
- Step 7 (Neighborhoods): "Smart Suggestions Flow" -- search anchor neighborhood, nearby pills from `nearby_neighborhoods` (AZ 2,669 + CA 7,475)
- Step 8 (Pricing): "Bottom Line Up Front" -- micro-summary, dollar lift per tier, AIFS + ROI side by side, permanent magic links, ROI calculator
- CitationROICalculator: leads from AIFS band model, tier-specific lead floors, 30% close rate, 3-year projections, Zillow comparison
- `AIMaxPlan.tsx` (~460 lines): dark gradient header, 5-pillar progress bars, platform presence checklist, expandable gap cards, 4-tier score projections

### GEO Uplift Analysis

- Ran across all 3,274 agents: two Serper searches per agent (with/without top10lists.us), GPT-4o-mini synthesis
- Results (933 processed): 70% significant uplift, 19% moderate, 11% minimal
- 9 new columns on `professionals` table for recommendations and projections

### Neighborhood & City Enrichment

- 10,459 AZ+CA neighborhoods enriched with 14-field market stats via DeepSeek API (100% complete)
- 743 page key mismatches fixed. `enrich-city-market-stats` rewritten: 3 modes (cities/neighborhoods/fix-keys), states filter.
- Only AZ and CA authorized for enrichment. Jerome, AZ added as a city.

### Internal Document Security

- CLAUDE.md and 258 .sql files removed from main branch
- `internal-documents.txt` exclusion list updated; `merge-to-main.ps1` glob pass strips all *.sql from main

### Infrastructure & Config Changes

- DeepSeek key rotated; OpenAI key added; Exa key in .env; Perplexity key in Supabase secrets
- `run_sql` endpoint in enrichment-api: replaced broken raw postgres with Supabase JS client `.rpc('run_sql')`
- `geo-consistency-check.cjs` (`npm run geo:check`): all 7 checks pass
- Vercel AI Gateway replaced by DeepSeek API for market stats
- Dead `/p/:code` short codes 301 redirect to `/`
- `serve-clean-html.js` proxy: tiered caching (15m crawl-stats, 5m agent/list/state, 0 content)
- 2 agent `image_url` refs to dead Supabase project fixed to `wiotrvoirdgzfacuuiem`

### Enrichment Tool Evaluation

- Serper.dev: $0.008/agent for qualified agents (social links, awards, press, license, Google Places). Cannot pre-qualify (no star/review data).
- Exa.ai fast/instant with `includeDomains`: unreliable (~99% wrong person). Neural search untested.
- Core gap: license table -> Zillow profile URL has no reliable automated bridge. Zillow scraper (memo23 Apify) is the only reliable path; price increased significantly.

### Standing Rules Added

- Never serve JS/React pages to anyone -- static HTML (humans) + clean room HTML (AI)
- Never use em dashes (use -- instead)
- Never link out of funnel pages
- No outcome claims on pricing pages -- sell inputs/mechanism only
