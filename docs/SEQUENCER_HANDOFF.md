# Sequencer Engine — Handoff Document

**Created:** March 2026  
**Purpose:** Detailed handoff for external review of the sequencing functions and engine.  
**Canonical source:** `supabase/functions/sequence-processor`, `sequence-enroll`, `gmail-send`, `crm-migrate`, and related migrations.

---

## 1. EXECUTIVE SUMMARY

The sequencer is a drip-email system that sends "Getting Named by AI" emails to listed real estate agents. It runs as a Supabase Edge Function on a 5-minute cron schedule. Emails are sent via Gmail API using OAuth tokens stored in `crm_email_accounts`. The system has accumulated complexity from multiple migrations and hardcoded constraints; this document captures the current state for review.

---

## 2. ARCHITECTURE

### 2.1 Component Map

| Component | Type | Role |
|-----------|------|------|
| **sequence-processor** | Edge Function | Cron-invoked; sends one email per account per run; enforces daily limits and sequence/subject rules |
| **sequence-enroll** | Edge Function | Enrolls agents into a sequence; round-robins robert@/hello@; assigns staggered `next_send_at` |
| **gmail-send** | Edge Function | Sends ad-hoc emails (CRM compose); uses same Gmail OAuth and tracking |
| **gmail-oauth-callback** | Edge Function | OAuth flow; stores tokens in `crm_email_accounts` |
| **email-track** | Edge Function | Open/click tracking; rewrites links in emails; records opens/clicks |
| **unsubscribe** | Edge Function | Unsubscribe endpoint; updates `professionals.email_unsubscribed` |
| **crm-migrate** | Edge Function | One-time/setup; schedules pg_cron for sequence-processor |
| **gmail-sync** | Edge Function | Inbound email sync (Gmail webhooks); not core to sequencing |
| **pg_cron** | Supabase extension | Runs `sequence-processor` every 5 minutes via `net.http_post` |

### 2.2 Data Flow (High Level)

```
[sequence-enroll]  →  crm_sequence_enrollments (insert/upsert)
                              ↓
[pg_cron]  →  [sequence-processor]  →  [Gmail API]
                              ↓
              crm_emails (insert)
              crm_contact_activity (insert)
              crm_sequence_enrollments (update current_step, next_send_at)
              professionals (lead_status = 'warm')
```

---

## 3. DATABASE SCHEMA

### 3.1 Core Tables

**crm_sequences**
- `id`, `name`, `description`, `from_account`, `status`
- `on_reply_sequence_id` (optional reply sequence)

**crm_sequence_steps**
- `sequence_id`, `step_number`, `delay_days`, `subject`, `body`
- One row per step; `step_number` is 1-based

**crm_sequence_enrollments**
- `sequence_id`, `professional_id`, `email`, `first_name`, `last_name`
- `status` (`active` | `completed` | `disabled` | `migrated`)
- `current_step`, `next_send_at`, `assigned_account`
- `completed_at`, `replied_at`, `metadata`
- **UNIQUE(sequence_id, email)**

**crm_email_accounts**
- `email`, `refresh_token`, `access_token`, `token_expiry`
- Gmail OAuth; sequence-processor refreshes tokens as needed

**crm_emails**
- `gmail_message_id`, `account_email`, `direction` (inbound/outbound)
- `from_address`, `to_address`, `subject`, `body_text`
- `sequence_id`, `professional_id`, `sent_at`

**crm_email_templates**
- `name`, `subject`, `body` — used for template content (e.g. "I know you're getting bombarded")
- Template subject is **not** used by sequence-processor; step subject is authoritative.

**professionals**
- `verification_token`, `magic_link`, `current_tier`, `email_unsubscribed`, `lead_status`
- `state_slug` (arizona, california, etc.)

### 3.2 Key Indexes

- `crm_sequence_enrollments`: status, next_send_at, sequence_id, email, assigned_account (implicit via queries)

---

## 4. SEQUENCE-PROCESSOR (Core Logic)

**File:** `supabase/functions/sequence-processor/index.ts`

### 4.1 Invocation

- Triggered by pg_cron every 5 minutes: `*/5 * * * *`
- HTTP POST to `{SUPABASE_URL}/functions/v1/sequence-processor`
- No request body required

### 4.2 Hardcoded Configuration

| Constant | Value | Notes |
|----------|-------|-------|
| `CAMPAIGN_START` | 2026-02-24T12:00 UTC | Day 1 = 25 sends, +5/day, max 100 |
| `MAX_SENDS_PER_ACCOUNT_PER_RUN` | 1 | One email per account per cron run |
| `accounts` | `["robert@toptenlists.us"]` | hello@ excluded |
| `ALLOWED_SEQUENCE_NAME_PATTERNS` | `["getting named by ai"]` | Sequence name must contain this |
| `REQUIRED_STEP_SUBJECT` | `"getting named by ai"` | Step subject must contain this |
| `BLOCKED_STEP_SUBJECTS` | `["what was working. what is now working."]` | Blocked |

