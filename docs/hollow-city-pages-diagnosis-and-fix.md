# Hollow City Pages (Phoenix, LA) — Diagnosis & Fix Plan

## What’s happening

| Page        | Size   | H1  | Agent cards | H2/H3 | JSON-LD blocks |
|------------|--------|-----|-------------|-------|----------------|
| Phoenix    | 65KB   | 1   | 0           | 0     | 4              |
| LA         | 65KB   | 1   | 0           | 0     | 4              |
| Scottsdale | 225KB  | 3   | 1           | 27    | 21             |
| Greyhawk   | 188KB  | 3   | 0           | 24    | 20             |

Phoenix and LA are serving the **React shell plus static H1** only. No agent cards, no market content, no list JSON-LD. AI crawlers get a title and nothing citable.

---

## Root cause

1. **Worker captures too early on list pages**
   - Worker uses `page.goto(..., waitUntil: "domcontentloaded")` then races:
     - `[data-artifact-id]` (7s)
     - `article` (7s)
     - `main` with `textContent.length > 800` (5s)
   - City list pages render `<main>` from the root layout immediately. The H1 (“Top Agents: Phoenix, AZ”) plus a few lines can exceed 800 characters **before** the client fetches agents and renders cards.
   - So the worker often “wins” the race on the shell and captures **before** agent list content exists.

2. **Hollow response gets cached**
   - Whatever the worker captures (including the 65KB shell) is stored with `caches.default.put(...)` and `Cache-Control: max-age=604800`.
   - So a single early capture can serve as the cached response for a long time.

3. **Why Scottsdale / neighborhoods look fine**
   - They were either cached later (after content was built), warmed with full HTML, or get more bot traffic so they re-render and eventually get a good capture.

4. **No purge path for bad entries**
   - `purge-worker-cache` calls `POST https://www.top10lists.us/__purge` with a URL list, but the worker **does not implement `/__purge`**. So we can’t clear known-bad URLs from the worker cache today.

---

## Fix plan

### 1. Worker: list-specific wait (capture only after list content exists)

- **Detect list URLs:** path includes `top10realestateagents` (city/neighborhood list pages).
- **For list URLs only:** after `page.goto`, wait for at least one of:
  - `[itemtype*="RealEstateAgent"]` (agent card in DOM), or
  - `script[type="application/ld+json"]` containing `"ItemList"` and `main` text length > 15_000,
  with a **12s timeout**. If it times out, keep current behavior (race with 800-char / article / artifact) so we don’t break slow pages.
- **Leave non-list pages unchanged** (artifact pages, static pages, etc.).

Effect: City/neighborhood list pages are only captured after agent content or rich list JSON-LD is present, reducing hollow shells.

### 2. Worker: don’t cache hollow list responses

- After generating the response for a **list URL** (same path check):
  - If the captured HTML has **no** agent/list content (e.g. no `ItemList` in JSON-LD scripts, and no `RealEstateAgent` in the DOM), or length < ~50KB:
  - **Do not** call `caches.default.put(cacheKey, response)`.
  - Still **return** the response to the client (so the bot gets something), but the next request will trigger a new render and have another chance to get a full page.
- Optionally: if we have a clear “hollow” signal (e.g. only 4 JSON-LD blocks and no ItemList), use that instead of or in addition to size.

Effect: Prevents new hollow entries from being cached; existing bad entries remain until purged or expired.

### 3. Worker: add `__purge` endpoint

- Handle `POST /__purge` with `X-Warm-Secret` (same as `__warm`).
- Body: `{ urls: string[] }` (full URLs, e.g. `https://www.top10lists.us/arizona/phoenix/.../top10realestateagents`).
- For each URL, build the same cache key as the worker uses (normalized URL + `User-Agent: bot-cache-normalized`) and call `caches.default.delete(cacheKey)`.
- Return JSON `{ purged: number }` (count of deleted entries).

Effect: `purge-worker-cache` Supabase function can clear Phoenix, LA, and any other known-bad URLs so they re-render and re-cache on next bot hit or warm.

### 4. One-time: purge known hollow URLs and re-warm

- After deploying the worker changes:
  - Call purge-worker-cache (or a one-off script) to purge at least Phoenix and LA list URLs.
  - Optionally run warm-cache for those URLs (with forceRefresh) so the worker repopulates cache with full content using the new wait logic.

### 5. Optional: find other hollow city pages

- Script or manual check: for each city list URL, request as a bot (or with `X-Force-Refresh`), inspect response size and presence of ItemList / agent cards; list URLs below a size threshold or without list content for follow-up purge + warm.

---

## Files to change

| File | Change |
|------|--------|
| `worker-index-default-deploy.js` | (1) List-URL wait for agent/ItemList; (2) skip caching hollow list responses; (3) add `POST /__purge` handler. |
| `cloudflareworker.js` | Same block as above (replace the same `index_default` / fetch + renderAndStore block so deployed worker matches). |
| `docs/hollow-city-pages-diagnosis-and-fix.md` | This doc. |

No Supabase or Vercel config changes required for the worker logic. Purge is already invoked by the existing `purge-worker-cache` Edge Function once the worker has `__purge`.

---

## Implementation status

- **Worker** (`worker-index-default-deploy.js` + `cloudflareworker.js`): List-specific wait (12s for agent/ItemList), skip caching hollow list responses, and `POST /__purge` handler are implemented.
- **Next steps for you:**  
  1. Deploy the worker (e.g. run `.\scripts\deploy-worker.ps1` or your usual Cloudflare deploy).  
  2. Purge Phoenix and LA list URLs: from admin, run “Purge worker cache” (purges full list from warm-cache) or call `purge-worker-cache` with a body that includes only the hollow URLs if you add that option.  
  3. Optionally re-warm those URLs (warm-cache with `forceRefresh` for Phoenix/LA) so the next bot gets full content; or let the next bot trigger a fresh render with the new wait logic.
