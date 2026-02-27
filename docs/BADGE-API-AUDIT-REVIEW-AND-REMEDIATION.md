# Badge/API Audit Review and Remediation Plan

**Date:** 2026-02-26  
**Scope:** Verify audit conclusions, root causes, and three-layer fix; produce actionable remediation plan.  
**Reconciled with:** Top10Lists.us Link Integrity System (MASTER_BASELINE addendum).

---

## 0. Reconciliation with Link Integrity Doc

The Link Integrity System doc is adopted as the canonical spec for URLs, routing, env safety, and smoke tests. This plan aligns to it and adds the following:

| Item | Link Integrity doc | This plan |
|------|--------------------|-----------|
| **Implementation order** | Health → urls.ts → fix badge routes → smoke test → deploy workflow | Same. We add: fix Edge Function path parsing as part of “fix badge routes” (see below). |
| **`/api/v1/badge/{id}` route type** | Routing table says “Vercel API route” | **Current state:** `vercel.json` rewrites to Supabase `artifact-payload`. So today it is a **rewrite**, not a Vercel API route. To “inject key server-side” you would need to replace the rewrite with an API route. **Recommendation:** (1) Fix path parsing in `artifact-payload` and `artifact-verify` so the existing rewrite works. (2) Ensure Supabase Edge Function has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Supabase secrets (no Vercel injection). (3) Optionally later: move to Vercel API route if you want a single place for all serverless env. |
| **Badge V1 id vs slug** | Registry and smoke test use slug `a-tom-wood-team-1221` for Badge V1 | `artifact-payload` currently does `.eq("id", agentId)` (UUID). So either: (a) use a **known UUID** in the smoke test and document that v1 accepts UUID, or (b) extend `artifact-payload` to accept **canonical_slug** (lookup by `canonical_slug` when `agentId` is not a UUID). The Link Integrity doc implies slug should work; we adopt (b) so one canonical slug works for both `/api/badge/{slug}` and `/api/v1/badge/{slug}`. |
| **Path parsing bug** | Not mentioned | **Confirmed:** `artifact-payload` and `artifact-verify` use `pathParts[1]`, which is `"v1"` when the path is `.../functions/v1/artifact-payload/{id}`. Both must use the **last path segment** (and optionally support slug lookup as above). |

**Canonical sources from Link Integrity doc (use as-is):**

- **Layer 1:** `src/lib/urls.ts` — full code in doc (PROD_BASE, builders, `URL_REGISTRY`).
- **Layer 2:** `api/_lib/requireEnv.ts` (`requireSupabaseAdmin()`), `api/health.ts` — full code in doc.
- **Layer 3:** `scripts/smoke-test.ts` — full code in doc; add `"smoke-test": "tsx scripts/smoke-test.ts"` to `package.json`.
- **Routing map, env var rules, pre-flight checklist, definition of done** — all from doc (see Section 6 below).

**Update to Link Integrity doc’s “Current Known Failures” table:** For `/api/v1/badge/{id}`, add root cause **“Path parsing bug in Edge Function (pathParts[1] → use last segment); optionally support canonical_slug.”** and fix **“Fix path in artifact-payload and artifact-verify; add slug lookup in artifact-payload.”**

---

## 1. Audit Conclusions — Verified

| Claim | Verified | Evidence |
|-------|----------|----------|
| `/api/badge/{slug}` returns `{"agent":null,"error":"config_error"}` | **Yes** | `api/badge/[agentId].js` lines 80–85: returns `config_error` when `process.env.SUPABASE_SERVICE_ROLE_KEY` is missing. So production is either missing this env var for the serverless function or it is not exposed to the correct Vercel environment (e.g. Production vs Preview). |
| `/api/v1/badge/{id}` returns `{"error":"Certification not found"}` | **Yes** | Rewrite in `vercel.json` sends to Supabase Edge Function `artifact-payload`. The function uses **`pathParts[1]`** for the agent id (line 22). When the request URL is `.../functions/v1/artifact-payload/{id}`, pathParts = `['functions','v1','artifact-payload', id]`, so **pathParts[1] = 'v1'**, not the actual id. The function therefore looks up `.eq("id", "v1")` and always gets no row → "Certification not found". **Root cause: path index bug in Edge Function.** |
| `/api/health` returns 404 | **Yes** | No `api/health.js` or `api/health.ts` exists in the repo. |
| Artifacts, profiles, SPA work | **Assumed** | Not re-tested here; audit stated they are working. |

**Additional finding:** The same **path index bug** exists in **`artifact-verify`** (uses `pathParts[1]`). **`badge-image`** is correct: it uses `pathParts[pathParts.length - 1]`.

---

## 2. Root Causes — Validated and One Addition

