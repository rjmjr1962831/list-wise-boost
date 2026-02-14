# Production Outage Review and Prevention Plan

## 1. Executive Summary

The production site (https://www.top10lists.us) repeatedly went down or showed a generic error page after new code was deployed. Users saw a blank page or "Something went wrong" instead of the homepage. This document summarizes what went wrong, what was fixed, what remains uncertain, and a concrete plan to prevent recurrence.

---

## 2. What Went Wrong (Incident Summary)

### 2.1 Observed Symptoms

- **Blank page** – Full white/blank screen on load.
- **"Something went wrong"** – Error boundary fallback with "Try again" and sometimes "An alert has been sent to the admin."
- **Console errors** – Multiple different errors over time (see below).
- **CORS errors** – Browser blocking `POST` to Supabase `send-frontend-error-alert` from production origin, plus misleading "Error alert email sent" log.

### 2.2 Root Causes (Technical)

#### A. Broken references in the production bundle

- **IngestNeighborhoods is not defined**  
  Admin-only pages (e.g. `IngestNeighborhoods`, `NeighborhoodWriteups`) were lazy-loaded and used in route definitions. In the production build, the reference to these components was missing or wrong (chunk order / tree-shaking), so the app threw at runtime before rendering anything.
- **isAdmin is not defined**  
  Several components (Header, ProfessionalCard, FunnelIntro) used a local `isAdmin` state. In production, something (minification, scope, or code path) led to that identifier not being in scope at runtime, causing a `ReferenceError`.

**Why production differed from staging:**  
Production builds were made with `VITE_IS_PRODUCTION=1` (or similar) so admin routes and some admin logic were excluded or conditional. That changed which code was included and how it was bundled, and exposed broken references or undefined variables in the main bundle.

#### B. Unidentified throw during render

- A generic **`Error`** with **no message** was thrown during React render.
- Stack trace pointed only to minified names (e.g. `Te`, `hC`, `Pd`) and `Object.forEach`, consistent with React Router or React internals iterating over routes/children.
- **Possible contributors:**  
  - Conditional route tree (fragment of `Route` elements vs. lazy `AdminRoutes`) causing reconciliation or matching issues.  
  - **Browser extension:** Console showed `lockdown-install.js:1 SES Removing unpermitted intrinsics` (SES / Lockdown). Such extensions can alter or remove JavaScript intrinsics and cause otherwise valid code to throw.
- We never got a clear error message or component name; the throw could be in our code, React Router, or another dependency.

#### C. Error reporting making production worse

- The app’s **ErrorBoundary** tried to send errors to Supabase Edge Function `send-frontend-error-alert` from the production origin.
- The function (or its CORS config) did not allow requests from `https://www.top10lists.us`, so the browser blocked the request and logged CORS errors.
- The code still logged "Error alert email sent" even when the request failed, which was misleading and added noise.

#### D. No guardrails on deploy

- Code was merged to `main` and deployed without:
  - A production build smoke test (e.g. build with `VITE_IS_PRODUCTION=1` and basic load test).
  - A post-deploy health check (e.g. GET / returns 200 and expected content).
  - Automatic rollback or alert when the site is broken.

So broken states could go live and stay live until someone noticed.

---

## 3. What Was Done to Fix It

### 3.1 Bundle and Route Safety

- **Admin routes removed from production bundle**  
  Admin routes and their lazy imports were moved into a separate module (`AdminRoutes.tsx`) that is only loaded when `VITE_IS_PRODUCTION` is *not* set. Production builds never load this module, so no references to `IngestNeighborhoods` or other admin-only components exist in the production bundle.
- **Production-only route component**  
  When `VITE_IS_PRODUCTION` is set, production now uses a small `ProductionAdminRoutes` component that only renders 404 redirects for admin paths, instead of an inline fragment. This keeps the route tree consistent and may avoid reconciliation issues.
- **isAdmin always defined in production**  
  In Header, ProfessionalCard, and FunnelIntro, `isAdmin` is no longer only from `useState`. It is derived as `isProductionBuild ? false : adminState`, so the variable is always in scope and admin checks are skipped in production.

### 3.2 Error Handling

- **No alert from production origin**  
  The ErrorBoundary skips calling the Supabase alert when:
  - Build-time: `VITE_IS_PRODUCTION === "1"` (or `"true"`), or  
  - Runtime: hostname matches production (e.g. `www.top10lists.us`, `top10lists.us`) and not staging.  
  So production never triggers the CORS request or the misleading "Error alert email sent" log.
- **Alert only after success**  
  "Error alert email sent" is only logged after a successful `invoke`; failures are only logged as errors.
- **Error message on screen**  
  The boundary now shows the caught error’s message (or "(no message)") so that if it happens again, we have a visible clue.
- **HomeErrorBoundary**  
  The homepage route is wrapped in a dedicated boundary that can show message and component stack for errors that occur while rendering the home page.

### 3.3 What Is Still Uncertain

- The **exact source** of the generic `Error` (no message) is still unknown (our code vs. router vs. extension).
- Whether the **SES / Lockdown extension** is the sole trigger for some users; testing in incognito or without the extension was suggested but not confirmed in this review.
- Whether the **ProductionAdminRoutes** refactor fully eliminates the throw or only reduces likelihood.

---

## 4. Plan to Prevent This From Happening Again

### 4.1 Pre-Deploy: Verify Production Build Locally

- **Action:** Before merging to `main`, run a production build and optionally a minimal load test.
- **How:**  
  - Set `VITE_IS_PRODUCTION=1` (or match Vercel Production env).  
  - Run `npm run build`.  
  - Run `npm run preview` (or serve the `dist` output) and open `/` in the browser.  
  - Confirm the homepage loads and there are no console errors.
- **Owner:** Developer (or CI) before merging to `main`.  
- **Optional:** Add a script (e.g. `scripts/verify-production-build.sh`) that builds with `VITE_IS_PRODUCTION=1` and exits non-zero if build fails or a simple curl to local preview fails.

### 4.2 Deploy Pipeline: Post-Deploy Health Check

- **Action:** After every production deployment, run a health check that fails the deployment (or triggers an alert) if the site is broken.
- **How:**  
  - **Option A (Vercel):** Use a "Check" or GitHub Action that, after deploy, `curl`s `https://www.top10lists.us/` and verifies: status 200 and response body contains a known string (e.g. "Top10Lists" or a data attribute added for this purpose). If not, mark the deployment as failed or open an incident.  
  - **Option B (Vercel + rollback):** Same check; on failure, automatically trigger a rollback (e.g. redeploy the previous deployment via Vercel API or revert `main` and push).  
- **Owner:** DevOps / CI; can be implemented in GitHub Actions or Vercel Checks.  
- **Outcome:** Broken deploys are detected within minutes and can be rolled back instead of leaving production down.

### 4.3 Code and Bundle Discipline

- **Action:** Keep production bundle free of admin-only code and avoid throws that have no message.
- **How:**  
  - **Admin code:** Never import admin-only modules (e.g. `AdminRoutes`, admin pages) in the main app bundle when `VITE_IS_PRODUCTION` is set. This is already achieved by conditional loading of `AdminRoutes` and use of `ProductionAdminRoutes`.  
  - **No empty throws:** Add a lint rule or review guideline: disallow `throw new Error()` with no message (require e.g. `throw new Error('Descriptive message')`).  
  - **Stability:** Avoid changing the route tree structure (e.g. conditional fragments vs. components) without testing a production build; prefer a single component (like `ProductionAdminRoutes`) over inline fragments for conditional routes.
- **Owner:** Developers + optional ESLint rule.

### 4.4 Production Error Handling (No Cross-Origin from Prod)

- **Action:** Never call external or cross-origin endpoints from the ErrorBoundary when the request is from the production origin.
- **How:**  
  - Already done: skip Supabase `send-frontend-error-alert` when build or hostname indicates production.  
  - Keep this logic and document it (e.g. in this file or in ErrorBoundary comments).  
  - If production error reporting is needed later, use a same-origin API or a CORS-allowed endpoint and document the contract.
- **Owner:** Developers; no new code required beyond what’s in place.

### 4.5 Rollback and Runbook

- **Action:** Document how to roll back a bad production deploy and how to verify production locally.
- **How:**  
  - **Rollback:** In Vercel dashboard, use "Rollback" to the last known good deployment; or revert the merge on `main` and push so Vercel redeploys the previous commit.  
  - **Verify locally:** Document in README or this doc: `VITE_IS_PRODUCTION=1 npm run build && npm run preview`, then open `/` and check console.  
  - **Runbook:** Short runbook (e.g. in `docs/RUNBOOK.md`) with: "Production down?" → Check Vercel deployment status → Check health endpoint or manual load of / → If broken, rollback per above → Then investigate in staging/preview.
- **Owner:** Team; maintain the doc and link it from README or project wiki.

### 4.6 Optional: Staging Gate Before Main

- **Action:** Require that staging (or a preview deployment with production-like env) is verified before merging to `main`.
- **How:**  
  - Policy: "Merge to main only after staging (or preview with VITE_IS_PRODUCTION=1) has been opened and homepage loads without errors."  
  - Optional: GitHub branch protection that requires a "staging verified" check (manual or automated) before allowing merge to `main`.
- **Owner:** Team lead / process.

---

## 5. Summary Table

| Risk | Mitigation | Status |
|------|------------|--------|
| Admin/broken refs in prod bundle | Admin in separate chunk; prod uses ProductionAdminRoutes only | Done |
| isAdmin (or similar) undefined in prod | Derive from build flag so always in scope in prod | Done |
| CORS + misleading "alert sent" from prod | Skip Supabase alert when prod hostname/build | Done |
| Unknown throw (no message) | Show error message in boundary; HomeErrorBoundary for /; consider extension | Partially done; root cause still unknown |
| No verification before deploy | Local prod build + preview before merge to main | Plan |
| No detection after deploy | Post-deploy health check (curl + content check) | Plan |
| No rollback when broken | Document rollback; optional auto-rollback on health failure | Plan |
| Repeat of empty throw | Lint: no `throw new Error()` without message | Plan |

---

## 6. Suggested Next Steps (for Gemini or Team Review)

1. **Implement post-deploy health check** (e.g. GitHub Action or Vercel Check that hits `https://www.top10lists.us/` and verifies 200 + expected content).  
2. **Add ESLint (or similar) rule** to forbid `throw new Error()` with an empty or missing message.  
3. **Add `scripts/verify-production-build.sh`** (or npm script) that runs `VITE_IS_PRODUCTION=1 npm run build` and optionally a quick smoke request to local preview.  
4. **Write a short RUNBOOK.md** with rollback steps and local verification steps.  
5. **Optionally** test production in a browser without the SES/Lockdown extension (or in incognito) to confirm whether the generic Error is extension-induced; if yes, consider documenting "known incompatible extensions" or adding a try/catch around a minimal router render path and logging a clearer message.

This document is intended to be shared with Gemini (or another reviewer) for a second opinion on the analysis and the prevention plan.
