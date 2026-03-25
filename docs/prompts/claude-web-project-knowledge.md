# Top10Lists.us — Comprehensive Knowledge Document

**Purpose:** Single consolidated reference for agent2, Claude, and Cursor. Use latest updates as source of truth.  
**Last consolidated:** 2026-03-25
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

*Last synthesized: 2026-03-25*

---

### Critical Architecture: No Caching, No Proxy

**The Vercel proxy (`api/serve-clean-html.js`) has been permanently deleted.** All bot-facing Vercel rewrites go directly to Supabase edge functions. There is NO caching layer of any kind:
- No Vercel CDN cache (`s-maxage` removed, `max-age=0, must-revalidate` on all bot pages)
- No `rendered_pages` DB cache
- No Cloudflare, no KV, no Prerender.io

Root cause of Mar 24 logging incident: `rendered_pages` cache served pages without hitting edge functions. `logBotVisit()` was imported but never called in serve-bot functions (dead import). Proxy was the only thing logging -- when it was deleted, logging dropped 98%. Both issues fixed.

**Vercel log drain disabled**: `vercel-log-drain` edge function returns 410 Gone. Still answers Vercel GET verification probes. Single source of truth: `logBotVisit()` in each serve-bot-* edge function.

**Bot crawl logging**: `logBotVisit()` fires exactly once per edge function execution. Every serve-bot edge function must call it before returning. Fire-and-forget, 28 bot patterns, `x-forwarded-user-agent` support.

**Architecture (final):**
```
Bot → Vercel CDN (pass-through, no cache) → Supabase edge function → logBotVisit() → Response
```

---

### Bot Crawl Volume & Analytics

**Canonical crawl volume: ~161K/day total, ~13K logged via `logBotVisit()`/day.**
- The 146K/day log drain figure was artificially inflated by duplicates, CDN pass-throughs, multi-counted requests
- Mar 17-21 backfill to "normalize to ~144K/day" was synthetic -- disregard
- Each `logBotVisit()` fires exactly once per edge function execution
- Vercel confirmed NOT caching (X-Vercel-Cache: MISS)
- The ~161K/day total includes all crawler hits to Vercel CDN (most pass-through without triggering edge functions)

**Bot breakdown (from server logs):**

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

Meta alone is 58% of all crawler traffic. The 161K/day figure is a powerful proof point for agent outreach and whitepapers -- frame as reinforcement events.

**Human vs Bot classification**: ChatGPT-User, OAI-SearchBot, PerplexityBot = human-initiated. Everything else = automated bot.

**Robots.txt notes**: `Gemini-AI` user-agent may not be real (Google Gemini likely crawls via `Google-Extended`/`GoogleOther`). `Claude-Web` and `Anthropic-AI` may be dead entries (primary Anthropic crawler is `ClaudeBot`). Bytespider feeds ByteDance models, not consumer-facing AI.

---

### AI Surfaces & Rollup

**Rollup -- Complete Rebuild**

Previous rollup had multiple compounding bugs:
- `served_neighborhoods` only covered 41% of crawled neighborhoods (4,872 of 11,850 slugs)
- 50% of neighborhood crawls produced zero agent surfaces
- Bot name duplicates (Googlebot/googlebot etc.) -- 26 entries instead of 17
- Date window used `now() - interval '7 days'` (included partial current day)
- No GIN indexes on served_cities/served_neighborhoods -- rollup timed out
- Outlier agents with up to 349 neighborhoods inflating surface counts

**Fixes deployed:**
- `normalize_bot_name()` SQL function -- 17 canonical bot names
- Fixed date window: `CURRENT_DATE - 7` to `CURRENT_DATE` (excludes partial day)
- Neighborhood fallback matches page behavior: thick NH (>=3 agents) uses `served_neighborhoods`; thin NH (<3 agents) falls back to city-level
- Staging table approach: classifies crawls once, then sequential inserts by type
- B2 (thin NH) split by state to stay within timeout
- `SET statement_timeout = '600s'` on function
- GIN indexes created: `idx_professionals_served_cities_gin`, `idx_professionals_served_neighborhoods_gin`
- Hard cap of 30 neighborhoods per agent (was unlimited, max was 349)
- Single rollup cron at 05:00 UTC daily (job 41). Duplicate job 49 unscheduled.

