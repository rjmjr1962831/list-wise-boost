# Top10Lists.us — Comprehensive Knowledge Document

**Purpose:** Single consolidated reference for agent2, Claude, and Cursor. Use latest updates as source of truth.  
**Last consolidated:** 2026-03-22
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

*Last synthesized: 2026-03-22*

---

### Email Infrastructure & Campaigns

**Campaign Status**
- "Listed 7d crawl" launched 2026-03-21: 2,986 agents queued, 251 sent, 90 opens (60% open rate), 5 clicks (3.6% CTR), 9 bounces (3.6%). Campaign paused at 251 sent, 2,690 remaining in queue.
- 30 team rows + 1 pending_email_verification row pulled from queue (set to `skipped`). Root cause: `CampaignManager.tsx` was missing `exclude_teams: true` in initial criteria state -- fixed.
- Open rate inflated by Apple Mail Privacy Protection. CTR is 2x cold email benchmark. Bounce rate (3.6%) above ideal (<2%).

**Sequencer Bugs Fixed (all deployed)**
- **UTC/MST date mismatch**: `todayStr` used UTC, causing daily counter to reset at 5pm MST (midnight UTC), effectively doubling the daily limit. Fixed with `getMSTDateStr()` helper.
- **No global daily cap**: Each sender account had independent limits with no cross-account ceiling. Added global cap summing all accounts' volume for the MST day.
- **Paused campaigns ignored**: Sequencer sent any `approved` queue row regardless of parent campaign status. Fixed -- sequencer now checks `email_campaigns.status` and enforces campaign-level `max_per_day`.
- **Base64 body parts**: Now RFC 2045 compliant (76-char line wrapping) -- Proton Mail was silently rejecting.
- **HTML document wrapper**: `<!DOCTYPE html><html><body>` required -- Gmail was rendering raw tags.
- **Click tracking**: Now covers all links including our own domain (funnel links were untracked). Only the tracker URL itself is excluded.
- **Campaign counters**: `run_sql` is SELECT-only, was silently failing -- replaced with `.update()`.
- **Bounce detection**: Sequencer sweeps Gmail inboxes for mailer-daemon messages, marks queue rows as failed, creates CRM tasks. Bounce is post-delivery -- Gmail accepts (200), bounce arrives later.
- **HTML detection in gmail-send**: Skips `textToHtml()` when input is already HTML.
- **Mark Garland display name** added in From header for `mark@` accounts.

**Sender Config**
- 4 active sender accounts for campaigns (mark excluded). All 5 available for task emails.
- Send limits: 40/day start, +10% compound ramp. Campaign start date: 2026-03-21.
- Send window: 5am-8pm MST, Mon-Sat. 3-minute minimum cooldown between sends per account.
- Global daily cap = per-account limit × number of accounts.

**Email Bounce Handling**
- 9 post-delivery bounces flagged (Arsen Sarapinian, Brad Rawlins, Brenda Hayes, Brenda Reynolds, Brian Laughlin, Dianne Barrett, Farideh Farinpour, Frank Crandall, Freddy Cabral). All set to `lead_status = 'email_bounced'`. CRM tasks created to find correct emails.
- 45 new emails found via Serper. 22 corrected emails for wrong-person assignments. 161 agents flagged `pending_email_verification`. 34 teams identified, 31 team leaders written to `headline` field.

**Campaign Wizard (7-step flow)**
1. Create or Select Campaign
2. Build List -- full filter criteria + output field selectors (Agent Fields, AIFS Score Fields, AI Surfaces). Selected fields become merge variables.
3. Create Email -- TipTap WYSIWYG rich text editor with merge variables click-to-copy.
4. Send Gates -- max emails/day, daily uptick, min seconds between sends. Capacity calculator.
5. Review -- email preview with sample data.
6. Test -- send to Robert's addresses.
7. Launch -- draft, immediate, or scheduled.
- Variable interpolation at queue time -- launch fetches all agent data via `list-maker-export`, interpolates every `{{variable}}` per agent before queuing.

**Post-deploy hook**: Auto-sends test email to `robert@aryah.ai` after email function deploys.

---

### AI Surfaces & Bot Analytics

**AI Surfaces Rollup -- 10x Inflation Fixed**
- **Root cause**: Rollup joined neighborhood page crawls on `served_cities`, attributing every neighborhood crawl to ALL agents in the city (e.g., all 386 LA agents got credit for every Hollywood crawl).
- **Fix**: New `served_neighborhoods` JSONB column (+ GIN index) on `professionals`. `assign-neighborhoods.ts` script populates via 3-tier matching:
  - Tier 1 (service_areas text matching): 2,432 agents (74%)
  - Tier 2 (zip code proximity): 569 agents (17%)
  - Tier 3 (city-only fallback): 273 agents (8%)
  - Average 16.9 neighborhoods per agent.
