# Claude Takeaways — 2026-03-21 19:30 UTC

## EMAIL INFRASTRUCTURE RULES (Permanent — add as new COMPREHENSIVE section)

These rules apply to ALL outbound email — campaigns, sequences, one-off sends, test sends. Every template must follow them. The only exception is Robert's personal outreach sentence, which he adds per-campaign.

---

### 1. HTML Document Wrapper (REQUIRED)

Every email body MUST be wrapped in a full HTML document structure before sending:

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333;">
  <!-- template content here -->
</body>
</html>
```

**Why:** Without this wrapper, Gmail and other clients render raw HTML tags as visible text instead of formatting them. This was a production bug — emails showed `<p>` and `<strong>` as literal text.

**Where it's enforced:**
- `gmail-send/index.ts` — wraps `innerHtml` in document structure (line ~190)
- `sequencer-v2-tick/index.ts` — wraps `queueItem.html_body` in document structure (line ~281)

---

### 2. RFC 2045 Base64 Line Wrapping (REQUIRED)

All base64-encoded MIME body parts MUST be wrapped at 76 characters per line.

```typescript
function base64Encode(text: string): string {
  const raw = btoa(unescape(encodeURIComponent(text)));
  return raw.match(/.{1,76}/g)?.join("\r\n") ?? raw;
}
```

**Why:** RFC 2045 Section 6.8 mandates max 76 chars per line. Proton Mail and other strict servers silently reject non-compliant MIME. This caused emails to never arrive.

**Where it's enforced:**
- `_shared/render-email.ts` — `base64Encode()` function used by `buildRawMimeMessage()`
- `gmail-send/index.ts` — `base64EncodeRfc()` function used by `buildRawEmail()`

---

### 3. RFC 5322 Display Name Quoting (REQUIRED)

Display names in From/To headers that contain special characters (parentheses, commas, quotes) MUST be quoted:

```typescript
function formatMailbox(email: string, displayName?: string): string {
  if (!displayName) return email;
  if (/[()<>@,;:\\".[\]]/.test(displayName)) {
    const escaped = displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}" <${email}>`;
  }
  return `${displayName} <${email}>`;
}
```

**Why:** Unquoted parentheses in display names (e.g., `Robert (Proton)`) are interpreted as RFC 5322 comments, causing parsing issues at receiving servers.

**Where it's enforced:**
- `_shared/render-email.ts` — `formatMailbox()` used in `buildRawMimeMessage()`

---

### 4. HTML Detection for Direct Sends (REQUIRED)

When `gmail-send` receives a `message_body`, it MUST detect whether the input is already HTML (from TipTap/campaign wizard) or plain text, and handle accordingly:

```typescript
const isHtml = /<[a-z][\s\S]*>/i.test(message_body);
const innerHtml = isHtml ? message_body : textToHtml(message_body);
const plainText = isHtml ? stripTags(message_body) : message_body;
```

**Why:** The `textToHtml()` function escapes `<` and `>` — if the input is already HTML, it destroys all formatting. This was a production bug.

---

### 5. Tracking Infrastructure (REQUIRED on all emails)

Every outbound email MUST include:

- **Open tracking pixel:** `<img src="https://www.top10lists.us/api/t?t=o&eid={trackingId}" width="1" height="1" style="display:none" alt="">`
- **Click tracking:** All external links rewritten through `https://www.top10lists.us/api/t?t=c&eid={trackingId}&url={originalUrl}`
- **Exception:** Links to `top10lists.us` are NEVER rewritten (preserves magic links and funnel URLs)

**Endpoint:** `/api/t` → Supabase edge function `email-track`
**Events recorded:** `email_queue.opened_at`, `open_count`, `clicked_at`, `click_count`
**CRM tasks auto-created:** open → normal priority, click → high priority

---

### 6. Unsubscribe Link (REQUIRED on all campaign emails)

Every campaign email MUST include:
- `List-Unsubscribe` header in MIME
- Visible unsubscribe link in footer HTML

**Endpoint:** Supabase edge function `unsubscribe`
**Pre-send check:** Sequencer checks `email_unsubscribes` table AND `professionals.email_unsubscribed` before sending.

---

### 7. Funnel Event Tracking (REQUIRED)

Every funnel step fires tracking events via `src/lib/funnel-track.ts`:

| Event | When | CRM Task |
|-------|------|----------|
| `funnel_landed` | Agent opens funnel from email | ✓ normal |
| `funnel_step_*` | Each step page view | — |
| `funnel_data_saved` | Agent saves profile edits | ✓ normal |
| `funnel_step_pricing` | Agent reaches pricing | ✓ high |
| `funnel_tier_selected` | Agent picks a tier | ✓ high |
| `funnel_checkout_started` | Agent sent to Stripe | ✓ high |
| `funnel_step_success` | Funnel completed | ✓ high |

Events log to `crm_contact_activity` and create `crm_tasks` for actionable signals.

---

### 8. Sender Accounts & Limits

**Active accounts (all 5):**
- `robert@top10lists.us`
- `hello@top10lists.us`
- `robert@toptenlists.us`
- `hello@toptenlists.us`
- `mark@toptenlists.us`

**Daily limit formula:** `floor(40 × 1.10^daysSinceStart)` — 40/day start, +10% compound daily, no cap.
**Send window:** 5:00 AM – 8:00 PM MST, Monday–Saturday. No Sunday sends.
**Campaign start date:** 2026-03-21 (reset date for limit calculation).

---

### 9. Template Checklist (for every new campaign)

Before launching any campaign, verify:

- [ ] HTML body uses `<p>` tags (not bare text or `<br>` chains)
- [ ] Merge variables use `{{snake_case}}` format
- [ ] Subject line can be a merge variable (e.g., `{{ai_surfaces_total_7d}}`)
- [ ] "Verify your profile" link uses `{{magic_link}}` merge variable
- [ ] Signature block has: name, title, site link, phone
- [ ] Template saved to `email_campaigns.template_html`
- [ ] Test send received at all 3 test addresses (Gmail, Proton, maynard.com)
- [ ] HTML renders correctly (not raw tags)
- [ ] Links are clickable (not broken by tracking rewrite)
- [ ] Unsubscribe link works
- [ ] Open pixel fires (check `email_queue.open_count` after opening test)

---

### 10. Edge Functions That Must Be Deployed

These functions are required for the email pipeline. If any returns 404, the pipeline is broken:

| Function | Purpose | Impact if missing |
|----------|---------|-------------------|
| `sequencer-v2-tick` | Cron sender (every 90s) | No campaign emails sent |
| `gmail-send` | Direct send API | CRM sends fail |
| `email-track` | Open/click tracking | Opens/clicks not recorded, external links broken |
| `unsubscribe` | Unsubscribe handler | Unsubscribe links broken (CAN-SPAM violation) |
| `create-agent-checkout` | Stripe checkout | Upgrade buttons fail |
| `funnel-select-tier` | Free tier selection | Certified activation fails |

Deploy command: `npx supabase functions deploy {name} --no-verify-jwt`