| Root cause | Validated | Notes |
|------------|-----------|--------|
| No single source of truth for URLs | **Yes** | URLs built in many places: `api/badge/[agentId].js`, `public/widget/badge.js`, `BadgeInstructionsPage.tsx`, `supabase/functions/badge-issue/index.ts`, `vercel.json` rewrites, CRM/templates, etc. No `src/lib/urls.ts` or equivalent. |
| Vercel routing / rewrites confusion | **Yes** | `/api/v1/badge/*` are rewrites to Supabase; `/api/badge/*` is a Vercel serverless route. Two different implementations and path semantics (slug vs UUID). |
| Env vars disappearing | **Yes** | `config_error` on `/api/badge/{slug}` = missing `SUPABASE_SERVICE_ROLE_KEY` in serverless. VITE_* are build-time; serverless needs env vars set in Vercel (Production + Preview if needed). No health check to fail fast. |
| No smoke tests | **Yes** | No `scripts/smoke-test.ts`; breakage is found manually. |
| No health endpoint | **Yes** | None implemented. |

**Additional root cause:**  
- **Path parsing bug in Edge Functions:** `artifact-payload` and `artifact-verify` use `pathParts[1]` instead of the last path segment. So even with correct env and routing, `/api/v1/badge/{uuid}` would fail until this is fixed.

---

## 3. Three-Layer Fix — Assessment

| Layer | Proposal | Assessment |
|-------|----------|------------|
| **Layer 1 — URL registry** (`src/lib/urls.ts`) | Single module for every generated URL; typed registry with route type, auth, required env. | **Agree.** Reduces drift and duplicate string concatenation. Plan: add `src/lib/urls.ts`, then migrate call sites (widget, CRM, Edge Functions, API routes) over time. |
| **Layer 2 — Env safety** (`api/_lib/requireEnv.ts` + `api/health.ts`) | Fail loud on missing keys; `/api/health` returns key status (e.g. booleans, no secrets). | **Agree.** Unblocks diagnosing `config_error` and prevents silent degradation. Plan: add `requireEnv` helper, add `api/health.ts` that checks required keys and returns 200 + JSON with key names and boolean status. |
| **Layer 3 — Smoke tests** (`scripts/smoke-test.ts`) | Run after every deploy; hit every registered URL; red = stop, green = proceed. | **Agree.** Plan: script that calls URL registry (or a static list) and asserts status/content; run in CI or as a post-deploy step. |

---

## 4. Implementation Order (from Link Integrity doc + path/slug fixes)

Execute in this exact order.

### Step 1: Create `api/health.ts` and `api/_lib/requireEnv.ts`

- Add `api/_lib/requireEnv.ts` with `requireSupabaseAdmin()` (exact code from Link Integrity doc).
- Add `api/health.ts` (exact code from doc): returns `ok`, `timestamp`, `env: { hasSupabaseServiceRoleKey, hasSupabaseUrl, hasSupabaseAnonKey, nodeEnv }`, `version`. No secrets.
- Deploy to staging.
- Hit `https://staging.top10lists.us/api/health` — confirm all env vars show `true`.
- If any show `false`, fix in Vercel (Production + Preview + Development as needed) → redeploy → recheck.

### Step 2: Create `src/lib/urls.ts`

- Add the URL registry and all builder functions from the Link Integrity doc (PROD_BASE, buildUrl, agentProfileUrl, artifactUrl, badgeApiUrl, badgeV1ApiUrl, etc., URL_REGISTRY).
- Run codebase-wide search for hardcoded URLs and replace with builders (see doc):
  - `top10lists.us`, `/artifact/`, `/dashboard/`, `/api/badge`, etc. in `src/`, `api/`, `supabase/`.

### Step 3: Fix badge API routes and Edge Functions

- **Vercel API route `/api/badge/{slug}`:** Use `requireSupabaseAdmin()` at the top; remove any env fallback. Ensure `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are set in Vercel for all environments and redeploy.
- **Edge Functions (rewrite path):**  
  - **Path parsing:** In `artifact-payload/index.ts` and `artifact-verify/index.ts`, replace `pathParts[1]` with the **last path segment** (e.g. `pathParts[pathParts.length - 1]`).  
  - **Slug support (artifact-payload):** So that `/api/v1/badge/{slug}` works like the registry: if `agentId` is not a UUID, lookup by `canonical_slug`; otherwise by `id`. Return 302 to artifact URL or appropriate error.  
  - Redeploy both Edge Functions. Ensure Supabase Edge Function secrets include `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (rewrites cannot inject from Vercel).
- Test on staging: `/api/badge/a-tom-wood-team-1221` and `/api/v1/badge/a-tom-wood-team-1221` return expected data, not `config_error` or "Certification not found".

