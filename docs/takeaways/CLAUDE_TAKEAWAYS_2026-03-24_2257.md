# Claude Code Takeaways — 2026-03-24

## CRITICAL: No Caching Anywhere in the Stack

**The Vercel proxy (`api/serve-clean-html.js`) has been permanently deleted.** There is NO caching layer of any kind in the bot-facing request path:

- **No Vercel CDN caching** — `Cache-Control: public, max-age=0, must-revalidate` on all bot pages. `s-maxage=60` removed.
- **No `rendered_pages` DB cache** — the cache was disabled earlier, then the entire proxy that used it was deleted.
- **No Cloudflare caching** — Cloudflare was deprecated months ago.
- **No KV cache, no Prerender.io, no Worker cache** — all deprecated.

**Current architecture (final):**
```
Bot request → Vercel CDN (pass-through, no cache) → Supabase edge function → logBotVisit() → Response
```

Every single bot request hits the Supabase edge function directly. Every single request is logged. There is no intermediate layer that can break logging. This is a permanent architectural decision — do not re-introduce caching without Robert's express approval.

**Why:** The `rendered_pages` cache caused the March 24 crawl logging incident (98% drop). The Vercel proxy was a single point of failure. Sub-1-second edge function response times make caching unnecessary.

---

## Sequencer & Campaign Fixes

### Campaign Sequencer Limit Bypass (3 bugs fixed)
1. **Campaign daily cap timezone bug**: hardcoded `-07:00` offset in `sent_at` filter miscounted emails. Fixed with explicit UTC boundaries from MST date.
2. **`gmail-send` had zero volume tracking**: ad-hoc CRM sends weren't counted against daily limits. Now increments `email_send_volume` after every send.
3. **Deprecated `sequence-processor` hard-killed**: returns HTTP 410 Gone. Old formula (`25 + 5/day`) can never accidentally run.

### Email Line Breaks Fix
- **TipTap HTML (`<p>` tags)**: Gmail/Outlook reset paragraph margins to 0. Fixed by injecting `style="margin:0 0 1em 0;"` on every `<p>` tag in both `sequencer-v2-tick` and `gmail-send`.
- **Plain text templates with HTML links**: when `isHtml=true` (template contains any `<a>` tag), `textToHtml()` was skipped, leaving `\n` as collapsible HTML whitespace. Fixed by explicitly converting `\n→<br>` in HTML mode.

### Test Resend Campaign
- Deleted "Test Resend 2026-03-21" campaign and 3 queue rows from DB.

---

## CRM & Sales

### Tasks: Sales vs Ops Separation
- **Sales tab**: email_clicked, funnel_landed, funnel_engaged, funnel_pricing_viewed, funnel_tier_selected, funnel_checkout, funnel_completed
- **Ops tab**: email_opened, email_bounced, inbound_reply, follow_up, aifs_analysis, founder_contact, field change requests
- Each tab shows pending count. Pending/All filter works within each tab.

### Click Auto-Closes Open Task
- When agent clicks a link, the `email_opened` task in Ops is auto-completed with note "promoted to Sales". No duplicate tasks across tabs.
- Changed sequencer v2 click from `.insert()` to `.upsert()` to prevent duplicate click tasks.

### Phone Sales Flow (new)
- **`create-stripe-invoice` edge function**: creates Stripe customer, generates invoice, sends via Stripe email. Agent pays later via hosted link. Seller never touches card info.
- **`SandboxInvoiceSent` page**: confirmation with agent name, tier, amount.
- **`SandboxStep5Tier`**: when `?mode=sales`, shows "Send Invoice" button instead of Stripe Checkout.
- **TasksManager + ContactDetail**: "Phone Sale" button routes by tier (Listed→funnel, others→dashboard) with `?mode=sales`.
- Mode preserved across all funnel steps.

### CRM Field Editor
- Collapsible "Edit Fields" section on ContactDetail: dropdown of 26 curated fields + all remaining, current value display, Save button.
- Saves via `update-professional-field` edge function (allowlist expanded).
- **Audit log**: `crm_field_change_log` table (migration SQL created, needs manual run in Supabase SQL editor) records professional_id, field_name, old/new values, changed_by, changed_at.

