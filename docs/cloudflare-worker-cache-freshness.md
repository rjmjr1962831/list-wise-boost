# Cloudflare Worker: Static Page Cache Freshness

**Short answer:** The worker does **not** guarantee fresh data daily on its own. It refreshes only when (1) a bot hits a cached page that is older than 24 hours, or (2) the `warm-cache` function overwrites the cache. Scheduled warming on the **current** Supabase project may not be configured.

---

## How the worker behaves today

### 1. Cache read (bot request)

- Bot request hits the worker.
- Worker looks up `caches.default` with a normalized cache key (URL + bot User-Agent).
- **If HIT:**  
  - Returns the cached response with `X-Cache: HIT`.  
  - If the cached response is **older than 24 hours** (using the `Date` header), the worker triggers a **background** re-render via `ctx.waitUntil(renderAndStore(...))`.  
  - The **current** request still gets the **stale** response; the **next** request (after the background job completes) gets fresh content.
- **If MISS:** Worker runs `renderAndStore` (Puppeteer), stores the result, and returns it.

So: “fresh daily” only happens for a given URL if at least one bot hits it at least every ~24h. The first bot after 24h still sees old content; the one after the background re-render sees new content.

### 2. Cache write (render or warm)

- **On render (Puppeteer):** Stored response has  
  `Cache-Control: public, max-age=604800, stale-while-revalidate=31536000`  
  (7 days).
- **On `/__warm` (warm-cache):** Stored response has  
  `Cache-Control: public, max-age=604800`  
  (7 days).

The Cache API stores the response; the worker does **not** expire it. Content can stay in cache for up to 7 days unless:

- A bot triggers the 24h SWR re-render (and the new response overwrites the entry), or  
- Something (e.g. `warm-cache`) writes the same cache key again.

### 3. Warm-cache and crons

- **warm-cache** (Supabase Edge Function) can refresh the worker cache by calling `https://www.top10lists.us/__warm` with `X-Warm-Secret` and body `{ url, html }`. It warms static pages, cities, and neighborhoods.
- **Scheduled warming:**  
  - **warm-cache-continuous** (every 10 min): `start_warm_cache_cron()` uses `app.settings.service_role_key` from the DB. Set that in project **wiotrvoirdgzfacuuiem** (e.g. Vault or `ALTER DATABASE ... SET app.settings.service_role_key = '...'`) or the cron will call warm-cache with an empty Bearer and get 401.  
  - **warm-top-markets** (every 6 hours): now also uses `app.settings.service_role_key` (same as above).
- If those settings are not set, **automatic** cache warming does not run; manual warm-cache from the admin UI still works (it uses the edge function’s env secrets).

---

## Is static content “fresh daily”?

| Scenario | Fresh daily? |
|----------|---------------|
| Page gets bot traffic at least every 24h | Yes, **after** the first bot post-24h (that bot gets stale; next gets fresh). |
| Page rarely or never hit by bots | No. Cache can stay up to 7 days unless warm-cache (or similar) overwrites it. |
| warm-cache runs daily (e.g. cron on current project) | Yes, for all URLs that warm-cache touches. |

So the worker alone does **not** guarantee “fresh data daily” for all static pages; it only does best-effort refresh when bots hit old cache (24h SWR).

---

## Recommendations for “fresh daily” static pages

1. **Run warm-cache daily on the current project**  
   Add a cron on **wiotrvoirdgzfacuuiem** that calls  
   `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/warm-cache`  
   once per day (e.g. after midnight MST). That overwrites the worker cache for static + configured city/neighborhood URLs so bots get at-most-1-day-old content.

2. **Optional: shorten worker cache TTL for “daily” semantics**  
   If you want the worker to treat cache as stale after 24h for the **current** request (so the first bot after 24h gets a fresh render instead of stale + background refresh), you could:  
   - When serving a HIT, if `cacheAge > 86400`, **don’t** return the stale response; instead call `renderAndStore` and wait for it, then return the new response.  
   - Or keep SWR as-is and rely on daily warm-cache for guaranteed freshness.

3. **Fix or add crons**  
   Update the warm-cache / warm-top-markets cron migrations to use **wiotrvoirdgzfacuuiem** and the correct service role (or auth) so scheduled warming actually runs against production.

---

## Reference: worker code locations

- **Cache read + 24h SWR:** `cloudflareworker.js` (and `worker-index-default-deploy.js`) – bot branch: if `cacheAge > 86400`, `ctx.waitUntil(this.renderAndStore(...))`; then return cached response.
- **Cache write (render):** `renderAndStore` – `Cache-Control: public, max-age=604800, stale-while-revalidate=31536000`.
- **Cache write (warm):** `/__warm` handler – `Cache-Control: public, max-age=604800`.