### 4.3 Daily Limit Logic

- **Day boundary:** 12:00 UTC (5am MST)
- **toptenlists.us:** `min(25 + (dayNum - 1) * 5, 100)` per account per day
- **top10lists.us:** `min(10 + (dayNum - 1) * 2, 25)` — but top10lists.us is deprecated; no sends from it

### 4.4 Per-Run Flow

1. Load `crm_email_accounts` for `accounts` (robert@ only)
2. For each account:
   - Compute `dailyLimit` and `sentToday` from `crm_emails`
   - Query enrollments: `assigned_account = account.email`, `status = 'active'`, `next_send_at <= now`, limit 1
   - Filter out recipients already sent to today
   - Filter by `isAllowedSequence(sequence_name)` — only "Getting Named by AI"
   - Filter by `isAllowedStepSubject(step.subject)` — blocks "What was working..."
   - For each enrollment:
     - Fetch professional; skip if `email = pending@123.com` or missing
     - Skip if `current_tier !== 'listed'` (bump `next_send_at` to tomorrow)
     - Fetch step for `current_step + 1`; if none, mark completed
     - Build email with placeholders (`{{first_name}}`, `{{profile_url}}`, etc.)
     - Send via Gmail API
     - Insert `crm_emails`, `crm_contact_activity`; update `professionals.lead_status`
     - Update enrollment: `current_step + 1`, `next_send_at` = today + delay_days (or mark completed)

### 4.5 Dependencies

- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` (env)
- `crm_email_accounts` must have valid OAuth for robert@toptenlists.us

---

## 5. SEQUENCE-ENROLL

**File:** `supabase/functions/sequence-enroll/index.ts`

### 5.1 Invocation

- HTTP POST with body: `{ sequence_id, filters?, dry_run?, start_date? }`
- `sequence_id` required; `filters` can include `state_slug`, `tier`, `city`, `email_provider`

### 5.2 Logic

1. Query `professionals`: `active`, `email_unsubscribed = false`, `current_tier = 'listed'`, has email and verification_token
2. Filter out already enrolled in this sequence
3. Assign `assigned_account` round-robin: robert@, hello@, robert@, hello@, ...
4. Stagger `next_send_at`: 5-min slots starting at 5am MST; 50/day total (25 per account)
5. Upsert enrollments in batches of 200

### 5.3 Mismatch with sequence-processor

- **sequence-enroll** assigns robert@ and hello@ in round-robin
- **sequence-processor** only sends from robert@
- Enrollments with `assigned_account = hello@` are **never processed** until hello@ is re-enabled in the processor

---

## 6. GMAIL & TRACKING

### 6.1 gmail-send

- Used by CRM compose (ContactDetail, TasksManager, HotLeadsPanel)
- Accepts: `from_account`, `to`, `subject`, `message_body`, `professional_id`, `thread_id`, etc.
- Looks up `crm_email_accounts` by `from_account`; refreshes token if needed
- Sends via Gmail API; inserts `crm_emails` with `professional_id` for attribution

### 6.2 email-track

- Vercel rewrites `/api/t` to Supabase `email-track`
- Query params: `t` (o=open, c=click), `eid` (tracking id), `url` (for click redirect)
- gmail-send and sequence-processor inject tracking URLs; links to top10lists.us are **not** rewritten (magic links must work)

### 6.3 unsubscribe

- URL: `{SUPABASE_URL}/functions/v1/unsubscribe?token={verification_token}`
- Sets `professionals.email_unsubscribed = true`
- sequence-enroll excludes `email_unsubscribed` agents; sequence-processor does not re-check (enrollment is already created)

---

## 7. CRON SETUP

**File:** `supabase/functions/crm-migrate/index.ts`

- Protected by header `x-migration-key: crm_migrate_2026`
- Unschedule existing `sequence-processor` cron
- Schedule: `*/5 * * * *` (every 5 minutes)
- Uses `net.http_post` to call sequence-processor

**To verify cron:** Supabase Dashboard → Database → Extensions → pg_cron, or run `SELECT * FROM cron.job WHERE jobname = 'sequence-processor';`

---

## 8. CURRENT STATE (As of March 2026)

### 8.1 Sequences in DB

| Sequence Name | Enrollments | Notes |
|---------------|-------------|-------|
| AZ Listed - Challenge | ~769 | Legacy; processor ignores |
| AZ Listed - AI Challenge v2 (private domain) | ~230 | Legacy; processor ignores |
| Getting Named by AI | 0 (before migration) | Only sequence processor sends |

### 8.2 Sending Accounts

- **robert@toptenlists.us** — active in processor; OAuth in crm_email_accounts
- **hello@toptenlists.us** — excluded from processor; enrollments assigned to hello@ never send

### 8.3 Enrollments

- ~907 Arizona active, not sent (in legacy sequences)
- Split: robert@ 462, hello@ 445 (by assigned_account)
- Migration `20260302000000_arizona_to_getting_named_by_ai.sql` moves them to "Getting Named by AI"

---

## 9. MIGRATION HISTORY (Relevant)

| Migration | Purpose |
|-----------|---------|
| `20260223002219_crm_sequences.sql` | Create crm_sequences, crm_sequence_steps, crm_sequence_enrollments |
| `20260225000000_crm_sequence_enrollments_last_name.sql` | Add last_name column |
| `20260220120000_crm_template_bombarded.sql` | "I know you're getting bombarded" template |
| `20260229110000_fix_bombarded_template_and_magic_links.sql` | [[BLOCK]], [your profile]({{profile_url}}); magic_link backfill |
| `20260229120000_ai_challenge_v2_use_bombarded_template.sql` | AI Challenge v2 steps use bombarded template (subject = "What was working...") |
| `20260229150000_move_unemailed_to_getting_named.sql` | Move unemailed from AI Challenge to "Getting Named by AI" (2-day window) |
| `20260302000000_arizona_to_getting_named_by_ai.sql` | Move Arizona active not-sent from Challenge/v2 to "Getting Named by AI" |

**Note:** `assigned_account` column — added in a migration (check schema); sequence-enroll and processor both depend on it.

---

## 10. DESIGN CONCERNS FOR REVIEW

### 10.1 Hardcoded Sequence Names

The processor only sends from sequences whose name contains "getting named by ai". All other sequences (AZ Listed - Challenge, AI Challenge v2) are ignored. This forces migrations to move enrollments rather than changing processor config. **Alternative:** Make allowed sequences configurable (DB flag or env).

### 10.2 Hardcoded Step Subject

Step subject must contain "Getting named by AI"; "What was working. What is now working." is blocked. The bombarded template's subject in `crm_email_templates` is "What was working..." — so the template subject and allowed step subject are divergent. Steps are created manually/migration with the correct subject. **Review:** Should template and step be more aligned?

### 10.3 Migration vs Fresh Enrollment

Current approach: Migrate existing enrollments from legacy sequences into "Getting Named by AI". **Alternative:** Unenroll from legacy, run sequence-enroll fresh for "Getting Named by AI" with `filters.state_slug: 'arizona'`. Pros: Clean slate, correct stagger. Cons: May double-enroll if not careful; loses per-enrollment metadata.

### 10.4 robert@ vs hello@ Split

sequence-enroll assigns both accounts; processor uses only robert@. Half of enrollments (hello@) never send. **Options:** (a) Re-enable hello@ in processor; (b) Stop round-robining to hello@ in sequence-enroll; (c) Document as intentional (e.g. hello@ for manual use only).

### 10.5 Domain Normalization

Enrollments exist with `assigned_account` = robert@top10lists.us, hello@top10lists.us (wrong domain). Sending domain is toptenlists.us. Migration normalizes these. **Review:** Should enrollments ever use top10lists.us? (Domain is deprecated for sending.)

### 10.6 Campaign Start and Daily Ramp

`CAMPAIGN_START` is hardcoded. Daily limit grows by day number. If campaign is paused or restarted, day math may be wrong. **Review:** Should ramp be configurable or reset?

### 10.7 Single Step

"Getting Named by AI" currently has one step. Multi-step sequences work (current_step, delay_days) but only one step is used. **Review:** Is multi-step needed?

---

## 11. FILES REFERENCE

| Path | Purpose |
|------|---------|
| `supabase/functions/sequence-processor/index.ts` | Main send logic |
| `supabase/functions/sequence-enroll/index.ts` | Enrollment logic |
| `supabase/functions/gmail-send/index.ts` | Ad-hoc send + tracking |
| `supabase/functions/gmail-oauth-callback/index.ts` | OAuth flow |
| `supabase/functions/email-track/index.ts` | Open/click tracking |
| `supabase/functions/crm-migrate/index.ts` | Cron scheduling |
| `supabase/functions/unsubscribe/index.ts` | Unsubscribe |
| `supabase/migrations/20260223002219_crm_sequences.sql` | Schema |
| `supabase/migrations/20260302000000_arizona_to_getting_named_by_ai.sql` | Arizona migration |
| `scripts/invoke-sequence-processor.ts` | Manual invoke |
| `scripts/diagnose-sequence-processor.ts` | Diagnostics (no send) |

---

## 12. TESTING

### 12.1 Manual Invoke

```bash
npx tsx scripts/invoke-sequence-processor.ts
```

### 12.2 Diagnostics (No Send)

```bash
npx tsx scripts/diagnose-sequence-processor.ts
```

### 12.3 Dry-Run Enroll

```bash
# Via HTTP or script
POST /functions/v1/sequence-enroll
{ "sequence_id": "<uuid>", "filters": { "state_slug": "arizona" }, "dry_run": true }
```

---

*Version 1.0 — March 2026*
