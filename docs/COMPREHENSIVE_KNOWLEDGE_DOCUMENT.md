# Top10Lists.us — Comprehensive Knowledge Document

**Purpose:** Single consolidated reference for agent2, Claude, and Cursor. Use latest updates as source of truth.  
**Last consolidated:** 2026-03-26
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

| Tier | Price | Refresh | Notes |
|------|-------|---------|-------|
| Listed | Free | Annual | Basic verification. Standard badge. |
| Certified | Free | Quarterly | Enhanced verification. Open to all qualified agents. Reactivated 2026-03-12. |
| Audited | $300/mo | Monthly | Expanded evidence, API access. |
| Underwritten | $500/mo | Near real-time | Full evidence, highest signal strength. |

- **4-tier model.** All four tiers are active and open to qualified agents.
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

- **4-Tier Acquisition Model:** Listed $0 (annual), Certified $0 (quarterly), Audited $300/mo (monthly), Underwritten $500/mo (near real-time). All four tiers active and open to qualified agents.
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

*Last synthesized: 2026-03-26*

---

### Critical Architecture: CDN Cache + Axiom Log Drain

**The "no caching" rule is obsolete.** All serve-bot edge functions now return `s-maxage=43200` (12h CDN cache) for fast bot response times. Axiom log drain captures every request (cache HIT + MISS).

**Root cause of 143K → 13K logging drop**: Edge functions had `s-maxage` headers → Vercel CDN cached responses → `logBotVisit()` only fires on cache MISS → 90%+ of bot traffic was invisible. This was NOT bot throttling.

**Current architecture:**
```
Bot → Vercel CDN (12h cache) → [HIT: cached response] OR [MISS: Supabase edge fn → logBotVisit()]
                ↓
         Axiom log drain (every request, HIT + MISS) → sync-axiom-crawls → bot_crawl_hourly
```

**Axiom setup:**
- Dataset: `vercel` on axiom.co. API token: `AXIOM_API_TOKEN` Supabase secret.
- `sync-axiom-crawls` edge function: queries Axiom APL every 12h, aggregates by hour+bot_name, writes to `bot_crawl_hourly` (PRIMARY KEY: hour, bot_name).
- API endpoint: `https://api.axiom.co/v1/datasets/_apl?format=tabular` (NOT `/v1/datasets/vercel/query`).
- 26 bot patterns detected via APL `case` statement.
- Dashboard queries UNION `bot_crawl_logs` (historical) + `bot_crawl_hourly` (Axiom-sourced).

**`logBotVisit()`** remains as backup -- fires on cache MISS only. Primary counting is via Axiom.

**Vercel proxy restored**: `api/html.js` edge-runtime proxy fetches from Supabase and sets `Content-Type: text/html`. All 49 serve-bot Vercel rewrites go through this proxy. Root cause: Supabase gateway forces `Content-Type: text/plain` regardless of what the edge function sets -- the old proxy had been masking this.

**Vercel log drain** (`vercel-log-drain` edge function): returns 410 Gone. Still answers Vercel GET verification probes.

---

### Bot Crawl Volume & Analytics

**Canonical crawl volume: ~161K/day total.**

| Bot | Daily Crawls |
|-----|-------------|
| Meta AI (Llama) | 94,088 |
| PerplexityBot | 22,573 |
| Applebot | 17,086 |
| Googlebot | 14,376 |
| ByteSpider (TikTok) | 3,624 |
| ChatGPT-User | 3,089 |
| AhrefsBot | 2,231 |
| OAI-SearchBot | 1,832 |
| GPTBot | 1,408 |
| Bingbot | 670 |
| Others | 337 |
| **Total** | **~161,314** |

Meta alone is 58% of all crawler traffic. The 161K/day figure is a powerful proof point for agent outreach -- frame as reinforcement events.

**Human vs Bot classification**: ChatGPT-User, OAI-SearchBot, PerplexityBot = human-initiated. Everything else = automated bot.