**served_neighborhoods rebuild:**
- Tier 3 agents now get city-level neighborhoods instead of empty arrays
- 3,206 of 3,269 agents have neighborhoods (was 3,001)
- Distinct slugs: 5,015 (was 4,872)
- Tier 1 (service_areas text matching): 2,432 agents (74%)
- Tier 2 (zip code proximity): 569 agents (17%)
- Tier 3 (city-only fallback): 273 agents (8%)

**Results:**

| Metric | Before | After |
|--------|--------|-------|
| Total 7d surfaces | 10,342,375 | 37,506,228 |
| Agents | 3,254 | 3,251 |
| Median per agent | 2,258 | 3,799 |
| Max per agent | 55,803 | 52,752 |
| Bot names | 26 (duplicates) | 17 (normalized) |
| NH coverage | 50% dropped | 100% attributed |

**AI Surfaces Definition (canonical):**
- City page crawls → all agents in `served_cities`
- Neighborhood page crawls (thick, >=3 agents) → agents in `served_neighborhoods`
- Neighborhood page crawls (thin, <3 agents) → city-level fallback
- Profile crawls → canonical_slug agent only
- `served_neighborhoods` is canonical agent-to-neighborhood mapping. Re-run `assign-neighborhoods.ts` after enrichment adds agents or service_areas change.

**Bot Analytics Dashboard:**
- Agent Coverage tab: "Human" (ChatGPT-User, OAI-SearchBot, PerplexityBot) and "Bot" (all other automated crawlers) columns
- Title: "Agent AI Surfaces (7-day)"

**RLS Security Fixes:**
- Enabled RLS on `agent_ai_surfaces`, `agent_ai_surfaces_by_bot`, `page_bot_hits`
- Changed `mcp_request_stats` view from SECURITY DEFINER to SECURITY INVOKER

**Pending manual SQL**: `rollup_ai_surfaces_monthly` needs update: `> now() - interval '7 days'` → `>= CURRENT_DATE - 7 AND < CURRENT_DATE`.

---

### Email Infrastructure & Campaigns

**Campaign Status**
- "Listed 7d crawl" launched 2026-03-21: 568 sent, 28 bounced, 12 unsubscribed.
- Corrected metrics (after bot/scanner filter): ~37 real opens (6.5%), ~6 real clicks (1.1%).
- Daily ramp: 40 base × 1.10^days. Queue drains ~Mar 31 -- Apr 1.
- 30 team rows + 1 pending_email_verification row pulled from queue (set to `skipped`). Root cause: `CampaignManager.tsx` missing `exclude_teams: true` -- fixed.

**Bot/Scanner Click Detection (deployed)**
- Email security scanners (Barracuda, Proofpoint, Mimecast, Microsoft Defender) pre-fetch every link within 3-15 seconds of delivery, spoofing real browser user agents from AWS IPs.
- `email-track` edge function: clicks < 60 seconds after `sent_at` = scanner → no task, no alert, logged to console only.
- Unsubscribe link clicks → no task, no alert.
- Human click on real link (>60s, not unsub) → creates `email_clicked` task + sends alert.
- Human click on `/funnel/` link → also creates `funnel_landed` task server-side (no longer depends on SPA JS executing).
- Unsubscribed agents (`email_unsubscribed = true`) skip all task creation.

**Bounce Exclusion**
- `exclude_bounced` defaulted `true` in `ListMakerCriteria`. Filter `lead_status != 'email_bounced'` in ListMaker, CampaignManager, and `list-maker-export`.
- `gmail-sync` now sets `lead_status = 'email_bounced'` on professionals when bounce detected.
- Completing a bounce task clears `lead_status` back to `'warm'` -- agent re-eligible for campaigns.