### Step 4: Create `scripts/smoke-test.ts`

- Add the full smoke test from the Link Integrity doc (tests: health, homepage, for-ai, llms.txt, state/city/city rankings, agent profile, artifacts, badge API, badge V1 API, dashboard magic link).
- Add to `package.json`: `"smoke-test": "tsx scripts/smoke-test.ts"`.
- Run against staging: `npm run smoke-test -- --base=https://staging.top10lists.us`.
- Fix any red tests before proceeding.

### Step 5: Run full smoke test against production

- After production deploy: `npm run smoke-test`.
- All green → done for this phase. Any red → fix before further work.

### Step 6: Add smoke test to deploy workflow

- In CI or post-deploy: run `npm run smoke-test` automatically after every Vercel deploy (e.g. GitHub Action or Vercel deploy hook).

---

## 5. Summary

- **Audit conclusions:** Correct. `/api/badge` fails with `config_error` (missing env), `/api/v1/badge` fails with "Certification not found" (path bug + slug not supported), `/api/health` is 404.
- **Root causes:** All five from the Link Integrity doc confirmed; add **path index bug** in `artifact-payload` and `artifact-verify`.
- **Three-layer fix:** Adopted from Link Integrity doc (urls.ts, requireEnv + health, smoke-test.ts). Implementation order: Steps 1–6 above; path fix and slug support in Step 3.

---

## 6. Routing Map, Env Rules, Pre-Flight, Definition of Done (from Link Integrity doc)

### Routing map (consult before touching vercel.json or API routes)

| URL Pattern | Route Type | Auth | verify_jwt | Env Vars Needed | Notes |
|-------------|-------------|------|------------|-----------------|-------|
| `/{state}` | SPA | None | N/A | None | |
| `/{state}/{city}` | SPA | None | N/A | None | |
| `/{state}/{city}/top10realestateagents` | SPA | None | N/A | None | |
| `/{state}/agents/{slug}` | SPA | None | N/A | None | |
| `/artifact/{token}` | Rewrite → Edge | None | `false` | None | Must be public |
| `/dashboard/{token}` | SPA | Token-based | N/A | None | |
| `/api/badge/{slug}` | Vercel API route | None | N/A | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | |
| `/api/v1/badge/{id}` | Rewrite → Edge (today); optionally API route later | None | `false` | Supabase secrets for Edge | Path fix + slug support in Edge Function |
| `/api/health` | Vercel API route | None | N/A | All | Diagnostic |
| `/for-ai`, `/llms.txt`, etc. | SPA / Static / Rewrite | None | N/A | As needed | |

### Routing rules (non-negotiable)

1. Direct Supabase rewrites **cannot** add Authorization headers. Any path that must use `SUPABASE_SERVICE_ROLE_KEY` in Vercel **must** go through a Vercel API route that calls `requireSupabaseAdmin()`.
2. Public read-only Edge Functions must set `verify_jwt = false` in Supabase.
3. No env var fallback chains: missing key → 500 with explicit message.
4. In `api/` routes use only `process.env.SUPABASE_*` (no VITE_ prefix).

### Env var rules

| Variable | Where | Who uses it |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | Client build | Browser Supabase client |
| `VITE_SUPABASE_ANON_KEY` | Client build | Browser Supabase client |
| `SUPABASE_URL` | Vercel API routes | `requireSupabaseAdmin()` |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel API routes | `requireSupabaseAdmin()` |
| `SUPABASE_ANON_KEY` | Vercel API (if needed) | No fallback from service role |

After any env change: redeploy and hit `/api/health`.

### Pre-flight checklist (before any routing/URL change)

- [ ] Is this path a direct rewrite or a Vercel API route?
- [ ] Does the target require SUPABASE_SERVICE_ROLE_KEY?
- [ ] If yes, is auth injected server-side in an API route (not a rewrite)?
- [ ] Does the Edge Function need CORS?
- [ ] Which env vars are required? Confirmed via `/api/health`?
- [ ] Is the URL built via `src/lib/urls.ts`?
- [ ] If new pattern, added to smoke test?

If you can’t answer all seven, stop and ask Robert.

### Definition of done (URL/link/API changes)

Not done until:

1. All URLs generated via `src/lib/urls.ts` (no inline string construction).
2. `/api/health` returns `"ok": true` with all env vars present.
3. `npx tsx scripts/smoke-test.ts` passes (zero failures).
4. If CRM/email: real test email to `rjmjr1@proton.me`, every link clicked → correct production page.
5. If new URL pattern: added to `URL_REGISTRY` and smoke test.
6. Pre-flight checklist completed and documented in PR.
