# GSC Coverage Remediation Plan (404, noindex, 5xx)

**Context:** Google Search Console coverage report (through Mar 2, 2026). Claude’s analysis highlighted: Feb 24 indexing spike (320 → 5,751), 10,606 discovered-not-indexed, 285 server errors (5xx), 800 noindex, 152 404s, 396 crawled-not-indexed.

---

## 1. Feb 24 indexing spike — what to confirm

**Git history (2026-02-17 → 2026-02-25)** shows likely contributors:

- **Arizona 0-agent geo fix** (search_location qualified-only, sitemap only includes cities/neighborhoods with ≥1 qualified agent). So sitemap stopped listing zero-agent URLs; Google may have recrawled and indexed only valid URLs.
- **Verification disclaimer** on city/neighborhood bot HTML (serve-bot-list-html).
- **Bot rendering:** Vercel rewrites send list/agent routes to `/api/serve-clean-html` → Supabase `serve-bot-list-html` / `serve-bot-agent-html`. **Cloudflare Worker + KV cache and Prerender.io are no longer used.** Worker cache read was disabled **Feb 20, 2026** (commits: “Disable Worker cache read”, “Master doc: Cloudflare Worker cache deprecated”); bot pages are served fresh from the edge function. So by Feb 24, Googlebot was consistently getting live HTML from Supabase (no cache layer). The spike may reflect a few days’ crawl lag after that change, or a sitemap/deploy on Feb 24.

**Recommended checks (you or team):**

1. **GSC → Settings → Change history** for any submitted sitemap or setting around Feb 21–24.
2. **GSC → Sitemaps:** Last submission date and “Discovered URLs” count.
3. **Vercel → Deployments:** Filter Feb 21–24; note deploy that went live just before the spike.
4. **Cloudflare Worker/KV:** Deprecation was **Feb 20** (not Feb 24). Worker cache read disabled; bot pages served fresh from edge function. No Prerender.io or Cloudflare caching in use now.

**Action:** Document the winning combination (sitemap + bot rendering + 0-agent geo fix) in `docs/` or runbook so it’s repeatable and not accidentally reverted.

---

## 2. 404s (152) — audit and fix plan

### 2.1 Where 404s come from in this codebase

| Source | Trigger | Response |
|--------|--------|----------|
| **React SPA** | No route match | `*` → `NotFound` (noindex, 200 + “404” content). GA4 `page_not_found` fired. |
| **Vercel** | `/admin`, `/admin/:path*` on production host | Redirect to `/404` (so admin URLs become 404 page). |
| **Vercel** | `/MASTER_KNOWLEDGE_DOCUMENT*` | Redirect to `/404`. |
| **CityLanding** | City not in DB or invalid state | `<Navigate to="/404" replace />`. |
| **ClaimRedirect** | Invalid/missing token | `<Navigate to="/404" replace />`. |
| **NeighborhoodZipCategoryRouter** | No neighborhood/ZIP/category match | `<Navigate to="/404" replace />`. |
| **NeighborhoodCategoryRouter** | Neither agent nor neighborhood match | `<Navigate to="/404" replace />`. |
| **AgentProfile** | Agent/city/category not found or API error | `<Navigate to="/404" replace />`. |
| **CanonicalAgentProfile** | Same + rawDbProf missing | `<Navigate to="/404" replace />`. |
| **Funnel steps** (Step1–7, WelcomeInterstitial, etc.) | Missing token or bad data | `navigate('/404')`. |
| **AdminRouteGuard** | Production host | `<Navigate to="/404" replace />`. |

So 404s are either:

- **Intentional:** Wrong/missing slug, old URL, or deactivated city/neighborhood/agent.
- **Broken links:** Internal or external links pointing to URLs that no longer exist or never existed.

### 2.2 404 remediation steps

1. **Export 404 URLs from GSC**  
   GSC → Indexing → Pages → filter “Not found (404)” → export the list (or use URL Inspection / Search Analytics for sample).

2. **Classify URLs**  
   - Old state/city/neighborhood/agent paths (e.g. typo, renamed slug, removed city).  
   - Old funnel/claim/magic-link URLs.  
   - Staging or test URLs that reached production (e.g. vercel.app).  
   - Legitimate content that should exist (bug).

