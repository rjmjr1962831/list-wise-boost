# Cache Test Report — 2026-02-20

## Summary

**Finding: Bot traffic is NOT going through the Cloudflare Worker. The Worker cache is bypassed entirely.**

| Metric | Result |
|--------|--------|
| Cache HITs | 0/8 (0%) |
| X-Cache header | Not present on any response |
| Expected flow | Worker → Cache API → X-Cache: HIT or MISS |

---

## Test 1: Script (`check-cache-status.ps1`)

```
Label         Status SizeKB Cache List Agents
Home             200   83.5 -     n    n     
About            200   88.9 -     n    n     
Arizona state    200   83.6 -     n    n     
Phoenix          200   35.6 -     Y    Y     
LA               200   31.6 -     Y    Y     
Scottsdale       200   35.4 -     Y    Y     
Tucson           200   34.8 -     Y    Y     
San Diego        200   34.4 -     Y    Y     

Summary: 0/8 cache HITs | 3/8 responses >= 50 KB
```

---

## Test 2: Sequential Requests (cold → warm)

- **URL:** https://www.top10lists.us/about
- **User-Agent:** Googlebot/2.1
- **Request 1:** X-Cache = (empty)
- **Request 2:** X-Cache = (empty)

If the Worker cache were active, the second request would return `X-Cache: HIT`.

---

## Test 3: Full Headers (Phoenix list page)

**URL:** https://www.top10lists.us/arizona/phoenix/top10realestateagents

| Header | Value |
|--------|-------|
| CF-Ray | 9d10821cef02c0c4-PHX |
| CF-Cache-Status | DYNAMIC |
| X-Cache | **(not present)** |
| Content-Type | text/plain |
| x-bot-list | 1 |
| sb-gateway-version | 1 |
| sb-project-ref | wiotrvoirdgzfacuuiem |
| x-served-by | supabase-edge-runtime |

---

## Root Cause

The presence of **Supabase headers** (`sb-gateway-version`, `sb-project-ref`, `x-served-by`) in the client response shows that **the response is coming directly from Supabase**, not from the Cloudflare Worker.

When the Worker is in the path, it:
1. Checks Cache API
2. Returns a `new Response(body, { headers: { "X-Cache": "HIT" | "MISS", ... } })`
3. Does **not** forward upstream (Supabase) headers

So bot requests to www.top10lists.us are **bypassing the Worker**. Likely causes:

1. **Cloudflare Worker Routes** — www.top10lists.us may not be routed to the Worker; it may go to a different origin (e.g. Supabase custom domain).
2. **DNS / Proxy** — www may point to Supabase Edge (e.g. custom domain on Supabase).
3. **Worker not attached** — The Worker may not be bound to the www route.

---

## Recommendations

1. **Verify Cloudflare routing**
   - In Cloudflare Dashboard → Workers & Pages → top10-renderer (or equivalent)
   - Confirm the Worker is attached to `www.top10lists.us/*` or `*top10lists.us/*`

2. **Check DNS**
   - Ensure www.top10lists.us resolves to Cloudflare (CNAME to the zone), not directly to Supabase.

3. **After fixing routing**
   - Re-run: `.\scripts\check-cache-status.ps1`
   - Expect: First request per URL = X-Cache: MISS; second = X-Cache: HIT
   - Run warm-cache to prefill cache if needed.

---

## Worker Logic (Reference)

From `worker-index-default-deploy.js`:
- Bot request → `cache.match(cacheKey)`
- HIT → return with `X-Cache: HIT`
- MISS → fetch from Supabase (`serve-bot-list-html` or `serve-bot-static-html`), store in cache, return with `X-Cache: MISS`
