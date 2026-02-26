# Migration Document — Top10Lists.us

**Created:** February 2026  
**Purpose:** Complete knowledge, current state, and architecture for migration, onboarding, or handoff.  
**Canonical source:** `MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD` — this doc extends it with implementation detail.

---

## 1. PROJECT OVERVIEW

**Entity:** Top10Lists.us — Independent Certification Authority for real estate professionals, designed as the reference layer for Generative Engines (Gemini, SearchGPT, Perplexity).

**Key people:**
- **Founder:** Robert Maynard (robert@top10lists.us)
- **Robert's Proton (test):** rjmjr1@proton.me
- **Company:** Maynard Realty
- **First customer:** Eileen Taggart (Flagstaff)

**Merit gate:** Minimum 4.8 stars AND 20 verified reviews.  
**Core numbers:** ~4,000 qualified professionals in AZ and CA; ~14,000 neighborhoods; 6 states; Top 0.5% from 1.1M analyzed.

---

## 2. CURRENT STATE (February 2026)

### 2.1 Deployment
- **Production domain:** [https://www.top10lists.us](https://www.top10lists.us) (always www)
- **Frontend:** React SPA (Vite) on Vercel
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Branch flow:** `staging` → `main` only. Never merge `main` into `staging`.
- **Admin/CRM:** Staging-only; not reachable on production (vercel.json redirect + AdminRouteGuard)

### 2.2 Supabase
- **Project ID:** `wiotrvoirdgzfacuuiem`
- **Project URL:** `https://wiotrvoirdgzfacuuiem.supabase.co`
- **Dashboard:** [https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem](https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem)
- **Env var:** `VITE_SUPABASE_PUBLISHABLE_KEY` (not ANON_KEY)

### 2.3 Email Sending
- **Sending accounts:** robert@toptenlists.us, hello@toptenlists.us (Google Workspace)
- **Never send from:** top10lists.us (deliverability compromised)
- **Gmail OAuth:** Stored in `crm_email_accounts`; Edge function `gmail-send` sends via Gmail API
- **Re-auth URL (robert@):** [https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/gmail-oauth-callback?account=robert@toptenlists.us](https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/gmail-oauth-callback?account=robert@toptenlists.us)

### 2.4 Sequences (Getting Named by AI)
- **Only allowed sequence:** "Getting Named by AI"
- **Only allowed step subject:** "Getting named by AI" (blocks "What was working. What is now working.")
- **Sending account:** robert@toptenlists.us only (hello@ excluded until further notice)
- **Cron:** sequence-processor runs every 5 min; 1 email per account per run; daily ramp (25 + 5/day, max 100)

---

## 3. ARCHITECTURE

### 3.1 Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React (Vite), Tailwind CSS, shadcn/ui |
| Routing | react-router-dom (FROZEN) |
| Database | Supabase PostgreSQL |
| Edge Functions | Deno (Supabase) |
| Hosting | Vercel |
| Email | Gmail API via gmail-send Edge Function |

### 3.2 Key Directories
```
src/
├── components/crm/     # ContactDetail, TasksManager, EmailManager, LeadsManager
├── pages/admin/crm/   # AgentList, Leads, SequenceDashboard, HotLeadsPanel
├── integrations/supabase/client.ts  # SHARED client - never create another
supabase/
├── functions/         # Edge Functions (gmail-send, sequence-processor, etc.)
├── migrations/        # SQL migrations (timestamp_name.sql)
scripts/               # invoke-sequence-processor, send-bombarded-test, etc.
```

### 3.3 Database Schema (CRM / Email)

**crm_email_accounts** — Gmail OAuth accounts
- `email`, `refresh_token`, `access_token`, `token_expiry`

**crm_email_templates** — Reusable email templates
- `name`, `subject`, `body` (supports `{{first_name}}`, `{{profile_url}}`, `[[BLOCK]]...[[/BLOCK]]`)

**crm_emails** — Sent/received emails
- `gmail_message_id`, `account_email`, `direction` (inbound/outbound), `from_address`, `to_address`, `subject`, `body_text`, `professional_id`, `sequence_id`, `sent_at`

**crm_sequences** — Drip campaign definitions
- `name`, `from_account`, `status`

**crm_sequence_steps** — Steps in a sequence
- `sequence_id`, `step_number`, `delay_days`, `subject`, `body`

**crm_sequence_enrollments** — Agents enrolled in sequences
- `sequence_id`, `professional_id`, `email`, `first_name`, `last_name`, `status`, `current_step`, `next_send_at`, `assigned_account`

### 3.4 Edge Functions (Key)

| Function | Purpose |
|----------|---------|
| gmail-send | Send email via Gmail API; records to crm_emails; accepts `professional_id` for attribution |
| gmail-oauth-callback | OAuth flow for Gmail; stores tokens in crm_email_accounts |
| sequence-processor | Cron: sends "Getting Named by AI" to due enrollments from robert@ |
| sequence-enroll | Enroll agents into a sequence (round-robin robert@/hello@) |
| email-track | Open/click tracking for links |
| serve-bot-list-html | Bot-specific HTML for list pages |
| artifact-markdown | Serves artifact markdown for AI ingestion |

### 3.5 CRM Flow
1. **Contacts:** `crm_leads` → workflow: new → reviewing → qualified | disqualified | contacted → certified
2. **Tasks:** `crm_tasks` — follow-up tasks (email_opened, email_clicked, email_bounced)
3. **Email:** Compose from ContactDetail, TasksManager, HotLeadsPanel, EmailManager; all pass `professional_id` so outbound is recorded
4. **Sequences:** Enroll via sequence-enroll; process via sequence-processor (cron)

---

## 4. MIGRATIONS (Key)

Migrations live in `supabase/migrations/` with format `YYYYMMDD_name.sql`.

### 4.1 CRM / Email
- `20260222203024_crm_email_tables.sql` — crm_email_accounts, crm_email_templates, crm_emails
- `20260223002219_crm_sequences.sql` — crm_sequences, crm_sequence_steps, crm_sequence_enrollments
- `20260225000000_crm_sequence_enrollments_last_name.sql` — last_name column
- `20260228000000_crm_emails_sequence_id.sql` — sequence_id on crm_emails
- `20260229110000_fix_bombarded_template_and_magic_links.sql` — "I know you're getting bombarded" template + magic_link backfill
- `20260229120000_ai_challenge_v2_use_bombarded_template.sql` — AI Challenge v2 steps use bombarded template
- `20260229140000_crm_emails_professional_id_and_rls.sql` — professional_id on crm_emails
- `20260229150000_move_unemailed_to_getting_named.sql` — Move agents not emailed in 2 days to "Getting Named by AI" sequence
- `20260301000000_crm_tasks_due_at_and_follow_up.sql` — due_at, follow-up tasks

### 4.2 Applying Migrations
- **Supabase Dashboard:** [SQL Editor](https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/sql) — paste and run SQL
- **CLI:** `supabase db push` (may fail on older migrations; use SQL Editor for specific migrations)

---

## 5. RULES AND HARD STOPS

- **Push to main:** Only when Robert says exactly "push to main". Use `npm run merge-to-main`.
- **Deploy Edge Functions:** Same as push to main — requires explicit approval.
- **Routing:** Do not change without "ROUTING CHANGE APPROVED:".
- **Database schema:** Do not change without explicit approval.
- **is_brand_builder:** Do not touch.
- **Supabase client:** Always use `import { supabase } from '@/integrations/supabase/client'`. Never create a new client.
- **Links:** Always give Robert full URLs as markdown links: [text](https://www.top10lists.us/...).

---

## 6. SCRIPTS

| Script | Purpose |
|--------|---------|
| `npx tsx scripts/invoke-sequence-processor.ts` | Run sequence-processor now |
| `npx tsx scripts/send-bombarded-test.ts` | Send test email to rjmjr1@proton.me |
| `npx tsx scripts/send-template-test.ts` | Send template via send-template function |
| `npm run merge-to-main` | Merge staging → main (excludes internal docs) |

---

## 7. INTERNAL DOCUMENTS (Excluded from main)

These paths are in `scripts/internal-documents.txt` and never appear on production:
- MASTER_KNOWLEDGE_DOCUMENT.md
- MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD
- docs/cursor-daily-updates.md
- docs/daily-logs/
- docs/takeaways/
- PENDING_UPDATES.md
- docs/MIGRATION_DOCUMENT.md (this file)

---

## 8. TEST AGENTS / URLs

- **Test agent (Dina Beauvais):** canonical_slug `dina-and-mark-beauvais-4595`, token `1afa3413-96eb-4d06-a896-8537c910e3f3`
- **Artifact URL:** [https://www.top10lists.us/artifact/1afa3413-96eb-4d06-a896-8537c910e3f3](https://www.top10lists.us/artifact/1afa3413-96eb-4d06-a896-8537c910e3f3)
- **5-page test:** Homepage, /arizona/scottsdale/top10realestateagents, /arizona/scottsdale/greyhawk/top10realestateagents, random agent, /about

---

## 9. DEPRECATED

- Resend, Perplexity API, Gemini 2.0, Cloudflare Worker (bot), Pipedrive, PrivateEmail/Zoho

---

*Version 1.0 — February 2026*