- **Rollup function replaced**: `rollup_ai_surfaces_monthly()` now uses 3-way UNION: city crawls → `served_cities`, neighborhood crawls → `served_neighborhoods`, profile crawls → `canonical_slug`.
- **Result**: 98M → 14.8M total surfaces (correct 7-day window). Allen Alon Tubi: 172K → 19.3K.
- **Cron**: Old `rollup-agent-ai-surfaces` unscheduled. New `rollup-ai-surfaces` runs daily at 04:00 UTC.
- **Open item**: One agent has 349 neighborhoods (likely county-level match) -- consider capping at ~30.

**AI Surfaces Definition (canonical)**
- Every crawl of a page where an agent is listed counts as one surface for that agent.
- City page crawls → all agents in `served_cities`. Neighborhood page crawls → only agents in `served_neighborhoods`. Profile crawls → canonical_slug agent only.
- `served_neighborhoods` is the canonical agent-to-neighborhood mapping. Must be re-run after enrichment adds agents or service_areas change.

**Bot Analytics Dashboard**
- Agent Coverage tab: "Human" (ChatGPT-User, OAI-SearchBot, PerplexityBot) and "Bot" (all other automated crawlers) columns. Data from pre-computed `agent_ai_surfaces` / `agent_ai_surfaces_by_bot` tables.
- Title: "Agent AI Surfaces (7-day)".

**Vercel Log Drain**
- Root cause of prior 98% data loss: regex didn't match `path: "/api/serve-clean-html?fn=...&path=..."` format. Fixed with path extraction from query string.
- Drain stopped delivering ~2am UTC 2026-03-22 (153 rows vs normal ~144K/day) -- confirmed buffering/retrying. Real data resumed; backfill rows deleted to avoid double-counting.
- Open item: Monitor drain catch-up for Mar 22-24. Re-backfill gaps if Vercel doesn't retry.

**Bot Page Agent Selection -- Known Issue**
- `serve-bot-list-html` shows ALL city agents on every neighborhood page (queries by `city_id` only, never filters by neighborhood). `agent_neighborhood_subscriptions` table exists but isn't used. Fix pending.

**Crawl Log Backfill**: 532,789 rows backfilled across Mar 17-21 to normalize to ~144K/day average.

---

### Stripe & Payments

- **stripe-webhook**: Fixed tier detection -- reads `badgeTier` from subscription metadata instead of broken amount thresholds. SDK upgraded v14.21.0 → v18.5.0, API version `2025-08-27.basil`.
- **complete-agent-subscription**: Sets `badge_tier` and `badge_status` from checkout session metadata on payment success.
- **AgentDashboard**: "Upgrade Package" button navigates to `/funnel/:token/pricing` instead of dead `/visibility/coverage`. Added `?section=` deep-link support for tabs.
- **Route fix**: `/funnel/:token/payment-success` → `AgentPaymentSuccess` (dark-themed page).
- **Payment Success Page**: Shows tier badge, AIFS score, band label. Web of Truth CTA with pulsing tier orb. "What just changed" section. Inline question form submits to `field_change_requests` as CRM task.
- **Certified tier added to `TIER_META`** (was missing -- Certified agents saw "Audited tier is active").
- Stripe secrets confirmed: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET set in Supabase.

---

### Funnel & Dashboard

**Funnel Updates**
- Magic link fixed: `/dashboard/{token}` → `/funnel/{token}` in `list-maker-export` and sample data.
- Step1: Shows 7-day AI surfaces (from `agent_ai_surfaces`) instead of monthly estimate. CTA: "See What AI Knows About You".
- Step3: Title placeholder "DDS, DMD" → "REALTOR, Broker, CRS". Back button goes to Step2b.
- Step4ReviewFinal: All fields show always (not conditionally hidden).
- Step5: "Please select at least one city area."
- Step6: "Choose the neighborhoods where you've closed the most deals."
- Step7Pricing: AIFS default 42 → 24 (true baseline without tier uplift).
- StepSuccess: `markets_covered` pulls from agent's `served_cities` instead of hardcoded `['Phoenix']`.
- California support: 11 regional city bundles, neighborhood nearby resolution handles both AZ JSON and CA semicolon formats.
- Funnel instrumentation: all 8 steps tracked via `crm_contact_activity` + `crm_tasks` for high-signal events.
- Email alerts: click and tier selection alerts sent to `rjmjr1@proton.me`.