### Merge Variables Standardized
All 4 email compose surfaces now show: First Name, Full Name, Tier, City, Dashboard, AIFS Score, Crawl Stats 7d. "Magic Link" renamed to "Dashboard" everywhere.

### Campaign Wizard Templates
- Campaign wizard now loads from `crm_email_templates` (EmailManager templates) in addition to `crm_sequence_steps` (old sequencer).

### Auto-Resolve Bounces
- **`auto-resolve-bounces` edge function**: parses Exa suggestions from bounce tasks, validates via ZeroBounce API (valid only, no catch-all), fuzzy name-matches, updates email + resets lead_status, marks task completed.
- ZeroBounce API key set as Supabase secret.

---

## Funnel & Routing Fixes

### Certified Agent Funnel Routing
- **`list-maker-export`**: now routes Certified/Audited/Underwritten to `/dashboard/:token` instead of `/funnel/:token`.
- **`SandboxStep1`**: redirects paid-tier agents to dashboard on entry.
- **Robert Maynard**: `current_tier` updated from "listed" to "certified" for all 3 test rows.

### Upgrade Button Fix
- `AgentDashboard` navigated to `/funnel/:token/pricing` which doesn't exist. Fixed to `/funnel/:token/tier`. Also fixed in `Step6Neighborhoods` and `VisibilityTiersPage`.

### Campaign Wizard Sample Data
- `SAMPLE_DATA` `magic_link` changed from `/funnel/sample-token` to `/dashboard/sample-token`.

### Nearby Neighborhoods Fuzzy Matching
- `nearby_neighborhoods` text field names didn't match DB records (slashes vs spaces, abbreviated vs full). Changed to fuzzy matching with normalized string comparison.

### Live Activity Feed Removed
- Removed useless "Live Activity" feed from Campaign Monitor (first-name-only opens/clicks with no actionable context). Stats grid retained.

---

## GEO & Schema Enhancements

### Dataset JSON-LD on Neighborhood Pages
- Every neighborhood page now has a `<script type="application/ld+json">` Dataset schema block.
- Dynamically populated from `neighborhood_catalog` (name, city, state, lat/lon).
- Includes: spatialCoverage with GeoCoordinates, CC BY 4.0 license, three variableMeasured (Professional Qualification Rate, State Licensing Integrity, AI Discovery Surface Frequency), creator with parentOrganization Aryah Inc.
- City pages unaffected.

### Nightly License Verification
- **`verify-licenses-nightly` edge function**: batch-verifies all agent licenses against AZDRE/CalDRE. Resumable (skips agents verified within 24h). 10 concurrent lookups, 1s inter-batch delay.
- Agents with unverifiable licenses: auto de-listed (`active=false`), `license_review` task created.
- Status changes (Active→Suspended/Revoked/Inactive): agent de-listed, profile retained with "Verified Inactive" schema signal, `license_alert` task created.
- **3,156 of 3,256 agents verified** on first run.
- pg_cron job needs manual creation (SQL provided to Robert).

### Agent Profile Schema Updates
- `hasCredential` JSON-LD now includes `credentialStatus` ("Active" or "Verified Suspended" etc.) and `dateVerified` timestamp.
- "Confirmed [date]" displayed next to license number on bot agent profiles and artifact pages.
- `dateModified` on agent profiles now uses max(updated_at, license_verified_at).

### Methodology Page
- Added "Nightly License Integrity Audit" section with 4-step process description.
- Added Dataset JSON-LD (`#license-integrity`) with measurement technique and verification recency signal.

### GEO Audit Fixes (4 items)
1. **Homepage links**: "Browse by State" section with 18 links to AZ/CA hubs + top cities. Addresses 6,104 "discovered but not indexed" pages.
2. **Nofollow**: `rel="nofollow noopener"` on all external links in city/neighborhood/agent pages. Stops passing PageRank to Zillow.
3. **dateModified freshness**: agent profiles use most recent of updated_at or license_verified_at.
4. **CC BY 4.0**: all Dataset schemas swapped from `/terms` to standard Creative Commons URL.

### llms-full.txt Updates
- Added "Nightly License Verification" section documenting 24-hour refresh cycle, de-listing policy, and Verified Inactive signal.