**Robots.txt notes**: `Gemini-AI` may not be real (Google Gemini likely crawls via `Google-Extended`/`GoogleOther`). `Claude-Web` and `Anthropic-AI` may be dead entries (primary Anthropic crawler is `ClaudeBot`). Bytespider feeds ByteDance models, not consumer-facing AI.

---

### AI Surfaces & Rollup

**Rollup -- Complete Rebuild (deployed)**

Fixes: `normalize_bot_name()` SQL function (17 canonical bot names), fixed date window (`CURRENT_DATE - 7` to `CURRENT_DATE`, excludes partial day), neighborhood fallback matches page behavior (thick NH >=3 agents uses `served_neighborhoods`; thin NH <3 agents falls back to city-level), staging table approach, B2 split by state, `SET statement_timeout = '600s'`, GIN indexes on `served_cities`/`served_neighborhoods`, hard cap of 30 neighborhoods per agent.

Single rollup cron at 05:00 UTC daily (job 41). Duplicate job 49 unscheduled.

**served_neighborhoods rebuild**: 3,206 of 3,269 agents have neighborhoods. Distinct slugs: 5,015. Tier 1 (service_areas text): 2,432 (74%), Tier 2 (zip proximity): 569 (17%), Tier 3 (city fallback): 273 (8%).

**Results:**

| Metric | Before | After |
|--------|--------|-------|
| Total 7d surfaces | 10,342,375 | 37,506,228 |
| Median per agent | 2,258 | 3,799 |
| Bot names | 26 (duplicates) | 17 (normalized) |
| NH coverage | 50% dropped | 100% attributed |

**AI Surfaces Definition (canonical):**
- City page crawls → all agents in `served_cities`
- Neighborhood page crawls (thick, >=3 agents) → agents in `served_neighborhoods`
- Neighborhood page crawls (thin, <3 agents) → city-level fallback
- Profile crawls → canonical_slug agent only

**Bot Analytics Dashboard**: Agent Coverage tab has "Human" and "Bot" columns. Title: "Agent AI Surfaces (7-day)".

**RLS**: Enabled on `agent_ai_surfaces`, `agent_ai_surfaces_by_bot`, `page_bot_hits`. `mcp_request_stats` view changed to SECURITY INVOKER.

**Pending manual SQL**: `rollup_ai_surfaces_monthly` needs update: `> now() - interval '7 days'` → `>= CURRENT_DATE - 7 AND < CURRENT_DATE`.

---

### Email Infrastructure & Campaigns

**Campaign Status**
- "Listed 7d crawl" launched 2026-03-21: 568 sent, 28 bounced, 12 unsubscribed.
- Corrected metrics (after scanner filter): ~37 real opens (6.5%), ~6 real clicks (1.1%).
- Daily ramp: 40 base × 1.10^days. Queue drains ~Mar 31 -- Apr 1.
- 30 team rows + 1 pending_email_verification row pulled from queue (set to `skipped`). Root cause: `CampaignManager.tsx` missing `exclude_teams: true` -- fixed.

**Bot/Scanner Detection (deployed -- opens AND clicks)**
- Email security scanners pre-fetch tracking pixels and links within 3-15 seconds of delivery.
- Opens < 60s after `sent_at` = `scanner_open` in `crm_contact_activity` (visible in timeline), NO CRM task.
- Clicks < 60s = `scanner_click` -- same treatment.
- Both scanner and human events always logged to activity timeline with `is_scanner: true/false` in metadata.
- Human click on real link (>60s, not unsub) → creates `email_clicked` task + alert.
- Human click on `/funnel/` link → also creates `funnel_landed` task server-side.
- Unsubscribed agents skip all task creation.
- 111 false-positive `email_opened` tasks marked completed with note "Auto-closed: scanner open".
- Applied to both legacy email path AND sequencer v2 (campaign) path.