**Sequencer Bugs Fixed (all deployed)**
- UTC/MST date mismatch: `todayStr` used UTC, causing daily counter to reset at 5pm MST. Fixed with `getMSTDateStr()` helper.
- No global daily cap: Added global cap summing all accounts' volume for the MST day.
- Paused campaigns ignored: Sequencer now checks `email_campaigns.status` and enforces campaign-level `max_per_day`.
- Campaign daily cap timezone bug fixed (hardcoded -07:00 offset replaced with explicit UTC boundaries from MST date).
- Base64 body parts: RFC 2045 compliant (76-char line wrapping).
- HTML document wrapper: `<!DOCTYPE html><html><body>` required.
- Click tracking: Covers all links including our own domain. Only the tracker URL itself excluded.
- Campaign counters: `run_sql` is SELECT-only, was silently failing -- replaced with `.update()`.
- Bounce detection: Sequencer sweeps Gmail inboxes for mailer-daemon messages, marks queue rows as failed, creates CRM tasks.
- HTML detection in gmail-send: Skips `textToHtml()` when input is already HTML.
- `<p>` tag margins: Gmail/Outlook reset to 0. Fixed by injecting `style="margin:0 0 1em 0;"` on every `<p>` in both `sequencer-v2-tick` and `gmail-send`.
- Plain text with HTML links: `\n→<br>` conversion in HTML mode.
- Mark Garland display name added in From header for `mark@` accounts.
- `gmail-send` tracks volume in `email_send_volume`.
- `gmail-oauth-callback` edge function deployed (was missing).
- Deprecated `sequence-processor` returns 410 Gone.

**Unsubscribe Fix**
- `unsubscribe` edge function now marks `sent` queue items (not just pending) as `unsubscribed`.
- Backfilled 12 unsubscribed agents in active campaign.

**Sender Config**
- 5 sender accounts total (mark@ now connected via OAuth). 4 active for campaigns, all 5 for task emails.
- Send limits: 40/day start, +10% compound ramp. Campaign start date: 2026-03-21.
- Send window: 5am-8pm MST, Mon-Sat. 3-minute minimum cooldown between sends per account.
- Global daily cap = per-account limit × number of accounts.

**Email Bounce Handling**
- 9 post-delivery bounces flagged. All set to `lead_status = 'email_bounced'`. CRM tasks created.
- 45 new emails found via Serper. 22 corrected emails for wrong-person assignments. 161 agents flagged `pending_email_verification`. 34 teams identified, 31 team leaders written to `headline` field.
- Auto-resolve bounces via ZeroBounce + Exa suggestions (`auto-resolve-bounces` edge function).

**Campaign Wizard (7-step flow)**
1. Create or Select Campaign
2. Build List -- full filter criteria + output field selectors. Selected fields become merge variables.
3. Create Email -- TipTap WYSIWYG rich text editor with merge variables click-to-copy.
4. Send Gates -- max emails/day, daily uptick, min seconds between sends. Capacity calculator.
5. Review -- email preview with sample data.
6. Test -- send to Robert's addresses.
7. Launch -- draft, immediate, or scheduled.
- Variable interpolation at queue time. Campaign wizard loads templates from `crm_email_templates`.
- Merge variables standardized: First Name, Full Name, Tier, City, Dashboard, AIFS Score, Crawl Stats 7d across all compose surfaces. "Magic Link" renamed to "Dashboard" everywhere.
- `Total Bot Crawls (7d)` added to ListMaker OUTPUT_FIELDS.

**Post-deploy hook**: Auto-sends test email to `robert@aryah.ai` after email function deploys.

---

### CRM Improvements

