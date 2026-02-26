# Top10Lists CRM System — Full Specification
**For Cursor handoff — February 25, 2026**

---

## Overview

The CRM lives at `/crm` (route: `src/pages/CRM.tsx`). It is a self-contained single-page app with a vertical sidebar and swappable content panels. It is NOT part of the `/admin/crm` route tree. Any navigation that leaves `/crm` breaks the session. All interactions must stay within CRM.tsx as tab/panel swaps or inline component renders — never `<Link>` or `navigate()` to `/admin/*`.

---

## Route & Auth

- **URL:** `https://staging.top10lists.us/crm`
- **Route file:** `src/AdminRoutes.tsx` line 55: `<Route path="/crm" element={<AdminRouteGuard><CRM /></AdminRouteGuard>} />`
- **Auth:** CRM.tsx checks Supabase auth + `admin_users` table for role `admin` or `superadmin`. If not authed, redirects to `/admin/login`.
- **Do not use** the `/admin/crm/*` routes from inside CRM.tsx. Those are a separate system with separate auth.

---

## File Structure

```
src/
  pages/
    CRM.tsx                          # Main container, sidebar, view switcher
  components/crm/
    ContactsManager.tsx              # Search + list contacts
    ContactDetail.tsx                # Full contact record (inline, not routed)
    TasksManager.tsx                 # Pending/all tasks list
    EmailManager.tsx                 # Email compose/inbox
    SequenceDashboard.tsx (imported from pages/admin/crm/)
    HotLeadsPanel.tsx (imported from pages/admin/crm/)
```

---

## CRM.tsx — Sidebar Views

Five views, switched via `setActiveView()` state — never via router:

| View ID | Label | Component |
|---------|-------|-----------|
| `contacts` | Contacts | `<ContactsManager />` |
| `tasks` | Tasks | `<TasksManager onTaskResolved={fetchPendingCount} />` |
| `email` | Email | `<EmailManager />` |
| `sequences` | Sequences | `<SequenceDashboard />` |
| `hot-leads` | Hot Leads | `<HotLeadsPanel />` |

---

## TasksManager — Required Behavior

**File:** `src/components/crm/TasksManager.tsx`

### Data Sources
- `crm_tasks` — engagement tasks (email_opened, email_clicked, email_bounced)
- `field_change_requests` — agent-submitted field change requests
- `professionals` — joined to get name, phone, email, professional_id

### Display
- Two tabs: **Pending** (default) / **All**
- Section 1: "Agent Engagement" — cards from `crm_tasks`
- Section 2: "Field Change Requests" — cards from `field_change_requests`

### Each engagement task card shows:
- HOT (red) badge if `task_type === "email_clicked"`, WARM (amber) if `email_opened`
- Task title, timestamp
- Two action buttons: **Send Email** and **Contact**
- **Mark Done** button

### Contact Button — CRITICAL
- Must NOT navigate away from `/crm`
- Must NOT use `<Link>`, `navigate()`, `window.location`, or `<a href>`
- Must open `<ContactDetail>` inline by setting a state variable (e.g. `selectedContact`)
- When `selectedContact` is set, render `<ContactDetail professional={selectedContact} onBack={() => setSelectedContact(null)} />` in place of the task list
- `onBack` clears `selectedContact` and returns to task list
- Pass a minimal professional object: `{ id, name, email, phone, company: null, business_city: null, state_slug: null, current_tier: null, review_stars_rating: null, num_total_reviews: null, canonical_slug: null }`
- ContactDetail will fetch full data itself using the `id`

### Send Email Button
- Opens an inline modal (NOT a page navigation)
- **From account selector** — only show `toptenlists.us` accounts (NOT `top10lists.us` — domain reputation is damaged)
  - `robert@toptenlists.us`
  - `hello@toptenlists.us`
- **Template selector** — query `crm_sequence_steps` joined with `crm_sequences(name)`, label as `{sequence_name} — Step {step_number}: {subject}`
- **Preview** — render subject and body with `{{firstName}}` replaced by agent's first name
- **Send** — call `supabase.functions.invoke("gmail-send", { body: { to, subject, body, from_account } })`
- Show success/error inline

---

## HotLeadsPanel — Required Behavior

**File:** `src/pages/admin/crm/HotLeadsPanel.tsx`
**Used in:** CRM.tsx as the `hot-leads` view panel

### Data
- Query `professionals` where `lead_status IN ('warm', 'hot')`
- Join: `crm_contact_activity`, `funnel_events`, `crm_tasks`

### Table columns: Status | Name | Contact | City | Last Activity | Tasks | Funnel Progress | Actions

