# Top10Lists.us — Comprehensive Knowledge Document

**Purpose:** Single consolidated reference for agent2, Claude, and Cursor. Use latest updates as source of truth.  
**Last consolidated:** 2026-03-24
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

## 6. AI Content Serving (Clean Room HTML) — NO CACHING

**Rule:** All bot-facing pages serve **clean room HTML** -- minimal, self-contained, no React SPA, no browser rendering. This includes city, neighborhood, agent, transparency, FAQ, for-ai, methodology, homepage, state hub, and founder pages.

- **Implementation:** Vercel rewrites go **directly to Supabase Edge Functions**. No proxy, no cache, no middleware. Pattern: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/{function}?path={path}`.
- **NO CACHING of any kind:** No Vercel CDN cache, no `rendered_pages` DB cache, no KV cache, no Cloudflare. Edge functions respond in <1s. Caching has caused multiple logging incidents and is permanently prohibited on bot-facing pages.
- **The Vercel proxy (`api/serve-clean-html.js`) is permanently deleted.** Do not recreate it under any name. Do not add any middleware between Vercel rewrites and Supabase edge functions.
- **Bot crawl logging:** Each serve-bot function calls `logBotVisit()` from `_shared/log-bot-visit.ts`. 28 bot patterns, fire-and-forget. If a new serve-bot function is created, it MUST call `logBotVisit()`.
- **Cloudflare:** Deprecated. Do not use.

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

*Last synthesized: 2026-03-24*

### CRITICAL ARCHITECTURE CHANGE: No Caching, No Proxy (2026-03-24)

**The Vercel proxy (`api/serve-clean-html.js`) has been permanently deleted.** All bot-facing Vercel rewrites now go directly to Supabase edge functions. There is NO caching layer of any kind:
- No Vercel CDN cache (s-maxage removed)
- No `rendered_pages` DB cache (proxy that used it is deleted)
- No Cloudflare, no KV, no Prerender.io

**Bot crawl logging** now happens inside each serve-bot edge function via `logBotVisit()` (was imported but never called — activated 2026-03-24). 28 bot patterns, fire-and-forget. The Vercel log drain remains as supplemental.

**Architecture:**
```
Bot → Vercel CDN (pass-through) → Supabase edge function → logBotVisit() → Response
```

### Nightly License Verification (2026-03-24)

- `verify-licenses-nightly` edge function: batch-verifies all 3,256 agents against AZDRE/CalDRE. Resumable (skips agents verified within 24h). 10 concurrent lookups per batch.
- Agents with unverifiable licenses: auto de-listed (`active=false`), `license_review` task created.
- Status changes (Active→Suspended/Revoked): agent de-listed, profile retained with "Verified Inactive" schema signal.
- Agent profiles show "Confirmed [date]" next to license number.
- JSON-LD `hasCredential` now includes `credentialStatus` and `dateVerified`.
- `dateModified` on agent profiles uses max(updated_at, license_verified_at).
- pg_cron: `*/30 8-11 * * *` (every 30 min, 1-4am MST). Needs manual creation in SQL editor.

### Phone Sales Flow (2026-03-24)

- `create-stripe-invoice` edge function: Stripe Invoice API, sends payment link by email.
- `SandboxStep5Tier`: `?mode=sales` shows "Send Invoice" instead of Stripe Checkout.
- "Phone Sale" button on TasksManager sales tasks and ContactDetail.
- Routes: Listed→`/funnel/{token}/contact?mode=sales`, Certified+→`/dashboard/{token}?mode=sales`.

### CRM Improvements (2026-03-24)

- **Tasks: Sales vs Ops tabs** — Sales (clicks, funnel activity), Ops (opens, bounces, follow-ups, field changes).
- **Click auto-closes open task** — no duplicate tasks across Ops/Sales tabs.
- **Auto-resolve bounces** via ZeroBounce + Exa suggestions.
- **Inline field editor** on ContactDetail with audit log (`crm_field_change_log` table).
- **Merge variables standardized**: First Name, Full Name, Tier, City, Dashboard, AIFS Score, Crawl Stats 7d across all compose surfaces.
- **Campaign wizard** now loads templates from `crm_email_templates`.

### GEO Enhancements (2026-03-24)

- **Dataset JSON-LD on all neighborhood pages** — Professional Performance Audit schema with spatialCoverage, CC BY 4.0, three variableMeasured.
- **Homepage "Browse by State"** section — 18 links to AZ/CA hubs + top cities.
- **Nofollow on all external links** — city, neighborhood, agent pages.
- **CC BY 4.0** on all Dataset schemas (was /terms).
- **Methodology page**: Nightly License Integrity Audit section + Dataset JSON-LD.
- **llms-full.txt**: Nightly license verification section added.

### Sequencer & Email Fixes (2026-03-24)

- Campaign daily cap timezone bug fixed (hardcoded -07:00 offset).
- `gmail-send` now tracks volume in `email_send_volume`.
- Email line breaks: inline `<p>` margins + `\n→<br>` in HTML mode.
- Deprecated `sequence-processor` returns 410 Gone.
- Funnel routing: Certified agents go to `/dashboard/`, not `/funnel/`.
- Upgrade button: `/pricing` (dead) → `/tier` (correct).

### Enrichment Pipeline (2026-03-24)

- **LinkedIn enrichment via Serper**: `enrich-linkedin-batch` edge function + `--linkedin` flag in orchestrator. 39 profiles found. ~30% hit rate on high-review agents.
- **ZeroBounce integration**: email verification for bounce recovery. API key in Supabase secrets.

### Rollup Fix (pending manual SQL)

- `rollup_ai_surfaces_monthly` needs update: `> now() - interval '7 days'` → `>= CURRENT_DATE - 7 AND < CURRENT_DATE` to exclude partial current day. SQL provided to Robert.

---

### Email Infrastructure & Campaigns

**Campaign Status**
- "Listed 7d crawl" launched 2026-03-21: 2,986 agents queued, 251 sent initially, 90 opens (60% open rate), 5 clicks (3.6% CTR), 9 bounces (3.6%). Campaign paused then resumed -- 2,690 remaining across 4 sender accounts (~670 each).
- Daily ramp: 40 base × 1.10^days. Day 3 = ~48/box, ~192/day total. Queue drains ~Mar 31 -- Apr 1.
- Open rate inflated by Apple Mail Privacy Protection. CTR is 2x cold email benchmark. Bounce rate (3.6%) above ideal (<2%).
- 30 team rows + 1 pending_email_verification row pulled from queue (set to `skipped`). Root cause: `CampaignManager.tsx` missing `exclude_teams: true` -- fixed.

**Sequencer Bugs Fixed (all deployed)**
- **UTC/MST date mismatch**: `todayStr` used UTC, causing daily counter to reset at 5pm MST. Fixed with `getMSTDateStr()` helper.
- **No global daily cap**: Each sender had independent limits. Added global cap summing all accounts' volume for the MST day.
- **Paused campaigns ignored**: Sequencer now checks `email_campaigns.status` and enforces campaign-level `max_per_day`.
- **Base64 body parts**: RFC 2045 compliant (76-char line wrapping) -- Proton Mail was silently rejecting.
- **HTML document wrapper**: `<!DOCTYPE html><html><body>` required -- Gmail was rendering raw tags.
- **Click tracking**: Covers all links including our own domain. Only the tracker URL itself excluded.
- **Campaign counters**: `run_sql` is SELECT-only, was silently failing -- replaced with `.update()`.
- **Bounce detection**: Sequencer sweeps Gmail inboxes for mailer-daemon messages, marks queue rows as failed, creates CRM tasks. Bounce is post-delivery.
- **HTML detection in gmail-send**: Skips `textToHtml()` when input is already HTML.
- **Mark Garland display name** added in From header for `mark@` accounts.

**Sender Config**
- 4 active sender accounts for campaigns (mark excluded). All 5 available for task emails.
- Send limits: 40/day start, +10% compound ramp. Campaign start date: 2026-03-21.
- Send window: 5am-8pm MST, Mon-Sat. 3-minute minimum cooldown between sends per account.
- Global daily cap = per-account limit × number of accounts.

**Email Bounce Handling**
- 9 post-delivery bounces flagged (Arsen Sarapinian, Brad Rawlins, Brenda Hayes, Brenda Reynolds, Brian Laughlin, Dianne Barrett, Farideh Farinpour, Frank Crandall, Freddy Cabral). All set to `lead_status = 'email_bounced'`. CRM tasks created.
- 45 new emails found via Serper. 22 corrected emails for wrong-person assignments. 161 agents flagged `pending_email_verification`. 34 teams identified, 31 team leaders written to `headline` field.

**Campaign Wizard (7-step flow)**
1. Create or Select Campaign
2. Build List -- full filter criteria + output field selectors. Selected fields become merge variables.
3. Create Email -- TipTap WYSIWYG rich text editor with merge variables click-to-copy.
4. Send Gates -- max emails/day, daily uptick, min seconds between sends. Capacity calculator.
5. Review -- email preview with sample data.
6. Test -- send to Robert's addresses.
7. Launch -- draft, immediate, or scheduled.
- Variable interpolation at queue time -- launch fetches all agent data via `list-maker-export`, interpolates every `{{variable}}` per agent before queuing.

**Post-deploy hook**: Auto-sends test email to `robert@aryah.ai` after email function deploys.

---

### Funnel & Dashboard

**New 5-Step Funnel (deployed to production 2026-03-23)**

Replaced old 8-step flow (`/review-1`, `/review-credentials`, `/review-2`, `/review-final`, `/pricing`) with:
1. **Your Listing** -- AI surface stats, value prop nugget, "Certify Your Listing" CTA
2. **Contact** -- Email, 3 phone fields (mobile/business/other), website -- each with publish toggle sliders and per-field auto-save on blur. US phone formatting on blur.
3. **Cities** -- Hierarchical city selector (region → sub-region → individual city checkboxes). AZ uses flat bundles; CA uses full 3-level hierarchy.
4. **Neighborhoods** -- Search filtered to only cities selected in step 3. Nearby suggestions also filtered.
5. **Tier/Pricing** -- 3 tier cards with revenue calculator. Monthly/annual toggle inside each paid card.

**Key Funnel Decisions**
- No profile photo -- AI doesn't use photos
- No "What AI sees" detail columns on tier page
- No "Stay with your free listing" exit link
- No AIFS score context bar on tier page
- Nugget always above title on every step (consistent pattern)
- "Congratulations" headline removed from step 1
- CTAs: "Stay with Free" / "Choose Audited" / "Choose Underwritten" (prices removed from button text)
- Dev mode: success page auto-reverts agent to Listed, clears all changes, "Test Again" button. Snapshot on step 1 entry, restore on completion.

**Routing**
- `/funnel/:token/*` and `/sandbox/:token/*` serve same components via `useBasePath()` hook
- `sandbox` added to Vercel SPA rewrite pattern (was 404-ing on refresh)

**TierPricingCalculator Updates**
- Default deal size: $500k → $750k
- Default close rate: 10% → 20%
- Heading: "Calculate your first year revenue uplift"
- Hero label: "1st Year Rev Uplift" with "(Ttl Rev Uplift - Top10 investment)" and "Estimated" underneath
- Monthly/annual toggle moved into each paid card above the price

**Funnel Instrumentation**: All steps tracked via `crm_contact_activity` + `crm_tasks` for high-signal events. Email alerts for click and tier selection to `rjmjr1@proton.me`.

**Funnel Conversion Audit -- Pending Implementation**
1. Add "email me this link" + auto-save + DB persistence -- close tab = lose everything is #1 structural risk.
2. Add testimonial + competitor comparison + product preview before pricing.
3. StepSuccess needs Web of Truth badge setup as primary CTA, not "Go to Homepage."

---

### California City Bundles

**Rebuilt 2026-03-23**: 11 flat bundles (~40 city slugs) → 36 sub-regional bundles, 467 verified city slugs.

- **Greater LA**: 8 sub-bundles (West LA/Beach Cities, Hollywood/Mid-City, SFV, Pasadena/Foothills, South Bay, Downtown/East LA, Santa Clarita/North LA, Long Beach/Gateway)
- **Orange County**: 4 sub-bundles (North, South Coastal, Central, South Inland)
- **Inland Empire**: 4 sub-bundles (West IE, East IE/Riverside, Temecula Valley, Mountain/High Desert)
- **San Diego**: 5 sub-bundles (Coastal, Central, North County Inland, South Bay, East County)
- **SF Bay Area**: 4 sub-bundles (SF, East Bay, Peninsula, Marin)
- **South Bay/Silicon Valley**: 2 sub-bundles
- **Sacramento**: 1 bundle (metro)
- **Central Valley**: 2 sub-bundles (North/South)
- **Central Coast**: 3 sub-bundles (Ventura County, Santa Barbara, SLO/Monterey/Santa Cruz)
- **Desert**: 1 bundle (Coachella Valley)
- **North State** + Wine Country split out

**Critical Fix**: CA has 1,650+ cities. Query was returning only first 1,000 alphabetically (everything past "S" missing). Fixed with pagination loop.

**BundlesPanel Component**
- Hierarchical mode (CA): 3-level expander (region → sub-region → city checkboxes). Single-bundle categories skip middle level.
- Flat mode (AZ): Table layout with bundle name, city count, Add button + chevron expander.
- Selected count badges at every level.

---

### AI Surfaces & Bot Analytics

**AI Surfaces Rollup -- 10x Inflation Fixed**
- **Root cause**: Rollup joined neighborhood crawls on `served_cities`, attributing every neighborhood crawl to ALL agents in the city.
- **Fix**: New `served_neighborhoods` JSONB column (+ GIN index) on `professionals`. `assign-neighborhoods.ts` populates via 3-tier matching:
  - Tier 1 (service_areas text matching): 2,432 agents (74%)
  - Tier 2 (zip code proximity): 569 agents (17%)
  - Tier 3 (city-only fallback): 273 agents (8%)
  - Average 16.9 neighborhoods per agent.
- **Rollup function**: `rollup_ai_surfaces_monthly()` uses 3-way UNION: city crawls → `served_cities`, neighborhood crawls → `served_neighborhoods`, profile crawls → `canonical_slug`.
- **Result**: 98M → 14.8M total surfaces (correct 7-day window).
- **Cron**: Old `rollup-agent-ai-surfaces` unscheduled. New `rollup-ai-surfaces` runs daily at 04:00 UTC.
- **Open item**: One agent has 349 neighborhoods (likely county-level match) -- consider capping at ~30.

**AI Surfaces Definition (canonical)**
- City page crawls → all agents in `served_cities`. Neighborhood page crawls → only agents in `served_neighborhoods`. Profile crawls → canonical_slug agent only.
- `served_neighborhoods` is canonical agent-to-neighborhood mapping. Must be re-run after enrichment adds agents or service_areas change.

**Bot Analytics Dashboard**
- Agent Coverage tab: "Human" (ChatGPT-User, OAI-SearchBot, PerplexityBot) and "Bot" (all other automated crawlers) columns.
- Title: "Agent AI Surfaces (7-day)".

**Vercel Log Drain**
- Root cause of prior 98% data loss: regex didn't match `path: "/api/serve-clean-html?fn=...&path=..."` format. Fixed with path extraction from query string.
- Open item: Monitor drain catch-up for Mar 22-24. Re-backfill gaps if Vercel doesn't retry.

**Bot Page Agent Selection -- Known Issue**
- `serve-bot-list-html` shows ALL city agents on every neighborhood page (queries by `city_id` only). `agent_neighborhood_subscriptions` table exists but isn't used. Fix pending.

**Crawl Log Backfill**: 532,789 rows backfilled across Mar 17-21 to normalize to ~144K/day average.

---

### Stripe & Payments

- **stripe-webhook**: Fixed tier detection -- reads `badgeTier` from subscription metadata. SDK upgraded v14.21.0 → v18.5.0, API version `2025-08-27.basil`.
- **complete-agent-subscription**: Sets `badge_tier` and `badge_status` from checkout session metadata on payment success.
- **AgentDashboard**: "Upgrade Package" button navigates to `/funnel/:token/pricing`. Added `?section=` deep-link support for tabs.
- **Payment Success Page**: Shows tier badge, AIFS score, band label. Web of Truth CTA with pulsing tier orb. "What just changed" section. Inline question form submits to `field_change_requests` as CRM task.
- **Certified tier added to `TIER_META`** (was missing -- Certified agents saw "Audited tier is active").
- Stripe secrets confirmed: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET set in Supabase.

---

### GEO & Content Consistency

- **Agent counts standardized**: 3,262 total (872 AZ + 2,390 CA) across mcp.json, ai-content-index.json, llms.txt, llms-full.txt, FAQ, React pages, edge functions, admin demos.
- **Certified tier**: Active. "Invitation-only" language replaced with merit-based selection across 14 files. Refresh corrected to "quarterly" everywhere.
- **Selection rationale**: 12 DB records updated -- "fewer than 1% of licensed agents in covered markets."
- **Source count language removed** (27 files, ~70 replacements): Listed/Certified = "Core credential verification", Audited = "Expanded background research", Underwritten = "Exhaustive background research".
- **Coverage counts must match sitemaps**: coverage-stats, FAQ, /for-ai all use same filtered query (Sitemap Rule A).
- **GEO audit remediations**: C1 coverage-stats counts only qualifying agents; H1 FAQ dynamic language; H2 `/why-ai-trusts-us` → 301 `/for-ai`; H3 `/login` → 301 `/agent-login`; H4 homepage OG image tag; H5 `get_founder_profiles` in mcp.json; M1 all 10 ai-feed dates bumped to 2026-03-21.
- **GEO enhancements**: ItemList JSON-LD with `url`, `areaServed`, `itemListOrder`. Lead summary paragraph (`data-ai-summary="true"`). Dynamic `dateModified` from agent `updated_at`.
- **`serve-stats-json`** edge function at `/stats.json` (1-hour cache): 3,262 agents, 1,738 cities, 10,144 neighborhoods.
- **Founder → Cofounder**: All public-facing references updated (9 files). Schema.org arrays include both Robert Maynard and Mark Garland.
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

**Edge Function Updates**
- `update-professional-field`: Added `phone_numbers` and `website_visible` to allowed fields. All funnel saves go through this function (not direct `.update()`) to bypass RLS.
- `website_visible` boolean column added to `professionals` table (default true).

**Pages Removed**
- `/compare` (AICompare.tsx) and `/why-ai-trusts-us` (WhyAITrustsUs.tsx) deleted.
- `/for-ai-systems` → `/for-ai` (301). `/methodology` → `/about/ranking-methodology` (301).
- Old funnel step routes (`/review-1`, `/review-credentials`, `/review-2`, `/review-final`, `/pricing`) replaced with new paths.

**Founder Profile System**
- `get_founder_profiles` MCP tool: queries `marketing_content` live, falls back to hardcoded defaults.
- `serve-bot-founder-html`: fetches live profiles, enriches JSON-LD Person schemas, renders claims with verification links.
- Verifiable claims: `{ text, sourceUrl }` objects with verification URLs (SEC EDGAR, FTC, Delaware corp search, etc.).

**Pipeline Demos** (staging only): `/admin/demo/` hub. Note: enrichment diagram incorrectly references DataForSEO Maps API -- Top10Lists uses Serper.dev.

---

### Scoring & Methodology

- **AIFS Pillar weights**: Identity 25, Citability 25, Social Proof 20, Authority 15, Technical 15.
- **Internal scoring weights**: License Status 20%, Recent Activity 20%, Transaction History 20%, Reviews/Reputation 15%, Community 25%.
- **Consumer-facing weights**: Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education 10%.
- **AIFS default**: 24 (baseline without tier uplift).
- **Close rate default**: 20% (funnel calculator). Agent can adjust. Revenue projections must be defensible.
- **Default deal size**: $750k.

---

### Standing Rules

- **NO CACHING ON BOT-FACING PAGES**: No rendered_pages, no CDN s-maxage, no KV, no Cloudflare, nothing. The Vercel proxy is dead. Do not recreate it. Every request hits the edge function directly.
- **logBotVisit() is REQUIRED**: Every serve-bot edge function must call `logBotVisit()` before returning. If you create a new one, add the call.
- **TEST BEFORE DONE**: Never say "done" without verifying end-to-end with real data. Show receipts.
- **DO NOT PUSH without Robert's express permission** -- all dev on localhost.
- **run_sql is SELECT-only**: Use `.update()`/`.insert()` for writes.
- **RLS blocks anonymous updates**: Funnel saves must go through edge functions with service role, not direct Supabase client `.update()`.
- **Supabase 1,000-row limit**: Always paginate tables that can exceed 1,000 rows.
- **Vercel SPA rewrite** must include any new client-side route prefix.
- **HTML emails must be wrapped**: `<!DOCTYPE html><html><body>` on every body.
- **Base64 must be line-wrapped**: 76 chars per line per RFC 2045.
- **Sequencer send window is MST-aligned everywhere**: Both `isInSendWindow()` and volume tracking `todayStr` must use MST dates.
- **Campaign pause enforced by sequencer**: Must check `email_campaigns.status` before sending.
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

- Old `rollup-agent-ai-surfaces` cron -- replaced with `rollup-ai-surfaces`.
- Old surface numbers (98-119M) -- inflated 10x. Correct range ~14-15M for 7-day window.
- Old PaymentSuccess page (light theme) -- replaced by `AgentPaymentSuccess`.
- Original badge PNGs with black backgrounds -- replaced with transparent HAL 9000 orbs.
- "1,000+ sources" / source count language everywhere.
- "Founder" title -- now "Cofounder".
- Old 8-step funnel (`/review-1`, `/review-credentials`, `/review-2`, `/review-final`, `/pricing`) -- replaced with 5-step flow.
- Old CA city bundles (11 flat bundles, ~40 slugs) -- replaced with 36 sub-regional bundles, 467 slugs.
- 30% close rate assumption. Old AIFS default of 42. Old deal size default of $500k.
- Hardcoded coverage counts in FAQ.
- Complete button from campaign monitor.
- Old daily limit formula (per-domain tiers) -- replaced with universal `40 × 1.10^days`.
- Legacy AIFS Fields section from List Maker UI.
- `/compare` (AICompare.tsx) and `/why-ai-trusts-us` (WhyAITrustsUs.tsx) -- deleted.
- "pre-rendered HTML" language in robots.txt -- replaced with "clean-room HTML".
- Old slug resolution loop in vercel-log-drain -- replaced with single batch query.
- All draft/active campaigns and 15,105 queued emails deleted (clean slate before relaunch).
- "What AI sees" detail columns from tier page. AIFS score context bar from tier page. "Stay with your free listing" exit link.

