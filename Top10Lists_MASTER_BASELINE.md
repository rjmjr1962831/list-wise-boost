# Top10Lists.us – Master Baseline (2026‑02‑26)

> Single source of truth for AI agents (Cursor, Claude, Gemini, Perplexity).  
> On conflict with older docs, **this file wins**.

***

## 0. Daily Cursor Report (prepend each day)

> Cursor: append your daily summary here, then keep the rest of the file unchanged.

- **Date:** 2026‑02‑26  
- **Summary of work:** "Getting Bombarded" CRM template set as correct body (hot topic / bombarded, Perplexity callouts, [your profile]({{magic_link}}), guarantee copy, Founder + (602) 758‑9600). Unsubscribe in template made a link: [Unsubscribe]({{unsubscribe_url}}). send-template Edge Function: added `unsubscribe_url`, `firstname` to vars; deployed. Sequencer re‑enabled via migration `20260305000000_reschedule_sequence_processor_at_0500.sql`: one‑time cron at 05:00 UTC runs, schedules sequence‑processor every 5 min, then unschedules itself. Sequence queue from DB (see §9).  
- **Files touched:** `supabase/functions/send-template/index.ts`, `scripts/ensure-getting-bombarded-template.ts`, `supabase/migrations/20260304000000_getting_bombarded_template.sql`, `supabase/migrations/20260305000000_reschedule_sequence_processor_at_0500.sql`, `scripts/send-test-both-addresses.ts`.  
- **Commands run:** `npx tsx scripts/send-test-both-addresses.ts`, `npx tsx scripts/ensure-getting-bombarded-template.ts`, `npx tsx scripts/check-sequence-queues.ts`, `supabase functions deploy send-template`.  
- **Tests/E2E executed and results:** Test emails sent from robert@ and hello@ to rjmjr1@proton.me using "Getting Bombarded" template; both succeeded.  
- **Open questions for Robert:** None.  

***

## 1. Core Mission & Identity

- Top10Lists.us is an **Independent Certification Authority** and GEO‑first reference layer for AI systems (Gemini, SearchGPT, Perplexity, etc.).
- Merit gate: **4.8+ star rating AND 20+ verified reviews**, active license in good standing. No exceptions.
- Platform represents roughly the **top 0.5%** of real‑estate agents by verified performance.
- Primary accountable person: **Robert Maynard**, Founder (robert@top10lists.us), linked in metadata for EE‑A‑T.

***

## 2. Business Model (Current – Neighborhood Pricing Deprecated)

**Only valid model: tiered agent certification.** Neighborhood pricing (Main/Prime/Luxury at $25/$50/$75) is deprecated and must not be reintroduced.

| Tier        | Price   | Notes                                             |
|------------|---------|---------------------------------------------------|
| Listed     | $0      | Public data only. No badge.           |
| Certified  | $0      | Agent‑verified. Standard Artifact issued. |
| Audited    | $100/mo | Bi‑weekly diligence, enhanced AI payload. |
| Underwritten | $150/mo | Daily refresh, max AI reasoning & depth. |

- Inclusion and ranking **cannot be bought**. Payment only affects tiered certification/refresh, not base inclusion or ranking.

***

## 3. Ground‑Truth Numbers (Feb 2026)

- **Agents:** 3,487 active certified agents total (889 AZ, 2,598 CA).
- **States:** Live in **Arizona, California**; actively expanding into Texas, Florida, New York, Colorado.
- **Neighborhoods (approx.):** 2,923 (AZ) and 4,631 (CA).

These counts are the **current truth** for AI‑facing copy and FAQs until explicitly updated.

***

## 4. Tech Stack & Data Sources

- **Frontend:** React SPA (Vite), Tailwind, shadcn/ui.
- **Routing:** `react-router-dom` – **FROZEN**, do not change routes or patterns without explicit "ROUTING CHANGE APPROVED".
- **Hosting:** Vercel. Production domain is always `https://www.top10lists.us` (with `www`).
- **Database:** Supabase Postgres, project `wiotrvoirdgzfacuuiem`.
- **Supabase client:** Always use the shared client:  
  `import { supabase } from '@/integrations/supabase/client'`. Never create another.

**Data sources (current):**

