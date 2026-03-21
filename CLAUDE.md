# CLAUDE.md — Top10Lists.us

## ⚠️ LAUNCH WITH PERMISSIONS DISABLED ⚠️

**Always launch Claude Code with `--dangerously-skip-permissions` (alias: `cc`).** Robert has approved all file and command operations. Do not prompt for approval on reads, writes, bash commands, or git operations. If you find yourself asking for permission, you were launched incorrectly.

---

## ⚠️ MANDATORY: TEST BEFORE DONE — NO EXCEPTIONS ⚠️

**YOU ARE NOT DONE UNTIL YOU HAVE TESTED WHAT YOU BUILT WITH REAL DATA AND CONFIRMED IT WORKS.**

DO NOT tell Robert something is working based on reading code. DO NOT say "deployed" and move on. DO NOT say "should work" or "looks correct." ACTUALLY RUN IT AND VERIFY THE RESULT.

**AFTER EVERY DEPLOY OR CODE CHANGE:**
1. SEND a real test (email, API call, page load — whatever the feature does)
2. VERIFY the output (open the email, click every link, load the page)
3. QUERY the database to confirm the data was written correctly (counters incremented, rows created, status updated)
4. REPORT what you tested and what you observed — with actual numbers: "Sent test email, opened it, clicked funnel link, confirmed email_queue.click_count went from 5 to 6"

**IF YOU CANNOT VERIFY** (e.g., waiting for an external event), say EXACTLY what you could not verify and what Robert should check.

**WHAT "TESTING" MEANS — EXAMPLES:**
- Email feature → Send a real email, open it in an inbox, click every link, then query email_queue/crm_email_events to confirm open and click were recorded
- Tracking feature → Trigger the event, then immediately query the DB table to confirm the row exists with correct values
- Counter/stats → Compare the displayed number against a direct DB query
- UI component → Load it in the browser with real data, click every button, verify the result
- Edge function → Call it with real parameters, check the response AND the side effects in the DB

**NEVER SKIP THIS.** Multiple production failures have resulted from skipping verification: emails not arriving, HTML rendering as raw tags, click tracking not counting the most important link, campaign counters stuck at zero, bounces not detected. Each time the code "looked correct" but was broken. This pattern is not acceptable.

---

## Single Source of Truth

The canonical project knowledge document is `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` on the **staging** branch. Fetch it with:

```bash
export GH_TOKEN=$(grep GH_TOKEN .env | cut -d= -f2)
curl -s -H "Authorization: token $GH_TOKEN" \
  "https://api.github.com/repos/rjmjr1962831/list-wise-boost/contents/docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md?ref=staging" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(Buffer.from(j.content,'base64').toString())})"
```

Read this document first. It overrides everything else.

**For Claude Web (claude.ai):** Project knowledge is maintained at `docs/prompts/claude-web-project-knowledge.md` on the staging branch. This is a copy of the COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md and is updated after every `s1` synthesis run. Use this as your starting context when working in Claude Web.

---

## Critical Rules

### North Star
Every change must enhance GEO (Generative Engine Optimization) or have no effect. If detrimental, ask Robert before executing.

### Merit Gate (Zero Exceptions)
4.5+ stars, 10+ verified reviews in last 24 months, 5+ years experience. Never weaken this.

### Business Model (4 Tiers)
Listed (Free) → Certified (Free, legacy ~58 agents) → Audited ($300/mo) → Underwritten ($500/mo). Payment affects verification depth and refresh frequency — never inclusion or ranking.

### Git Flow
- **staging → main only.** Never merge main into staging.
- `pts` = push to staging. `ptm` = `npm run merge-to-main`.
- **NO PUSH without Robert's express permission.** All dev on localhost.

### Clean Room Architecture
All public/bot-facing pages serve clean-room HTML from Supabase edge functions. React SPA only for authenticated pages (admin, dashboard). Never let AI pages fall through to `/_spa.html`.

### No Internal Docs on Public Sites
Never publish COMPREHENSIVE, CLAUDE.md, takeaways, prompts, or SQL to any public-facing HTTPS URL. GitHub repo only.

### No SQL Files on Main
Keep `.sql` files on staging only.

---

## Supabase

- **Project:** `wiotrvoirdgzfacuuiem` (ONLY valid project)
- **Dead project:** `bgdtekbhelormzbymkhh` — NEVER use
- **Enrichment API:** `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`
- **Deploy:** `npx supabase functions deploy <name> --no-verify-jwt`
- **`run_sql` is SELECT-only** — cannot INSERT/UPDATE/DELETE. Use `supabase.from().insert/update()` for writes.
- **Pagination:** Tables over 1,000 rows (professionals, neighborhood_catalog, marketing_content, state_licenses) must be paginated. If a query returns exactly 1,000 rows, there are more.

---

## Email Infrastructure

### Sender Accounts
- robert@top10lists.us, hello@top10lists.us (Robert Maynard)
- robert@toptenlists.us, hello@toptenlists.us (Robert Maynard)
- mark@toptenlists.us (Mark Garland)

### Send Rules
- 3-minute minimum between sends per account
- Daily limit: `floor(40 × 1.10^daysSinceStart)` per account
- Send window: 5am–8pm MST, Monday–Saturday, no Sunday
- Campaign start date for limit calc: 2026-03-21

### Email Format (REQUIRED)
- Wrap HTML body in `<!DOCTYPE html><html><body>` — without this, Gmail shows raw tags
- Base64 body parts must be line-wrapped at 76 chars per RFC 2045
- Quote display names with special characters per RFC 5322
- Detect if input is already HTML before calling `textToHtml()` — never double-escape
- Include open tracking pixel + click tracking via `/api/t`
- Include `List-Unsubscribe` header + visible unsubscribe link

### Required Edge Functions
`sequencer-v2-tick`, `gmail-send`, `email-track`, `unsubscribe`, `create-agent-checkout`, `funnel-select-tier`, `list-maker-export`

---

## Funnel Tracking

Events logged to `crm_contact_activity`, tasks created in `crm_tasks`:
- `funnel_landed` → task (normal)
- `funnel_data_saved` → task (normal)
- `funnel_step_pricing` → task (high)
- `funnel_tier_selected` → task (high)
- `funnel_checkout_started` → task (high)
- `funnel_step_success` → task (high)
- Email open → task (normal), email click → task (high), bounce → task (normal)
- Alerts to rjmjr1@proton.me on clicks and tier selections

---

## Key URLs
- Production: https://www.top10lists.us
- Staging: https://staging.top10lists.us
- Magic links: `/funnel/{verification_token}` (NOT `/dashboard/`)

---

## Scoring Weights
| Factor | Weight |
|--------|--------|
| license_status | 20% |
| recent_activity | 20% |
| transaction_history | 20% |
| reviews_reputation | 15% |
| community | 25% |

---

## Takeaways
When Robert says "t1", write findings to `docs/takeaways/CLAUDE_TAKEAWAYS_YYYY-MM-DD_HHMM.md` (UTC timestamp). When Robert says "s1", run `npm run s1` to synthesize into COMPREHENSIVE Section 21.

## Coverage Language
Use "fewer than 1% of licensed agents in covered markets" — never "top 0.2%".

## Dead Infrastructure
Cloudflare, Instantly, warm-cache, pre-render-*, Pipedrive, HubSpot — all deprecated. Do not use.