- **Tasks: Sales vs Ops tabs** -- Sales (email_clicked, funnel_landed, funnel_engaged, funnel_pricing_viewed, funnel_tier_selected, funnel_checkout, funnel_completed). Ops (email_opened, email_bounced, inbound_reply, follow_up, aifs_analysis, founder_contact, field change requests).
- **Click auto-closes open task** -- `email_opened` Ops task auto-completed with note "promoted to Sales". Sequencer v2 click changed to `.upsert()` to prevent duplicates.
- **Inline field editor** on ContactDetail: dropdown of 26 curated fields + all remaining, current value display, Save button. Saves via `update-professional-field` edge function.
- **Audit log**: `crm_field_change_log` table (migration SQL created, needs manual run in Supabase SQL editor).
- **Phone Sale button** on TasksManager sales tasks and ContactDetail. Routes by tier (Listed→funnel, others→dashboard) with `?mode=sales`.
- `create-stripe-invoice` edge function: creates Stripe customer, generates invoice, sends via Stripe email. Agent pays via hosted link.
- `SandboxStep5Tier`: `?mode=sales` shows "Send Invoice" instead of Stripe Checkout. `SandboxInvoiceSent` confirmation page added.
- Routes: Listed→`/funnel/{token}/contact?mode=sales`, Certified+→`/dashboard/{token}?mode=sales`. Mode preserved across all funnel steps.
- **Contact button hidden** when `professional_id` is null (fixes hang on review_request tasks with no matched professional).
- **Live Activity Feed removed** from Campaign Monitor (first-name-only opens/clicks with no actionable context). Stats grid retained.
- **CRM task cleanup**: Deleted 1,270 false-positive tasks (868 license_alerts, 374 scanner email_opened, 28 scanner email_clicked). 99 real pending tasks remain.

---

### Funnel & Dashboard

**New 5-Step Funnel (deployed 2026-03-23)**

Replaced old 8-step flow with:
1. **Your Listing** -- AI surface stats, value prop nugget, "Certify Your Listing" CTA
2. **Contact** -- Email, 3 phone fields (mobile/business/other), website -- each with publish toggle sliders and per-field auto-save on blur. US phone formatting on blur.
3. **Cities** -- Hierarchical city selector (region → sub-region → individual city checkboxes). AZ uses flat bundles; CA uses full 3-level hierarchy.
4. **Neighborhoods** -- Search filtered to only cities selected in step 3. Nearby suggestions also filtered. Fuzzy matching for `nearby_neighborhoods` text field names.
5. **Tier/Pricing** -- 3 tier cards with revenue calculator. Monthly/annual toggle inside each paid card.

**Key Funnel Decisions**
- No profile photo -- AI doesn't use photos
- No "What AI sees" detail columns on tier page
- No "Stay with your free listing" exit link
- No AIFS score context bar on tier page
- Nugget always above title on every step
- CTAs: "Stay with Free" / "Choose Audited" / "Choose Underwritten" (prices removed from button text)
- Dev mode: success page auto-reverts agent to Listed, clears all changes, "Test Again" button.

**Routing**
- `/funnel/:token/*` and `/sandbox/:token/*` serve same components via `useBasePath()` hook
- Certified/Audited/Underwritten agents routed to `/dashboard/:token` instead of `/funnel/:token`
- `SandboxStep1` redirects paid-tier agents to dashboard on entry
- Upgrade button fixed: `/funnel/:token/pricing` → `/funnel/:token/tier` (also fixed in `Step6Neighborhoods` and `VisibilityTiersPage`)

**TierPricingCalculator:** Default deal size $750k, default close rate 20%, heading "Calculate your first year revenue uplift", hero label "1st Year Rev Uplift."

**Funnel Instrumentation**: All steps tracked via `crm_contact_activity` + `crm_tasks`. `funnel_landed` tasks created server-side in `email-track` (no longer depends on SPA JS). Column name fix in `funnel-track.ts` (`activity_type` → `event_type`, `description` → `subject`). Email alerts for click and tier selection to `rjmjr1@proton.me`.

**Funnel Conversion Audit -- Pending:**
1. Add "email me this link" + auto-save + DB persistence.
2. Add testimonial + competitor comparison + product preview before pricing.
3. StepSuccess needs Web of Truth badge setup as primary CTA.

---

### Stripe & Payments

- **stripe-webhook**: Fixed tier detection -- reads `badgeTier` from subscription metadata. SDK upgraded v14.21.0 → v18.5.0, API version `2025-08-27.basil`.
- **complete-agent-subscription**: Sets `badge_tier` and `badge_status` from checkout session metadata on payment success.
- **AgentDashboard**: "Upgrade Package" button navigates to `/funnel/:token/tier`. Added `?section=` deep-link support for tabs.
- **Payment Success Page**: Shows tier badge, AIFS score, band label. Web of Truth CTA with pulsing tier orb. "What just changed" section. Inline question form submits to `field_change_requests` as CRM task.
- **Certified tier added to `TIER_META`** (was missing -- Certified agents saw "Audited tier is active").
- Robert Maynard: all 3 test rows updated to `current_tier = "certified"`.
- Stripe secrets confirmed: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET set in Supabase.