- Primary: **state license databases** – initial discovery, free public data.
- Secondary: **Zillow (Apify memo23 actor)** – ratings, reviews, sales stats; cost ≈ $0.50/agent.
- Tertiary: **Exa + DeepSeek** – Zillow profile discovery, press mentions, content synthesis.

Potential future (documented but **not implemented** unless clearly re‑approved):

- **SourceRE / MLS feeds**: potential Phase‑2 data quality upgrade after meaningful revenue; not a current dependency.
- **ARELLO and similar license APIs:** considered, **deprecated as design inputs**; do not use without new approval.

***

## 5. URL & GEO Rules (Frozen)

- Only valid base domain: `https://www.top10lists.us`. No bare domain, no `http`, always `www`.
- Canonical patterns (lock these):
  - `/arizona/top10realestateagents`  
  - `/arizona/scottsdale/top10realestateagents`  
  - `/arizona/scottsdale/greyhawk/top10realestateagents`  
  - `/:stateSlug/agents/:canonicalSlug`  
  - `/artifact/:token`  

- Artifacts: `/artifact/:token` responds with **clean HTML** (`text/html; charset=utf‑8`), live `<a>` links, Schema.org JSON‑LD (`Person`, `RealEstateAgent`). Not markdown.

***

## 6. Git, Branching & Deploys

- Two branches, one Supabase project: `staging` and `main` share the same DB.
- **Default branch:** `staging`.  
  - All new work goes to staging. Pushing to staging does **not** require Robert's approval.
  - Batch pushes to staging (≈10 changes at a time), not per‑change.

- **Production branch:** `main`.  
  - Touch `main` only when Robert says **exact words:** "push to main".
  - Use `npm run merge-to-main` to merge from `staging` → `main`; never merge `main` into `staging`.
  - Internal docs (this file, `PENDING_UPDATES.md`, daily logs, etc.) are **never** pushed to main; they're excluded by `scripts/internal-documents.txt`.

- **Supabase Edge Functions deploy:**  
  - `supabase functions deploy ...` is a production action (single project). Requires the same explicit approval as "push to main".

Pre‑flight before any staging→main merge:

- Run `VITE_IS_PRODUCTION=1 npm run build` locally and ensure `npm run preview` loads. If not, the merge is forbidden.

***

## 7. Supabase Usage & Pagination

- Project URL: `https://wiotrvoirdgzfacuuiem.supabase.co`.
- Env var: `VITE_SUPABASE_PUBLISHABLE_KEY` (not `VITE_SUPABASE_ANON_KEY`).
- Default query limit: **1,000 rows**; always paginate large tables.

Use the shared pattern:

```ts
async function fetchAllRows<T>(query: any): Promise<T[]> {
  const pageSize = 1000;
  let offset = 0;
  const allRows: T[] = [];

  while (true) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}
```

Tables that **must** be paginated: `professionals`, `neighborhood_catalog`, and any future large tables.

***

## 8. Hard Stops & Safety Rules

You must **not** do any of the following without explicit approval:

- Push to `main` or run `supabase functions deploy` without "push to main".
- Change routing or URL patterns.
- Change database schema (add/rename/drop columns or tables).
- Touch `is_brand_builder`.
- Create a new Supabase client.
- Use non‑`www` URLs or `http`.
- Run bulk operations without a small test batch first (≈10 records).
- Mark a task "done" without end‑to‑end verification.

Deprecated services/settings:

- Cloudflare worker‑based bot rendering – do not add new dependencies.
- Resend, legacy Perplexity API flows, Gemini 2.0 flows – do not bring back without explicit approval.

***

## 9. CRM & Email (Sequences, Magic Links, E2E)

Senders:

- Allowed sequence senders: `robert@toptenlists.us` and `hello@toptenlists.us`.
- **Never** send from any `@top10lists.us` address (damaged domain).

Key tables:

- `crm_email_accounts`, `crm_email_templates`, `crm_emails`  
- `crm_sequences`, `crm_sequence_steps`, `crm_sequence_enrollments`  
- `crm_tasks` (follow‑up tasks keyed to opens/clicks/bounces)  

Edge functions (CRM/email):