**Bounce Exclusion**
- `exclude_bounced` defaults `true` in `ListMakerCriteria`. Filter `lead_status != 'email_bounced'` in ListMaker, CampaignManager, and `list-maker-export`.
- `gmail-sync` sets `lead_status = 'email_bounced'` on bounce detection. Completing bounce task resets to `'warm'`.

**Sequencer Bugs Fixed (all deployed)**
- UTC/MST date mismatch fixed with `getMSTDateStr()` helper.
- Global daily cap = per-account limit × number of accounts.
- Paused campaigns enforced. Campaign-level `max_per_day` enforced.
- Base64 body parts: RFC 2045 compliant (76-char line wrapping).
- HTML document wrapper required: `<!DOCTYPE html><html><body>`.
- Click tracking covers all links including own domain.
- Campaign counters use `.update()` (not `run_sql` which is SELECT-only).
- Bounce detection: sweeps Gmail for mailer-daemon messages, marks queue rows failed, creates CRM tasks.
- `<p>` tag margins: `style="margin:0 0 1em 0;"` injected in `sequencer-v2-tick` and `gmail-send`.
- Mark Garland display name added in From header for `mark@` accounts.
- `gmail-send` tracks volume in `email_send_volume`.
- `gmail-oauth-callback` edge function deployed.
- Deprecated `sequence-processor` returns 410 Gone.

**Unsubscribe**: `unsubscribe` edge function marks `sent` queue items (not just pending) as `unsubscribed`. 12 unsubscribed agents backfilled.

**Sender Config**: 5 accounts total (mark@ connected via OAuth). 4 active for campaigns, all 5 for task emails. Send window: 5am-8pm MST, Mon-Sat. 3-minute minimum cooldown per account.

**Email Bounce Handling**: `auto-resolve-bounces` edge function: parses Exa suggestions, validates via ZeroBounce (valid only, no catch-all), fuzzy name-matches, updates email + resets lead_status. 45 new emails found via Serper. 161 agents flagged `pending_email_verification`.

**Campaign Wizard (7-step)**: Create → Build List → Create Email → Send Gates → Review → Test → Launch. Variable interpolation at queue time. Templates from `crm_email_templates`.

**Merge Variable Picker**: Shared `MergeVariablePicker` popup component with search, 49 variables across 6 categories (Contact, Profile, Dates, AI Surfaces, AIFS, System). Link variables auto-wrap in `<a>` tags. Added to all 5 compose surfaces. Shared constants in `src/components/crm/merge-variables.ts`.

**Merge variables standardized**: First Name, Full Name, Tier, City, Dashboard, AIFS Score, Crawl Stats 7d. "Magic Link" renamed to "Dashboard" everywhere. `Total Bot Crawls (7d)` in ListMaker OUTPUT_FIELDS.

**Post-deploy hook**: Auto-sends test email to `robert@aryah.ai` after email function deploys.

---

### CRM Improvements

- **Tasks: Sales vs Ops tabs** -- Sales (email_clicked, funnel_landed, funnel_engaged, funnel_pricing_viewed, funnel_tier_selected, funnel_checkout, funnel_completed). Ops (email_opened, email_bounced, inbound_reply, follow_up, aifs_analysis, founder_contact, field change requests).
- **Click auto-closes open task** -- `email_opened` Ops task auto-completed with note "promoted to Sales". Sequencer v2 click uses `.upsert()` to prevent duplicates.
- **Inline field editor** on ContactDetail: dropdown of 26 curated fields + all remaining, Save via `update-professional-field`. Allowlist expanded.
- **Audit log**: `crm_field_change_log` table (migration SQL created, needs manual run).
- **Phone Sale button** on TasksManager sales tasks and ContactDetail. Routes by tier (Listed→funnel, others→dashboard) with `?mode=sales`.
- `create-stripe-invoice` edge function: creates Stripe customer, generates invoice, sends via Stripe email.
- `SandboxStep5Tier`: `?mode=sales` shows "Send Invoice". `SandboxInvoiceSent` confirmation page added.
- **Contact button hidden** when `professional_id` is null.
- **Live Activity Feed removed** from Campaign Monitor. Stats grid retained.
- **CRM task cleanup**: Deleted 1,270 false-positive tasks (868 license_alerts, 374 scanner email_opened, 28 scanner email_clicked). 99 real pending tasks remain.
- **Dashboard edit fixes**: Neighborhood/cities edit uses sessionStorage professional ID. Coverage save uses `update-professional-field`. X delete buttons on all profile badges. Community section shows role descriptions.