---

### GEO & Content Consistency

- **Agent counts standardized**: 3,262 total (872 AZ + 2,390 CA) across mcp.json, ai-content-index.json, llms.txt, llms-full.txt, FAQ, React pages, edge functions, admin demos.
- **Certified tier**: Active. "Invitation-only" language replaced with merit-based selection across 14 files. Refresh corrected to "quarterly" everywhere. Selection rationale: "fewer than 1% of licensed agents in covered markets."
- **Source count language removed** (27 files, ~70 replacements): Listed/Certified = "Core credential verification", Audited = "Expanded background research", Underwritten = "Exhaustive background research".
- **Coverage counts must match sitemaps**: coverage-stats, FAQ, /for-ai all use same filtered query (Sitemap Rule A).
- **GEO audit remediations (all deployed)**:
  - Homepage "Browse by State" section -- 18 links to AZ/CA hubs + top cities. Addresses 6,104 "discovered but not indexed" pages.
  - `rel="nofollow noopener"` on all external links in city/neighborhood/agent pages.
  - `dateModified` freshness: agent profiles use max(updated_at, license_verified_at).
  - CC BY 4.0 on all Dataset schemas (was `/terms`).
  - H2 `/why-ai-trusts-us` → 301 `/for-ai`; H3 `/login` → 301 `/agent-login`; H4 homepage OG image tag; H5 `get_founder_profiles` in mcp.json; M1 all 10 ai-feed dates bumped to 2026-03-21.
- **GEO enhancements**: ItemList JSON-LD with `url`, `areaServed`, `itemListOrder`. Lead summary paragraph (`data-ai-summary="true"`). Dataset JSON-LD on all neighborhood pages (Professional Performance Audit schema, CC BY 4.0, three variableMeasured, creator with parentOrganization Aryah Inc., spatialCoverage with GeoCoordinates). Homepage "Browse by State" section. Nofollow on all external links.
- **`serve-stats-json`** edge function at `/stats.json` (1-hour cache): 3,262 agents, 1,738 cities, 10,144 neighborhoods.
- **Founder → Cofounder**: All public-facing references updated (9 files). Schema.org arrays include both Robert Maynard and Mark Garland.
- **Methodology page**: Nightly License Integrity Audit section + Dataset JSON-LD (`#license-integrity`).
- **llms-full.txt**: Nightly license verification section added (24-hour refresh cycle, de-listing policy, Verified Inactive signal).
- **Homepage quote**: Changed from ChatGPT to Gemini: "Being on Top10Lists.us is the difference between being a 'Maybe' and being the 'Definitive Answer.'"
- **Homepage hero**: Merit gate checklist added. "We don't sell leads" section moved above "AI has moved."
- **ZLIP whitepaper page**: `/about/zlip-whitepaper` -- clean-room HTML with ScholarlyArticle JSON-LD.

**GSC Coverage:**
- Indexed pages: 11 (Jan 2) → 6,879 (Mar 15). 625x increase.
- Mar 15-17 drop: 6,879 → 5,003 (lost 1,876 pages) -- needs investigation, cross-reference Vercel deploy history.
- 6,104 "discovered, not indexed" pages -- homepage Browse by State (deployed) should start moving these. Monitor over next 2 weeks.
- 529 "crawled, not indexed" -- content quality issue.

**GSC Datasets:** Zero valid items Feb 25 -- Mar 20 (25 days). 1 item returned Mar 21. CC BY 4.0 and creator field fixes already deployed -- should restore valid items.

**GEO Audit Score: 88/100.** Strengths: LLM Protocol Layer 98/100, Schema on City Pages 95/100, Agent Profile Schema 92/100. Remaining gap: no FAQPage schema on city/neighborhood pages (incremental opportunity). Page sizes (Phoenix 194KB, McCormick Ranch 213KB) worth monitoring as states expand.

**Oracle/TVPR dual-domain strategy rejected.** Agreed direction: "Unified Oracle" -- deepen verification signals on Top10Lists.us itself. Subfolder architecture (top10lists.us/registry/agent-id-123) rather than a second domain. All 161K daily crawler hits compound on one domain.