3. **Fix or redirect**  
   - **Broken internal links:** Fix hrefs in app (e.g. `DynamicCategoryList`, `CityLanding`, nav, footer) and in bot HTML (e.g. `serve-bot-list-html`, `serve-bot-agent-html`) so they don’t point to invalid paths.  
   - **Renamed/removed resources:** Add **301 redirects** in `vercel.json` from old URL to the best live equivalent (e.g. old city URL → state hub or homepage).  
   - **No equivalent:** Keep 404; ensure `NotFound` stays noindex (already is) and returns 404 status if you later add server-side 404 (see below).  
   - **Bulk redirects:** Use `scripts/gsc-404-to-vercel-redirects.js`. Export 404 URLs from GSC (one per line or CSV with URL in first column), then run `node scripts/gsc-404-to-vercel-redirects.js gsc-404-export.csv` to get a JSON array of `{ source, destination: "/404", permanent: false }`. For custom destinations use lines like `oldPath,newPath`. Merge the output into `vercel.json` → `redirects`.

4. **Optional: real HTTP 404 for SPA**  
   Right now the SPA serves 200 with 404 content. For a cleaner signal to Google you can:  
   - Add a Vercel “rewrite” that returns 404 only for known-invalid paths (e.g. a small list or pattern), or  
   - Use a middleware/edge function that returns 404 when the path is explicitly in a “404 list.”  
   This is secondary to fixing and redirecting bad URLs.

**Owner:** Dev + your review of GSC 404 list.  
**Effort:** 1–2 hours to export, classify, then 1–3 hours to add redirects and fix links.

---

## 3. noindex (800) — confirm intent

### 3.1 Where noindex is set

**Staging-only (production is indexable):**

- **Root and pre-rendered HTML:** Script in `index.html` and built `public/*/index.html` adds `robots: noindex, nofollow` only when `hostname === 'staging.top10lists.us'` or `hostname.includes('vercel.app')`. Production (www.top10lists.us) does not get this.
- **Vercel:** `vercel.json` sends `X-Robots-Tag: noindex, nofollow` only for host `staging.top10lists.us`.

**By design (should stay noindex):**

- **Admin / profile / funnel / dashboard:** AdminLogin, AgentDashboard, profile pages (AccountSetup, EditProfile, ClaimListingPreview, FunnelSuccess, etc.), funnel steps (Step1–Step7, FunnelIntro, etc.), DashboardByToken, MagicLinkRouter, AgentSetup, VerifyAgentListing, VisibilityCoveragePage, BadgeInstructionsPage, PaymentSuccess, AgentOnboarding, etc.
- **Agent profile pages (canonical and legacy):** AgentProfile, CanonicalAgentProfile (both noindex).
- **Utility / test:** ZillowPayToPlayPage, NotFound (404 page), AreaAgentsPage, QualifiedAgentsPage, NeighborhoodApply, BotAnalyticsDashboard (reporting main only).
- **State landing pages for non-live states:** StateLanding sets noindex when state is not in `INDEXABLE_STATES` (e.g. Texas, Florida, New York, Colorado).
- **City/neighborhood list pages for non-AZ/CA:** DynamicCategoryList sets noindex when `!INDEXABLE_STATES.includes(city.state_slug)` (only Arizona and California are indexable).
- **Zero-agent city landing:** CityLanding sets `noindex, follow` when `shouldNoindex` (state not indexable).

**Worth a quick check:**

- **QuestionPage:** One branch sets `<meta name="robots" content="noindex" />` (line ~752). Confirm that’s only for a specific question type you don’t want indexed (e.g. test or low-value query).

### 3.2 noindex audit action

1. **GSC:** Export the list of URLs reported as “noindex” (Indexing → Pages → filter by noindex).
2. **Classify:**  
   - Staging/vercel.app → ignore or block via robots if they keep getting crawled.  
   - Admin, profile, funnel, dashboard, agent profile pages → confirm intentional.  
   - State/city/neighborhood pages in TX/FL/NY/CO → intentional (not yet indexable).  
   - Any **main marketing or list URLs** (e.g. `/arizona/phoenix/top10realestateagents`, `/join`, `/faq`) → if they appear as noindex, treat as bug (likely staging URL in report or a one-off).
3. **Fix only if wrong:** If a page you want indexed has noindex, remove the condition that sets it (e.g. in QuestionPage or a wrong `shouldNoindex`).

**Owner:** You + dev.  
**Effort:** ~30 min to export and classify; fix only if something is misconfigured.

---

## 4. Server errors — 5xx (285)

### 4.1 Likely causes

- **Supabase Edge Functions:** Vercel rewrites send list and agent traffic to `/api/serve-clean-html` → Supabase `serve-bot-list-html` and `serve-bot-agent-html`. Timeouts or errors there become 5xx to the crawler.
- **Supabase DB:** Slow or failing queries (e.g. by slug, city_id, agent id) can cause the function to return 500.
- **Vercel/serverless:** Cold starts or timeouts for the API route that proxies to Supabase.