---

### Funnel & Dashboard

**5-Step Funnel (deployed 2026-03-23)**
1. Your Listing -- AI surface stats, value prop nugget, "Certify Your Listing" CTA
2. Contact -- Email, 3 phone fields, website -- each with publish toggle + per-field auto-save on blur
3. Cities -- Hierarchical selector (region → sub-region → city checkboxes)
4. Neighborhoods -- Search filtered to cities selected in step 3. Fuzzy matching for `nearby_neighborhoods`
5. Tier/Pricing -- 3 tier cards with revenue calculator. Monthly/annual toggle inside each paid card

**Key Funnel Decisions**: No profile photo. No "What AI sees" columns on tier page. No exit link. Nugget always above title. CTAs: "Stay with Free" / "Choose Audited" / "Choose Underwritten" (prices removed from button text). Dev mode: success page auto-reverts agent to Listed.

**Routing**: `/funnel/:token/*` and `/sandbox/:token/*` serve same components via `useBasePath()`. Certified/Audited/Underwritten agents routed to `/dashboard/:token`. `SandboxStep1` redirects paid-tier agents to dashboard on entry.

**Broken route fixes**: OverviewSection "View Upgrade Options", AIMaxPlan upgrade link, BillingSection upgrade -- all corrected from `/pricing` → `/tier` and `/visibility/tiers` → `/funnel/:token/tier`.

**TierPricingCalculator**: Default deal size $750k, default close rate 20%, heading "Calculate your first year revenue uplift."

**Funnel Instrumentation**: All steps tracked via `crm_contact_activity` + `crm_tasks`. `funnel_landed` tasks created server-side in `email-track`. Column name fix in `funnel-track.ts` (`activity_type` → `event_type`, `description` → `subject`).

---

### Stripe & Payments

- **stripe-webhook**: Reads `badgeTier` from subscription metadata. SDK v18.5.0, API version `2025-08-27.basil`.
- **complete-agent-subscription**: Sets `badge_tier` and `badge_status` from checkout session metadata.
- **Payment Success Page**: Shows tier badge, AIFS score, band label. Web of Truth CTA. "What just changed" section. Inline question form submits to `field_change_requests` as CRM task.
- **Certified tier added to `TIER_META`** (was missing -- Certified agents saw "Audited tier is active").
- Stripe secrets confirmed: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET set in Supabase.

---

### GEO & Content Consistency

**GEO Audit Scores**: Perplexity V1 (Mar 25): 92/100 → Perplexity V2 (Mar 26): 96/100. Claude Code independent audit: 94/100.

**Fixes deployed (Mar 26)**:
- All stale timestamps updated to March 26, 2026 (Privacy, SMS Terms, llms-full.txt, ai-content-index.json, mcp.json).
- Merit gate 4.5+/10+/5+ consistent across all 10 audited assets.
- AIFS score rendered on every agent profile page (HTML body + JSON-LD `additionalProperty`).
- WebSite+SearchAction JSON-LD added to homepage.
- "Why selected" (`selection_rationale`) now fetched for ALL agents on list pages (was gated to Certified+).
- City page ItemList `dateModified` uses `max(updated_at, license_verified_at)`.
- 7 missing `selection_rationale` values backfilled -- 3,269/3,269 coverage.