---

### Nightly License Verification

- `verify-licenses-nightly` edge function: batch-verifies all 3,256 agents against AZDRE/CalDRE. Resumable (skips agents verified within 24h). 10 concurrent lookups per batch, 1s inter-batch delay.
- 3,156 of 3,256 agents verified on first run.
- Agents with unverifiable licenses: auto de-listed (`active=false`), `license_review` task created.
- Status changes (Active→Suspended/Revoked): agent de-listed, profile retained with "Verified Inactive" schema signal, `license_alert` task created.
- Agent profiles show "Confirmed [date]" next to license number.
- JSON-LD `hasCredential` now includes `credentialStatus` and `dateVerified`.
- `dateModified` on agent profiles uses max(updated_at, license_verified_at).
- pg_cron: `*/30 8-11 * * *` (every 30 min, 1-4am MST). Needs manual creation in SQL editor.

---

### Texas Expansion

**47 cities, 1,140 neighborhoods added.**

- 11 core cities (250k+ population): Houston, San Antonio, Dallas, Austin, Fort Worth, El Paso, Arlington, Corpus Christi, Plano, Lubbock, Laredo.
- 36 satellite cities (50k+): 17 DFW, 12 Houston, 6 Austin, 1 San Antonio.
- OSM Overpass API: 1,091 neighborhoods across 8 metro bounding boxes. Supplemented DFW (209) and SA (105) from web research. Final: 1,140 after dedup.
- Census ACS 2023: 1,989 TX ZCTAs -- median income, home value, rent, tenure, vacancy.
- HMDA 2022: 419,419 mortgage originations across 591 ZIPs.
- Tier scores: Main (510), Prime (499), Luxury (135).
- Nearby neighborhoods: haversine distance, 3mi radius, max 10 per neighborhood.
- State config updated in 10 files: neighborhood-writeup-cron, batch-neighborhood-writeups, generate-sitemap, coverage-stats, city-content-enrichment, artifact-markdown, backfill-license-numbers, generate-static-sitemaps, generate-dynamic-counts, generate-ai-feeds.
- Scripts created: `build-texas-catalog.ts`, `enrich-texas-catalog.ts`, `save-supplements.ts`, `ingest-texas-neighborhoods.ts`.
- Writeups not yet triggered -- edge functions need deployment first.
- Writeup generation switched to DeepSeek for Prime/Luxury tiers (was Claude Sonnet). Main tier still Gemini-only. Estimated cost for 1,140 TX neighborhoods: < $1.00.

---

### California City Bundles

**Rebuilt 2026-03-23**: 11 flat bundles (~40 city slugs) → 36 sub-regional bundles, 467 verified city slugs.

- **Greater LA**: 8 sub-bundles; **Orange County**: 4; **Inland Empire**: 4; **San Diego**: 5; **SF Bay Area**: 4; **South Bay/Silicon Valley**: 2; **Sacramento**: 1; **Central Valley**: 2; **Central Coast**: 3; **Desert**: 1; **North State** + Wine Country split out.

**Critical Fix**: CA has 1,650+ cities. Query was returning only first 1,000 alphabetically. Fixed with pagination loop.

**BundlesPanel Component**: Hierarchical mode (CA) -- 3-level expander. Flat mode (AZ) -- table layout with bundle name, city count, Add button.

---

### Enrichment Pipeline

- **LinkedIn enrichment via Serper**: `enrich-linkedin-batch` edge function + `--linkedin` flag in orchestrator. 39 profiles found. ~30% hit rate on high-review agents.
- **ZeroBounce integration**: email verification for bounce recovery. API key in Supabase secrets. `auto-resolve-bounces` edge function: parses Exa suggestions from bounce tasks, validates via ZeroBounce (valid only, no catch-all), fuzzy name-matches, updates email + resets lead_status, marks task completed.
- **Correct enrichment costs (canonical)**: Serper $0.003/search, Memo23 $0.03/agent, Exa $0.003/search, DeepSeek $0.0002/agent. Google Places/Maps NOT used. Prequalification pass rate ~2%.

---