### 4.2 Diagnosis steps

1. **GSC:** Export URLs with “Server error (5xx)” (Indexing → Pages).
2. **Patterns:** See if they’re mostly:
   - `/:state/:city/top10realestateagents`
   - `/:state/:city/:neighborhood/top10realestateagents`
   - `/:state/agents/:slug`
   - Or a specific state/city/agent.
3. **Logs:**  
   - **Vercel:** Project → Logs / Functions; filter by time and path.  
   - **Supabase:** Dashboard → Edge Functions → Logs for `serve-bot-list-html`, `serve-bot-agent-html`; check for timeouts, 500, and which path/params.
4. **Reproduce:** Curl or browser the failing URLs (with a Googlebot UA if needed). Check response code and body.

### 4.3 Fixes (after diagnosis)

- **Timeouts:** Increase function timeout or optimize queries (indexes, limit fields, cache).
- **Missing data:** Handle “no agent/city/neighborhood” with 404 (or redirect) instead of 500.
- **Rate/limits:** If Supabase or Vercel is throttling, consider caching (e.g. Cloudflare KV or Vercel cache) for bot HTML.

**Owner:** Dev + infra.  
**Effort:** 1–2 hours to identify; 2–4 hours to fix and re-verify.

---

## 5. Discovered — not indexed (10,606) and Crawled — not indexed (396)

Claude’s take: often **thin or duplicate content**. For a directory, that can mean:

- City or neighborhood pages with very little text.
- Many list pages that look similar to Google.
- Agent pages with minimal unique content.

**Possible actions (no code changes in this doc):**

- Add unique, useful copy per city/neighborhood (e.g. short market overview, criteria blurb) in `serve-bot-list-html` and in the SPA.
- Ensure list and agent pages have strong, unique titles and meta descriptions (and JSON-LD) so Google can tell them apart.
- Keep sitemap limited to qualified-only URLs (already done); avoid submitting very thin or duplicate URLs.

**Owner:** Content/SEO + dev.  
**Effort:** Ongoing; prioritize after 404 and 5xx are under control.

---

## 6. Priority order (recommended)

| Priority | Item | Action | Effort |
|----------|------|--------|--------|
| 1 | Document Feb 24 win | GSC + Vercel + git; write short “what we did” doc | ~30 min |
| 2 | 5xx errors | Export URLs → logs → fix timeouts/missing-data/errors | 2–4 h |
| 3 | 404s | Export → classify → redirects + fix internal links | 2–3 h |
| 4 | noindex | Export → confirm intentional; fix if any wrong | ~30 min |
| 5 | Discovered/crawled not indexed | Improve content/unicity; noindex/remove thin URLs from sitemap if needed | Ongoing |

---

## 7. Quick reference — where things live

- **404 handling:** `src/pages/NotFound.tsx`, `src/routes/manifest.tsx` (`path: "*"`), redirects in `vercel.json`, and `Navigate to="/404"` in CityLanding, ClaimRedirect, AgentProfile, CanonicalAgentProfile, NeighborhoodCategoryRouter, NeighborhoodZipCategoryRouter, funnel steps, AdminRouteGuard.
- **noindex (staging only):** `index.html` and pre-rendered `public/*/index.html` (script), `vercel.json` headers for `staging.top10lists.us`.
- **noindex (by design):** Many components under `src/pages/` (see Section 3.1); `DynamicCategoryList` and `CityLanding` for non-indexable state or zero-agent.
- **Sitemap (qualified-only):** `supabase/functions/generate-sitemap/index.ts` (cities with ≥1 qualified agent; neighborhoods via `get_neighborhood_ids_with_qualified_agents`). Sitemaps referenced in `api/robots.js` and `public/robots.txt`.
- **Bot HTML (can return 5xx):** Vercel rewrites → `api/serve-clean-html.js` → Supabase `serve-bot-list-html`, `serve-bot-agent-html`, `serve-bot-state-html`.

---

## 8. GEO audit follow-up (Mar 6, 2026)

- **Schema / Rich Results:** Organization + WebSite + FAQPage JSON-LD are in `index.html`; city/neighborhood bot HTML has ItemList. Run [Google Rich Results Test](https://search.google.com/test/rich-results) on the homepage and on one city page (e.g. Scottsdale) to confirm they are detected.
- **10,606 discovered-not-indexed:** Likely thin city/neighborhood pages. Options: enrich local market content per page, or consolidate low-agent pages into city-level rollups. See priority table (Section 6) item 5.