**TierPricingCalculator** -- new shared component for funnel pricing + dashboard upgrade.
- Cards: Orb → Tier name → Net revenue hero → AIFS score with inline band descriptions → Features → Expandable math → Price → CTA.
- Band descriptions inline: Invisible, Discoverable, Citable, Citable (local), Authoritative.
- Close rate default: 10% (adjustable). CTA text: "Choose Audited -- $300/mo".

**Funnel Conversion Audit -- Pending Implementation**
1. Collapse Steps 2+2b+3+4 into single accordion page -- est. 20-30% drop-off reduction.
2. Show AIFS uplift + revenue projection on Step 1.
3. Add "email me this link" + auto-save + DB persistence -- close tab = lose everything is #1 structural risk.
4. Add testimonial + competitor comparison + product preview before pricing.
5. StepSuccess needs Web of Truth badge setup as primary CTA, not "Go to Homepage."

---

### GEO & Content Consistency

- **Agent counts standardized**: 3,262 total (872 AZ + 2,390 CA) across mcp.json, ai-content-index.json, llms.txt, llms-full.txt, FAQ, React pages, edge functions, admin demos.
- **Certified tier**: Active. "Invitation-only" language replaced with merit-based selection across 14 files. Refresh corrected to "quarterly" everywhere. SSoT Section 3 updated to 4-tier model.
- **Selection rationale**: 12 DB records updated -- "top 0.5%" → "fewer than 1% of licensed agents in covered markets."
- **Source count language removed** (27 files, ~70 replacements): Listed/Certified = "Core credential verification", Audited = "Expanded background research", Underwritten = "Exhaustive background research".
- **Coverage counts must match sitemaps**: coverage-stats, FAQ, /for-ai all use same filtered query (Sitemap Rule A).
- **GEO audit remediations**: C1 coverage-stats counts only qualifying agents; H1 FAQ dynamic language; H2 `/why-ai-trusts-us` → 301 `/for-ai`; H3 `/login` → 301 `/agent-login`; H4 homepage OG image tag; H5 `get_founder_profiles` in mcp.json; M1 all 10 ai-feed dates bumped to 2026-03-21.
- **GEO enhancements**: ItemList JSON-LD with `url`, `areaServed`, `itemListOrder`. Lead summary paragraph (`data-ai-summary="true"`). Dynamic `dateModified` from agent `updated_at`.
- **`serve-stats-json`** edge function at `/stats.json` (1-hour cache): 3,262 agents, 1,738 cities, 10,144 neighborhoods.
- **Founder → Cofounder**: All public-facing references updated (9 files). Schema.org arrays include both Robert Maynard and Mark Garland. URL paths (`/about/founder`) kept unchanged.
- **"community involvement" → "community"** across ~90 files.

---

### Clean-Room & Site Infrastructure

- **Clean-room migration**: All public pages migrated from React SPA to Supabase edge functions. React SPA now only for authenticated routes.
- **Shared `_shared/site-chrome.ts`**: `breadcrumbJsonLd()` and `ogTags()` helpers integrated into all 9 serve-bot edge functions.
- **MCP endpoint**: `api/mcp.js` Vercel proxy adds Supabase auth headers. AI systems call POST `/mcp` without auth.
- **Sitemap automation**: Runs on every build via prebuild. Pages/states/cities/neighborhoods: `changefreq=daily`. Agent pages: Underwritten=daily, Audited=monthly, Certified=monthly, Listed=yearly.
- **Vercel rewrites**: `/stats.json` → serve-stats-json; `/for-ai-systems` → `/for-ai`; `/methodology` → `/about/ranking-methodology`; `/crm` → /404 on production.
- **`Link` header**: `</.well-known/mcp.json>; rel="mcp-server"` on all responses.
- **prebuild**: Runs `generate:counts` + `generate:sitemaps` on every build.
- **pg_cron jobs**: `sequencer-v2-tick` every 2 minutes. `rollup-ai-surfaces` daily 04:00 UTC. `purge-bot-crawl-logs` daily 03:00 UTC (30-day retention).
- **RLS policies**: `email_campaigns` (5 policies), `email_queue` (5 policies).
- **Mark's phone**: (480) 204-6636.
- **CLAUDE.md** created at repo root for Claude Web access.

**Pages Removed**
- `/compare` (AICompare.tsx) and `/why-ai-trusts-us` (WhyAITrustsUs.tsx) deleted. References cleaned from 24+ files.
- `/for-ai-systems` → `/for-ai` (301). `/methodology` → `/about/ranking-methodology` (301).