### Homepage Quote
- Changed from ChatGPT quote to Gemini quote: "Being on Top10Lists.us is the difference between being a 'Maybe' and being the 'Definitive Answer.'"

---

## Bot Crawl Logging — Architecture Change

### Proxy Eliminated
- **`api/serve-clean-html.js` deleted permanently.** All 49 Vercel rewrites now point directly to Supabase edge functions.
- Pattern: `/api/serve-clean-html?fn=FUNCTION&path=PATH` → `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/FUNCTION?path=PATH`

### logBotVisit Activated
- All 6 serve-bot edge functions now call `logBotVisit()` (was imported but never called — dead code since creation).
- Fire-and-forget, no latency impact.
- Agent profile pages pass `agent_id` for correct AI surfaces attribution.
- `_shared/log-bot-visit.ts` has 28 bot patterns, `x-forwarded-user-agent` support, proper bot name detection.

### CDN Cache Headers
- Removed `s-maxage=60` on bot pages. Now `max-age=0, must-revalidate`. No CDN caching.

### Rollup Fix (pending)
- `rollup_ai_surfaces_monthly` needs update to use `CURRENT_DATE - 7` to `CURRENT_DATE` (exclude partial current day). SQL provided to Robert for Supabase SQL editor.

---

## Enrichment Pipeline

### LinkedIn Enrichment via Serper
- **`enrich-linkedin-batch` edge function**: searches Serper for LinkedIn profiles, validates by first+last name in URL slug (strong match only), writes `social_linkedin`.
- Added `--linkedin` flag to `run-enrichment-parallel.ts` orchestrator.
- **Results**: 39 LinkedIn profiles found across ~3,500 agents (26 from first targeted run, 13 from full batch). ~30% hit rate on high-review agents, near 0% on long tail.
- Cost: $0.003/search via Serper.

### ZeroBounce Integration
- API key stored as Supabase secret.
- Used for email verification of Exa bounce suggestions.
- 8 agents updated with verified replacement emails from first manual run.

---

## Data Updates

### Agent Email Corrections
- 8 bounced agent emails replaced with ZeroBounce-verified addresses from Exa suggestions.
- 13 more auto-resolved via `auto-resolve-bounces` function (some need manual review — name matching too loose on a few).

### Robert Maynard Tier
- All 3 Robert Maynard rows updated: `current_tier` = "certified" (was "listed" while `badge_tier` was "certified").

---

## Pending Manual Actions (Supabase SQL Editor)

### 1. Create audit log table
```sql
CREATE TABLE IF NOT EXISTS crm_field_change_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id uuid REFERENCES professionals(id),
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by text DEFAULT 'crm_agent',
  changed_at timestamptz DEFAULT now()
);
CREATE INDEX idx_field_change_log_professional ON crm_field_change_log(professional_id);
CREATE INDEX idx_field_change_log_date ON crm_field_change_log(changed_at);
ALTER TABLE crm_field_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON crm_field_change_log FOR ALL USING (true) WITH CHECK (true);
```

### 2. Schedule nightly license verification cron
```sql
SELECT cron.schedule(
  'verify-licenses-nightly',
  '*/30 8-11 * * *',
  $$SELECT net.http_post(url:='https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/verify-licenses-nightly',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||current_setting('app.settings.service_role_key')),body:='{}'::jsonb);$$
);
```

### 3. Fix rollup to exclude partial day
```sql
-- Replace all 3 instances of:
--   WHERE bcl.crawled_at > now() - interval '7 days'
-- With:
--   WHERE bcl.crawled_at >= CURRENT_DATE - 7 AND bcl.crawled_at < CURRENT_DATE
-- Full function replacement SQL provided in earlier session output.
```

---

## Standing Rules Reinforced

- **NO CACHING on bot-facing pages.** Not rendered_pages, not CDN, not KV, not anything. Edge functions respond in <1s. Caching breaks logging.
- **NO PUSH without Robert's permission.**
- **The Vercel proxy is dead.** Do not recreate `api/serve-clean-html.js`. All rewrites go direct to Supabase.
- **logBotVisit must be called in every serve-bot function.** If a new serve-bot function is created, it must call `logBotVisit()` before returning.