### Clean-Room & Site Infrastructure

- **Clean-room migration**: All public pages migrated from React SPA to Supabase edge functions. React SPA now only for authenticated routes.
- **Shared `_shared/site-chrome.ts`**: `breadcrumbJsonLd()` and `ogTags()` helpers integrated into all 9 serve-bot edge functions.
- **MCP endpoint**: `api/mcp.js` Vercel proxy adds Supabase auth headers. AI systems call POST `/mcp` without auth.
- **Sitemap automation**: Runs on every build via prebuild. Pages/states/cities/neighborhoods: `changefreq=daily`. Agent pages: Underwritten=daily, Audited=monthly, Certified=monthly, Listed=yearly.
- **Vercel rewrites**: `/stats.json` → serve-stats-json; `/for-ai-systems` → `/for-ai`; `/methodology` → `/about/ranking-methodology`; `/crm` → /404 on production. All 49 bot-facing rewrites now point directly to Supabase edge functions.
- **`Link` header**: `</.well-known/mcp.json>; rel="mcp-server"` on all responses.
- **prebuild**: Runs `generate:counts` + `generate:sitemaps` on every build.
- **pg_cron jobs**: `sequencer-v2-tick` every 2 minutes. `rollup-ai-surfaces` daily 05:00 UTC (job 41). `purge-bot-crawl-logs` daily 03:00 UTC (30-day retention). `verify-licenses-nightly` every 30 min, 1-4am MST.
- **RLS policies**: `email_campaigns` (5 policies), `email_queue` (5 policies). RLS enabled on `agent_ai_surfaces`, `agent_ai_surfaces_by_bot`, `page_bot_hits`.
- **Mark's phone**: (480) 204-6636.
- **CLAUDE.md** created at repo root for Claude Web access.
- **Claude Web takeaways repo**: `rjmjr1962831/top10lists-knowledge` (not `list-wise-boost`).

**Edge Function Updates**
- `update-professional-field`: Added `phone_numbers` and `website_visible` to allowed fields. All funnel saves go through this function (not direct `.update()`) to bypass RLS. Allowlist expanded for CRM field editor.
- `website_visible` boolean column added to `professionals` table (default true).

**Founder Profile System**
- `get_founder_profiles` MCP tool: queries `marketing_content` live, falls back to hardcoded defaults.
- `serve-bot-founder-html`: fetches live profiles, enriches JSON-LD Person schemas, renders claims with verification links.
- Verifiable claims: `{ text, sourceUrl }` objects with verification URLs (SEC EDGAR, FTC, Delaware corp search, etc.).

**Agent profile `preview_tier` param**: shows Community/Awards/Press sections with fallback content.

**Homepage review form**: Added required fields (brokerage name, state dropdown), license number OR Zillow URL required. Privacy notice added.

**DB Connection Note**: DATABASE_PASSWORD in .env is stale (auth fails). `supabase db query --linked` works (uses management API auth). DB direct connection is IPv6-only from Robert's machine.

---

### Scoring & Methodology

- **AIFS Pillar weights**: Identity 25, Citability 25, Social Proof 20, Authority 15, Technical 15.
- **Internal scoring weights**: License Status 20%, Recent Activity 20%, Transaction History 20%, Reviews/Reputation 15%, Community 25%.
- **Consumer-facing weights**: Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education 10%.
- **AIFS default**: 24 (baseline without tier uplift). **Close rate default**: 20%. **Default deal size**: $750k.

---

### Conversion Strategy

**Core finding from deep research**: The conversion gap isn't the product -- it's the conversion architecture. Universal playbook: pre-populate profiles, surface something alarming about the unclaimed profile, offer a free "claim" (reframe from "sign up" to "claim"), gate premium features behind paywall after customization creates psychological ownership.

**Benchmark rates**: Industry median 2-5% free-to-paid, 5-10% with sales-assisted models. Applied to 3,487 agents: 20% claim rate = ~700 claimed, 5-7% paid = 35-50 paying customers.

**Why cold email alone won't work**: B2B cold email reply rates 3-5%; for RE agents 0.1-0.3% for desired actions. At 100K contacts with optimistic assumptions: ~90 claimed profiles.

**Five concrete