**Founder Profile System**
- `get_founder_profiles` MCP tool: queries `marketing_content` live, falls back to hardcoded defaults.
- `serve-bot-founder-html`: fetches live profiles, enriches JSON-LD Person schemas, renders claims with verification links.
- Verifiable claims: `{ text, sourceUrl }` objects with verification URLs (SEC EDGAR, FTC, Delaware corp search, etc.).
- Admin intake form at `/admin/founder-intake.html` (staging only).

**Pipeline Demos** (staging only): `/admin/demo/` hub with pipeline, enrichment, founder intake diagrams. Note: enrichment diagram incorrectly references DataForSEO Maps API -- Top10Lists uses Serper.dev.

---

### Scoring & Methodology

- **AIFS Pillar weights**: Identity 25, Citability 25, Social Proof 20, Authority 15, Technical 15.
- **Internal scoring weights**: License Status 20%, Recent Activity 20%, Transaction History 20%, Reviews/Reputation 15%, Community 25%.
- **Consumer-facing weights**: Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education 10%.
- **AIFS default**: 24 (baseline without tier uplift). Not 42.
- **Close rate default**: 10% (not 30%). Agent can adjust. Revenue projections must be defensible.

---

### Standing Rules

- **TEST BEFORE DONE**: Never say "done" without verifying end-to-end with real data. Show receipts.
- **DO NOT PUSH without Robert's express permission** -- all dev on localhost.
- **run_sql is SELECT-only**: Use `.update()`/`.insert()` for writes.
- **HTML emails must be wrapped**: `<!DOCTYPE html><html><body>` on every body.
- **Base64 must be line-wrapped**: 76 chars per line per RFC 2045.
- **Sequencer send window is MST-aligned everywhere**: Both `isInSendWindow()` and volume tracking `todayStr` must use MST dates.
- **Campaign pause enforced by sequencer**: Must check `email_campaigns.status` before sending. `status=approved` on queue row is not sufficient.
- **All links tracked**: Including our own domain. Only the tracker URL itself excluded.
- **Bounce detection is post-delivery**: Sequencer sweeps inboxes for mailer-daemon messages.
- **No source counts**: Never reference specific source counts. Use tier-appropriate depth language.
- **Certified tier is ACTIVE**: 4 tiers: Listed / Certified / Audited / Underwritten.
- **Agent selection model**: Merit-based by Top10Lists. Not "invitation-only," not "open signup."
- **Coverage counts must match sitemaps** (Sitemap Rule A).
- **AI surfaces are neighborhood-specific**: Neighborhood crawls → `served_neighborhoods` only.
- **`served_neighborhoods` is canonical** agent-to-neighborhood mapping. Re-run `assign-neighborhoods.ts` after enrichment.
- **Numbers must foot**: Any number on crawl-stats, dashboards, or emails must use same methodology and 7-day window.
- **`@tailwindcss/typography` plugin** installed but NOT in tailwind.config.ts plugins. `prose` class does nothing -- use explicit child selectors like `[&_p]:mb-3`.
- **Human vs Bot**: ChatGPT-User, OAI-SearchBot, PerplexityBot = human-initiated. Everything else = automated bot.
- **Correct enrichment costs (canonical)**: Serper $0.003/search, Memo23 $0.03/agent, Exa $0.003/search, DeepSeek $0.0002/agent. Google Places/Maps NOT used. Prequalification pass rate ~2%.

---

### Deprecated or Removed

- Old `rollup-agent-ai-surfaces` cron (inline SQL, city-only join) -- replaced with `rollup-ai-surfaces` using corrected function.
- Old surface numbers (98-119M) -- inflated 10x. Correct range ~14-15M for 7-day window.
- Old PaymentSuccess page (light theme) -- replaced by `AgentPaymentSuccess`.
- Original badge PNGs with black backgrounds -- replaced with transparent HAL 9000 orbs.
- "1,000+ sources" / source count language everywhere.
- "Founder" title -- now "Cofounder".
- 30% close rate assumption.
- Hardcoded coverage counts in FAQ.
- Complete button from campaign monitor.
- Old daily limit formula (per-domain tiers) -- replaced with universal `40 × 1.10^days`.
- OUR_DOMAIN link exclusion in tracking.
- Legacy AIFS Fields section from List Maker UI.
- `/compare` (AICompare.tsx) and `/why-ai-trusts-us` (WhyAITrustsUs.tsx) -- deleted.
- "pre-rendered HTML" language in robots.txt -- replaced with "clean-room HTML".
- Old slug resolution loop in vercel-log-drain (N DB queries per batch) -- replaced with single batch query.
- All draft/active campaigns and 15,105 queued emails deleted (clean slate before relaunch).