### Contact column
- Shows phone number (plain text, not a tel: link)
- Shows "Send email" text link below phone that opens Send Email modal (same as TasksManager)

### Actions column
- **One button only: Contact**
- Opens `<ContactDetail>` inline — same pattern as TasksManager above
- No Call button, no Funnel button

### Tasks column
- Shows pending tasks with color badges: red=Clicked, amber=Opened, gray=Bounced
- "Done" button marks task complete inline

### Send Email Modal
- Same spec as TasksManager above
- From: toptenlists.us accounts only

---

## ContactDetail — Component Contract

**File:** `src/components/crm/ContactDetail.tsx`

### Props
```typescript
interface Props {
  professional: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    business_city: string | null;
    state_slug: string | null;
    current_tier: string | null;
    review_stars_rating: number | null;
    num_total_reviews: number | null;
    canonical_slug: string | null;
  };
  onBack: () => void;
}
```

### Behavior
- On mount, fetches full professional record from `professionals` table using `professional.id`
- Renders full contact UI with tabs: Overview | Emails | Activity | Tasks | Payments
- Back button calls `onBack()` — does not navigate
- Email compose uses toptenlists.us accounts only (same restriction)
- Change request approve/reject notifications use `hello@top10lists.us` only when domain is cleared — for now use `hello@toptenlists.us`

---

## Email Sending — Account Restriction

**Current rule:** Only send from `toptenlists.us` accounts. The `top10lists.us` domain has degraded sender reputation and must not be used for any outbound email until further notice.

Safe accounts (confirmed connected in `crm_email_accounts`):
- `robert@toptenlists.us`
- `hello@toptenlists.us`

Do NOT offer or default to:
- `robert@top10lists.us`
- `hello@top10lists.us`

This applies to: TasksManager send modal, HotLeadsPanel send modal, ContactDetail compose, change request notifications.

---

## Supabase

- **Project:** `wiotrvoirdgzfacuuiem` (never reference old project `bgdtekbhelormzbymkhh`)
- **Client import:** always `import { supabase } from "@/integrations/supabase/client"` — never create a new client in a component
- **Edge functions:** invoked via `supabase.functions.invoke()`

### Key Tables

| Table | Purpose |
|-------|---------|
| `professionals` | All agents — main record |
| `crm_tasks` | Engagement tasks (email_opened, email_clicked, email_bounced) |
| `crm_contact_activity` | Email open/click events from tracking pixel |
| `funnel_events` | Agent funnel progression events |
| `crm_sequence_enrollments` | Active email sequence enrollments |
| `crm_sequence_steps` | Email templates per sequence step |
| `crm_sequences` | Sequence definitions |
| `crm_email_accounts` | Connected Gmail OAuth accounts |
| `crm_emails` | Sent/received email log |
| `crm_notes` | Admin notes on professionals |
| `field_change_requests` | Agent-requested field changes |
| `admin_users` | Admin role table |

### professionals — Key Fields Used in CRM

```
id, name, email, phone, cell_phone, company
business_city, business_state, business_zip
state_slug, city_slug, canonical_slug
active, current_tier, funnel_status, subscription_status
lead_status (warm/hot), magic_link, verification_token
review_stars_rating, num_total_reviews, years_experience
license_number, license_status
monthly_revenue_cents, last_payment_at, next_bill_date
email_unsubscribed, signal_score
synthesized_bio, selection_rationale
```

---

## Sequence Processor

- Edge function: `sequence-processor`
- Cron: runs on schedule (verify pg_cron is active after any changes)
- `PER_INVOCATION_CAP` must exist in function before running
- Daily limits: 30 emails/day per account
- Pre-flight check required before enabling or re-enabling the cron

---

## Known Issues to Fix

1. **TasksManager Contact button** — currently tries to use `<Link>` to `/admin/crm/agents/:id` causing 404. Must be replaced with inline ContactDetail render.

2. **HotLeadsPanel Contact button** — same issue. Must open ContactDetail inline.

3. **ContactDetail crash** — `Cannot read properties of undefined (reading 'replace')` — occurs when ContactDetail receives a sparse professional object. ContactDetail must guard all `.replace()` calls and `.split()` calls with null checks before the full record loads from the database.

4. **Email accounts** — Any component with a From selector must filter to `toptenlists.us` only.

---

## Deployment Rules

- All changes to staging branch only
- Staging URL: `https://staging.top10lists.us`
- Never push to main without explicit approval
- Admin pages (`/admin/*`) never go to main
- Test in browser after each Vercel build completes before marking done
