# Bot Analytics: ~100% Cache Miss – Diagnosis and Plan

## Diagnosis

### What the dashboard is actually measuring

- **Bot Analytics** reads `cache_status` from `cloudflare_request_logs`.
- That table is filled from **two** sources:
  1. **Cloudflare Logpush / Logpull** – Insert (or upsert) one row per request using **Cloudflare’s** cache fields: `CacheResponseStatus` or `CacheCacheStatus`. That is the **edge/CDN** cache layer.
  2. **log-bot-visit** (from Worker → queue → consumer) – Inserts one row per bot visit but **does not send `cache_status`**, so it stores `'UNKNOWN'` (or default). It also doesn’t send `ray_id`.

### Why you see almost all MISS

- For requests that hit your **Worker** (e.g. bot traffic to list/artifact pages), the flow is: **Bot → Cloudflare Edge → Worker**.
- The **edge** does not hold the Worker’s cached response (that lives in the Worker’s **Cache API**, i.e. `caches.default`). So from Cloudflare’s point of view, the edge cache is almost always **MISS** for Worker-handled requests.
- The Worker itself can still serve from its own cache and set `X-Cache: HIT`, but **that value is never written to the DB**. Logpush/Logpull only record edge cache status, and log-bot-visit doesn’t receive or store the Worker’s cache status.

So: **the dashboard is showing edge cache status, not Worker cache status.** That’s why you see ~3% hit rate (e.g. a few edge hits) and the rest MISS.

### Summary

| Layer            | What gets cached                    | What gets logged in `cache_status` |
|-----------------|-------------------------------------|-------------------------------------|
| Cloudflare edge | CDN cache (often not used for Worker responses) | ✅ Logpush/Logpull → HIT/MISS       |
| Worker          | `caches.default` (your real bot cache) | ❌ Not logged today                 |

Result: **Worker cache hits are invisible; only edge status is shown → ~100% misses.**

---

## Plan

### Goal

- Record and show **Worker** cache status (HIT/MISS from `caches.default`) for bot requests in the dashboard, and avoid double-counting or conflicting rows.

### Approach

1. **Worker**
   - Read **Ray ID** from the request: `request.headers.get('cf-ray')`.
   - **Order of operations:**  
     - Build cache key → `cache.match(cacheKey)` → set `cacheStatus = cachedResponse ? 'HIT' : 'MISS'`.  
     - **Then** enqueue the bot payload (so we know HIT vs MISS when we log).
   - Add to the queue payload: `cache_status: cacheStatus`, `ray_id: request.headers.get('cf-ray')` (and `host` if available from the request URL).

2. **Queue consumer**
   - Forward the new fields to log-bot-visit: `cache_status`, `ray_id`, `host` (from the message body), so the Edge Function can upsert by `ray_id` and store Worker cache status.

3. **log-bot-visit**
   - When `ray_id` is provided: **upsert** on `ray_id` and set `cache_status` (and optionally other Worker-derived fields like `agent_id`, list context). That way:
     - If **logpush inserted first** (edge MISS), we **update** that row with the Worker’s real `cache_status` (HIT/MISS).
     - If **log-bot-visit runs first** (e.g. queue faster than logpush), we **insert** with Worker’s `cache_status`; later logpush insert will hit unique `ray_id` and can be ignored (already handled in your pipeline).
   - When `ray_id` is missing: keep current behavior (plain insert, `cache_status` = payload or `'UNKNOWN'`).

4. **No change to Logpush/Logpull**
   - Keep inserting/upserting by `ray_id` as today. The only change is that log-bot-visit will **overwrite** `cache_status` for bot requests when it has Worker’s HIT/MISS, so the dashboard will reflect Worker cache, not edge.

### Files to touch

| Item            | Change |
|-----------------|--------|
| `worker-index-default-deploy.js` (then re-inject into `cloudflareworker.js`) | Move enqueue **after** cache lookup; add `cache_status` and `ray_id` (and host) to payload; read `request.headers.get('cf-ray')`. |
| `supabase/functions/setup-agent-notifications-queue/index.ts` | Update `CONSUMER_SCRIPT` so the body sent to log-bot-visit includes `cache_status`, `ray_id`, `host` from the queue message body. |
| `supabase/functions/log-bot-visit/index.ts` | If `ray_id` present: upsert on `ray_id` with `cache_status` (and other fields) from payload. If `ray_id` absent: insert as now. |

### Optional checks after deploy

- Trigger a bot request that hits a warmed URL: confirm one row in `cloudflare_request_logs` with `cache_status = 'HIT'`.
- Trigger a bot request to an uncached URL: confirm `cache_status = 'MISS'`.
- Run the existing cache-status script (e.g. `check-cache-status.ps1`) and cross-check with the dashboard for a few URLs.

---

## Short summary

- **Cause:** Dashboard shows **edge** cache status from Logpush/Logpull; your **Worker** cache (the one that actually serves bots) is not logged, so almost every request appears as MISS.
- **Fix:** Worker sends `cache_status` (HIT/MISS) and `ray_id` via the existing queue; consumer forwards them to log-bot-visit; log-bot-visit upserts by `ray_id` so Worker cache status overwrites edge status for bot requests. Then the dashboard will reflect real Worker cache hit rate.