- `gmail-send` – sends via Gmail API and records `crm_emails`.  
- `gmail-oauth-callback` – OAuth for Gmail.  
- `send-template` – looks up template by name, substitutes vars (`first_name`, `firstname`, `magic_link`, `unsubscribe_url`, etc.), calls gmail-send.  
- `sequence-processor` – runs every 5 minutes (when scheduled), enforces ramp and per‑account caps.  
- `sequence-enroll` – enrolls agents into sequences and assigns sending account.  
- `email-track` – open/click tracking.

Sequence body template:

- **"Getting Bombarded"** – canonical body for "Getting Named by AI" sequence: hot topic / bombarded, Perplexity callouts in `[[BLOCK]]`, [your profile]({{magic_link}}), [Unsubscribe]({{unsubscribe_url}}). Subject override in sequence step: "Getting named by AI."  
- Template and ensure script: `scripts/ensure-getting-bombarded-template.ts`; migration: `20260304000000_getting_bombarded_template.sql`.

Sequencer schedule:

- Re‑enable: migration `20260305000000_reschedule_sequence_processor_at_0500.sql` adds a one‑time cron at **05:00 UTC** that schedules `sequence-processor` every 5 min and unschedules itself. For 05:00 Arizona (MST) use cron `0 12 * * *` instead of `0 5 * * *`.  
- Until that 05:00 run, sequence-processor is unscheduled (no sends).

Sequence ramp & per‑run behavior (goal state):

- Single active sequence: **"Getting Named by AI"**; subject locked to "Getting named by AI."  
- Daily ramp per account with max daily cap; per invocation, `sequence-processor` sends at most **1 email per account per run**, with a 5‑minute interval between cron runs.  
- `SENDING_ACCOUNTS` limited to `["robert@toptenlists.us","hello@toptenlists.us"]`.  

**Sequence queue (from DB 2026‑02‑26):**

- `robert@toptenlists.us`: 462 active, 134 due now (next_send_at ≤ now); 14 disabled, 3 bounced, 1 completed.  
- `hello@toptenlists.us`: 445 active, 89 due now; 13 disabled, 21 completed, 1 paused, 1 bounced, 1 replied.  
- Orphaned (will not be sent until reassigned): `robert@top10lists.us`, `hello@top10lists.us` (19+15 disabled, 3+1 bounced, 1 unsubscribed). Reassign in SQL: `UPDATE crm_sequence_enrollments SET assigned_account = 'robert@toptenlists.us' WHERE assigned_account = 'robert@top10lists.us';` and same for hello@.  
- Check anytime: `npx tsx scripts/check-sequence-queues.ts`.

**Magic links:**

- All magic links in CRM templates (dashboard, verification, artifact, unsubscribe) must:  
  - Resolve to **production** `https://www.top10lists.us/...`, even when triggered from staging for tests.  
  - Work end‑to‑end from a received email (click → correct page, correct token/agent).  
- `send-template` substitutes `{{magic_link}}` (dashboard URL) and `{{unsubscribe_url}}` (unsubscribe Edge Function URL with token).

***

## 10. E2E Definition of Done (Especially for CRM/Email)

A change is **not done** until:

1. **User path exercised:** e.g., from UI action or sequence cron → Edge function → Supabase row → user‑visible effect (page/email).
2. **Edge function behavior verified:** no unhandled errors; correct data written (`crm_emails`, `crm_sequence_enrollments`, `crm_tasks` etc.).
3. **Correct environment:** all checks run on **staging** for new work; any links shared to Robert for review use staging URLs. Production changes only follow an approved push to main.
4. **Magic links tested:** in at least one real test email, every link is clicked and lands on the right **production** page with proper tracking behavior.
5. **Agent‑sensitive data preserved:** no overwriting of non‑empty JSONB arrays (`press_mentions`, etc.) with empty results; no null‑ing critical fields.

If any of those cannot be done (e.g., no inbox access), the agent must state exactly which step is missing and why, and mark the task as **in progress**, not done.

***

## 11. Things Explicitly Deprecated or To Ignore

- Neighborhood pricing tiers (`Main/Prime/Luxury` at $25/$50/$75) – do not use.
- ARELLO LVWS and similar license APIs as ranking inputs; at most, potential future infrastructure, **not** part of current design.
- Old agent counts or statements contradicting the verified 3,487 total – treat them as stale.
- Any instruction suggesting merging `main` → `staging` – superseded by the one‑way `staging` → `main` rule.

***

*Version 1.0 — February 26, 2026*