**Agent counts -- floorPlus standard**: `floorPlus()` rounds down to nearest 100, appends "+". E.g., 3,268 → "3,200+". Applied across llms.txt, llms-full.txt, mcp.json, ai-content-index.json, all edge functions. Eliminates cross-page contradictions. JSON-LD structured data keeps exact counts for machine use.

**Scoring weights standardized**: Removed internal scoring model from all public surfaces. Single canonical model everywhere: Community 25%, Review Rating 25%, Number of Reviews 20%, Transaction History 20%, Education & Credentials 10%. Fixed in: transparency page, methodology page, mcp-server, methodology-schema.json.

**Content standardization (all deployed)**:
- "Invitation-only" language replaced with merit-based selection. Refresh: "quarterly" everywhere. Selection rationale: "fewer than 1% of licensed agents in covered markets."
- Source count language removed (27 files): Listed/Certified = "Core credential verification", Audited = "Expanded background research", Underwritten = "Exhaustive background research."
- Coverage counts match sitemaps across all surfaces (Sitemap Rule A).
- Founder → Cofounder: all public-facing references updated. Schema.org arrays include both Robert Maynard and Mark Garland.
- Homepage quote: Gemini -- "Being on Top10Lists.us is the difference between being a 'Maybe' and being the 'Definitive Answer.'" Moved directly under h1.
- Homepage hero: Merit gate checklist added. "We don't sell leads" section moved above "AI has moved."
- Certified audit cycle: ai-content-index fixed to "Quarterly" (was "Monthly"). Artifact format: fixed to "text/markdown" (was "text/html"). Dual mcp.json: public/mcp.json synced to .well-known/mcp.json.

**GEO enhancements (all deployed)**:
- Homepage "Browse by State" section -- 18 links to AZ/CA hubs + top cities (addresses 6,104 "discovered but not indexed" pages).
- `rel="nofollow noopener"` on all external links in city/neighborhood/agent pages.
- `dateModified` freshness: agent profiles use max(updated_at, license_verified_at).
- CC BY 4.0 on all Dataset schemas.
- ItemList JSON-LD with `url`, `areaServed`, `itemListOrder`. Lead summary paragraph (`data-ai-summary="true"`). Dataset JSON-LD on all neighborhood pages (Professional Performance Audit schema, CC BY 4.0, three variableMeasured, spatialCoverage with GeoCoordinates).
- H2 `/why-ai-trusts-us` → 301 `/for-ai`; H3 `/login` → 301 `/agent-login`.

**New pages**:
- `/ai-reviews`: Static clean-room HTML with JSON-LD Review schemas for 5 AI platforms (Perplexity, ChatGPT 8.4/10, Claude 95/100, Gemini 9.8/10 latency, Grok). Cold-start prompt requiring live retrieval. Cross-referenced in footer, llms.txt, llms-full.txt, mcp.json, ai-content-index.json, robots.txt, sitemap.
- `/for-ai/performance-guarantee`: Data Freshness & Latency Guarantee (v2026.1). <150ms TTFB, <300ms core pages, <1.5s aggregates, ZLIP protocol.
- `/about/zlip-whitepaper`: Clean-room HTML with ScholarlyArticle JSON-LD.

**`serve-stats-json`** at `/stats.json`: 3,262 agents, 1,738 cities, 10,144 neighborhoods.

**Oracle/TVPR dual-domain strategy rejected.** Direction: "Unified Oracle" -- deepen verification signals on Top10Lists.us. Subfolder architecture (top10lists.us/registry/agent-id-123) rather than second domain.

**GSC Coverage**: Indexed pages: 11 (Jan 2) → 6,879 (Mar 15). Mar 15-17 drop: 6,879 → 5,003 (lost 1,876 pages -- needs investigation). 6,104 "discovered, not indexed" -- Browse by State deployed, monitor 2 weeks. GSC Datasets: 1 valid item returned Mar 21 (CC BY 4.0 + creator fixes deployed).

---

### Performance & Static Pages

**Static page system (deployed)**:
- Founder page: captured rendered HTML to `public/about/founder.html`. ~130ms (was 1,378ms).
- Crawl stats: pre-rendered HTML from `static_pages` table via prebuild. ~161ms (was 1,508ms).
- stats.json: static file from coverage snapshot. ~130ms (was 6,328ms).

**Daily coverage snapshot** (cron job #54, daily 5am MST): queries DB for agent/city/neighborhood counts, writes JSON to `static_pages`. `_shared/live-counts.ts` reads from snapshot. Prebuild fetches snapshot to `.coverage-counts.json`. All surfaces show "Data last verified: {date}".

**Comprehensive daily health check** (`health-check-daily`): 70+ checks across 14 categories (pages, Content-Type, bot crawl logging e2e probe, AI surfaces, email/campaigns, Stripe, CRM, enrichment, licenses, DB health, sitemaps, edge functions, DNS/SSL, artifacts). Always sends full HTML report email at 7am MST. `checkPage()` validates Content-Type is text/html. Table needs manual creation in SQL editor.

---

### Nightly License Verification

- `verify-licenses-nightly`: batch-verifies all agents against AZDRE/CalDRE. Resumable (skips agents verified within 24h). 10 concurrent lookups, 1s inter-batch delay.
- Status changes (Active→Suspended/Revoked): agent de-listed, profile retained with "Verified Inactive" schema signal, `license_alert` task created.
- Agent profiles show "Confirmed [date]" next to license number. JSON-LD `hasCredential` includes `credentialStatus` and `dateVerified`.

**AZDRE scraper bug -- CRITICAL**:
- Old scraper: scraped AZDRE website per-license. AZDRE returned "Session Expired" → regex matched "Expired" from page title → 865 of 879 active AZ agents marked as expired.
- **New scraper**: downloads full AZDRE CSV (222K records) once per run from `services.azre.gov/PdbWeb/List/DownloadList/1`, builds Map, does instant local lookups. If download fails, AZ verification skipped entirely.
- All 865 AZ `license_status` values reset from "Expired" to "Active" via manual SQL.
- California verification works correctly (2,387 Active, 3 EXPIRED).
- pg_cron: `*/30 8-11 * * *` (every 30 min, 1-4am MST). Needs manual creation in SQL editor.

---

### Texas Expansion

**47 cities, 1,140 neighborhoods added (data only -- writeups not yet triggered).**
- 11 core cities (250k+), 36 satellite cities (50k+).
- OSM Overpass API: 1,091 neighborhoods across 8 metro bounding boxes. Final: 1,140 after dedup.
- Census ACS 2023: 1,989 TX ZCTAs. HMDA 2022: 419,419 mortgage originations.
- Tier scores: Main (510), Prime (499), Luxury (135).
- **TX removed from live sitemaps and SQL queries** -- zero agents. Kept as "expanding to" in llms-full.txt. Will re-add to SITEMAP_STATES when agents are ingested.
- Writeup generation: DeepSeek for Prime/Luxury, Gemini for Main. Estimated cost: < $1.00.

---

### California City Bundles

**Rebuilt 2026-03-23**: 11 flat bundles → 36 sub-regional bundles, 467 verified city slugs. Critical fix: CA has 1,650+ cities -- query was returning only first 1,000 alphabetically, fixed with pagination loop.

**BundlesPanel**: Hierarchical mode (CA) -- 3-level expander. Flat mode (AZ) -- table layout.

---

### Enrichment Pipeline

- **LinkedIn enrichment via Serper**: `enrich-linkedin-batch` + `--linkedin` flag in orchestrator. 39 profiles found. ~30% hit rate on high-review agents.
- **ZeroBounce integration**: `auto-resolve-bounces` edge function. API key in Supabase secrets.
- **Canonical enrichment costs**: Serper $0.003/search, Memo23 $0.03/agent, Exa $0.003/search, DeepSeek $0.0002/agent. Google Places/Maps NOT used. Prequalification pass rate ~2%.

---

### Clean-Room & Site Infrastructure

- **SPA routes cleaned up**: Removed ~25 public page routes from manifest.tsx. Converted all `<Link>` to `<a href>` in Header.tsx and Footer.tsx for public pages. SPA now only handles authenticated routes.
- **merge-to-main script**: Now uses `--no-commit --no-ff` -- internal docs (CLAUDE.md, COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md) removed within merge commit, no separate deletion commit to propagate back to staging.
- **Shared `_shared/site-chrome.ts`**: `breadcrumbJsonLd()` and `ogTags()` helpers in all 9 serve-bot edge functions.
- **MCP endpoint**: `api/mcp.js` Vercel proxy adds Supabase auth headers.
- **Sitemap automation**: Runs on every build via prebuild. Agent pages: Underwritten=daily, Audited=monthly, Certified=monthly, Listed=yearly.
- **`Link` header**: `</.well-known/mcp.json>; rel="mcp-server"` on all responses.
- **pg_cron jobs**: `sequencer-v2-tick` every 2 minutes. `rollup-ai-surfaces` daily 05:00 UTC (job 41). `purge-bot-crawl-logs` daily 03:00 UTC (30-day retention). `verify-licenses-nightly` every 30 min, 1-4am MST. `refresh-coverage-counts` daily 5am MST (job #54).
- **`update-professional-field`**: `phone_numbers` and `website_visible` in allowed fields. All funnel saves go through this function to bypass RLS.
- **`website_visible`** boolean column added to `professionals` (default true).
- **CLAUDE.md** at repo root for Claude Web access. Claude Web takeaways repo: `rjmjr1962831/top10lists-knowledge`.
- **Mark's phone**: (480) 204-6636.

**Neighborhood Count Mismatch Fix**: `generate-ai-feeds.ts` now uses same qualified-city JOIN as sitemap generator. Will reconcile on next prebuild.

**Verde Valley neighborhoods**: Added 27 neighborhoods (Cottonwood, Camp Verde, Clarkdale, Jerome, Cornville) + 29 Sedona neighborhoods. Haversine nearby neighborhoods computed for all 58.

**Founder Profile System**: `get_founder_profiles` MCP tool queries `marketing_content` live, falls back to hardcoded defaults. `serve-bot-founder-html` enriches JSON-LD Person schemas with verifiable claims (`{ text, sourceUrl }` with verification URLs).

**DB Connection Note**: DATABASE_PASSWORD in .env is stale. `supabase db query --linked` works. DB direct connection is IPv6-only from Robert's machine.

---

### Scoring & Methodology

- **AIFS Pillar weights**: Identity 25, Citability 25, Social Proof 20, Authority 15, Technical 15.
- **Consumer-facing weights (canonical, single model)**: Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education & Credentials 10%.
- **AIFS default**: 24 (baseline without tier uplift). **Close rate default**: 20%. **Default deal size**: $750k.

---

### Conversion Strategy

**Core finding**: The conversion gap isn't the product -- it's the conversion architecture. Universal playbook: pre-populate profiles, surface something alarming about the unclaimed profile, offer a free "claim" (reframe from "sign up" to "claim"), gate premium features behind paywall after customization creates psychological ownership.

**Benchmark rates**: Industry median 2-5% free-to-paid, 5-10% with sales-assisted models. Applied to 3,487 agents: 20% claim rate = ~700 claimed, 5-7% paid = 35-50 paying customers.

**Why cold email alone won't work**: B2B cold email reply rates 3-5%; for RE agents 0.1-0.3% for desired actions. At 100K contacts with optimistic assumptions: ~90 claimed profiles.
