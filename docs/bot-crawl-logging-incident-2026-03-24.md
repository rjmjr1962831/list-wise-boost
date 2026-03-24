# Bot Crawl Logging Incident — March 24, 2026

## Timeline

### Baseline (Mar 17–23)
- **Total crawls:** ~143,000/day (7-day average)
- **Meta-ExternalAgent:** ~85,000/day (60% of traffic)
- **Non-Meta bots:** ~24,000–77,000/day (Googlebot, GPTBot, Applebot, PerplexityBot, AhrefsBot, etc.)
- **Logging mechanism:** All bot crawl logging was handled by `api/serve-clean-html.js` (Vercel serverless proxy function). Every request to a clean-room HTML page passes through this proxy.

### The Drop — Mar 24, 00:00 UTC (5:00 PM MST Mar 23)

At exactly midnight UTC on March 24, crawl logging dropped catastrophically:

**Minute-by-minute at the drop:**
```
23:59 UTC Mar 23: 119 crawls/min (75 Meta + 44 non-Meta)
00:00 UTC Mar 24:   7 crawls/min (4 Meta + 3 non-Meta)
```

**What happened at midnight UTC:** A production deploy (`npm run merge-to-main` / ptm) pushed commit `762fa7ec` to main, triggering a Vercel production build. The deploy included the Vercel CDN purge (`vercel --force`).

### Phase 1: Meta recovers briefly, then dies (00:00–02:20 UTC)

After the initial cold-start dip, Meta resumed crawling at near-normal rates:
```
00:05: 90/min (88 Meta)
01:10: 777/min (763 Meta)
02:10: 1,113/min (1,100 Meta) ← peak
02:20: 80/min (68 Meta) ← cliff drop
02:30: 48/min (40 Meta)
03:50: 20/min (0 Meta) ← Meta gone
```

Meta-ExternalAgent stopped crawling entirely at ~02:20 UTC and has not returned as of this writing (21:00 UTC Mar 24). This appears to be Meta's crawler throttling decision — not something we caused.

### Phase 2: Non-Meta drops 95% and stays down (00:00 onward)

Non-Meta crawls dropped from ~330/hr (pre-midnight baseline) to ~12–20/hr and stayed there through the day:
```
Same hour comparison (18:00–20:00 UTC):
  Mar 22: 6,629 non-Meta crawls
  Mar 23: 7,785 non-Meta crawls
  Mar 24: 129 non-Meta crawls ← 98% drop
```

---

## Architecture: How Bot Crawl Logging Works

### Request flow (pre-incident):
```
Bot request → Vercel CDN → api/serve-clean-html.js (proxy) → Supabase edge function
                                    │
                                    ├── Step 1: Check rendered_pages DB cache (24h TTL)
                                    │     └── Cache HIT → skip edge function call
                                    │     └── Cache MISS → call edge function, store result
                                    ├── Step 3: logBotCrawl() → INSERT into bot_crawl_logs
                                    └── Step 4: Return HTML response
```

### The proxy (`api/serve-clean-html.js`):

The proxy has its own bot detection and logging function:

```javascript
// Bot detection (line ~75)
function detectBot(ua) {
  if (!ua) return null;
  for (const [name, pattern] of BOT_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  const lower = ua.toLowerCase();
  if (lower.includes("bot") || lower.includes("crawler") || lower.includes("spider")) {
    return "unknown_bot";
  }
  return null;
}

// Path filter — only certain page types are logged (line ~95)
function isLoggablePath(p) {
  return AGENT_PATH_RE.test(p) || CITY_PATH_RE.test(p) ||
    NEIGHBORHOOD_PATH_RE.test(p) || ARTIFACT_PATH_RE.test(p) ||
    STATE_PATH_RE.test(p);
}

// Logging (line ~100)
async function logBotCrawl(path, ua, botName, key) {
  const row = {
    page_path: path,
    user_agent: ua.slice(0, 500),
    bot_name: botName,
    crawled_at: new Date().toISOString(),
    agent_id: null,
  };
  // ... agent_id resolution for profile/artifact pages ...
  try {
    await fetch(`${SUPABASE_REST}/bot_crawl_logs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
  } catch (err) {
    console.error('[crawl-log] insert failed:', err.message);
  }
}
```

The proxy's main handler (line ~220):
```javascript
// Step 1: Check SSR cache
if (isCacheable) {
  const ttl = TTL_HOURS[fn] || 24;
  html = await getCachedPage(path, ttl, key);
  if (html) fromCache = true;
}

// Step 2: Cache miss → call upstream edge function
if (!html) {
  let url = `${SUPABASE_URL}/${fn}?path=${encodeURIComponent(path)}`;
  // ... build URL with query params ...
  const upstream = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "x-forwarded-user-agent": ua,
    },
  });
  html = await upstream.text();

  // Store in cache
  if (isCacheable && upstream.status >= 200 && upstream.status < 400) {
    setCachedPage(path, html, pageType, key).catch(() => {});
  }
}

// Step 3: Bot crawl logging — awaited before response
const botName = detectBot(ua);
if (botName && isLoggablePath(path)) {
  await logBotCrawl(path, ua, botName, key);
}

// Step 4: Serve
res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=0');
if (fromCache) res.setHeader('X-Cache', 'HIT');
res.status(200).send(html);
```

### The edge functions (`supabase/functions/serve-bot-list-html/index.ts`, etc.):

Each edge function imports `logBotVisit` from `_shared/log-bot-visit.ts`:
```typescript
import { logBotVisit } from "../_shared/log-bot-visit.ts";
```

**However, none of them actually call it.** The import is dead code in every single serve-bot function:
- `serve-bot-list-html` — import only, never called
- `serve-bot-agent-html` — import only, never called
- `serve-bot-content-html` — import only, never called
- `serve-bot-home-html` — import only, never called
- `serve-bot-state-html` — import only, never called

This means **100% of bot crawl logging depends on the Vercel proxy's `logBotCrawl` function.**

### The `rendered_pages` cache:

The proxy maintains a DB-backed page cache in the `rendered_pages` table:
```javascript
async function getCachedPage(path, ttlHours, key) {
  const r = await fetch(
    `${SUPABASE_REST}/rendered_pages?path=eq.${encodeURIComponent(path)}&select=html_content,created_at&limit=1`,
    { headers: { Authorization: `Bearer ${key}`, apikey: key } }
  );
  const data = await r.json();
  if (!data || data.length === 0) return null;
  const age = (Date.now() - new Date(data[0].created_at).getTime()) / 3600000;
  if (age > ttlHours) return null; // expired
  return data[0].html_content;
}
```

When a page is cached (cache HIT):
- The edge function is NOT called (Step 2 is skipped)
- The `logBotCrawl` in Step 3 SHOULD still fire (it runs unconditionally after the cache check)
- The response is served from the DB cache

---

## Root Cause Analysis

### What I initially believed (wrong):
I first thought Meta stopped crawling and that was the entire issue. I was wrong — Meta was still crawling heavily until 02:20 UTC, and non-Meta also dropped 95%.

### What actually happened:

**The `rendered_pages` cache was introduced at some point and cached page responses in a Supabase table with a 24–48 hour TTL.** After the production deploy at midnight UTC:

1. The Vercel CDN was purged, so all requests hit the serverless function fresh
2. The first wave of requests were cache MISSes → edge functions were called → responses were cached in `rendered_pages`
3. Subsequent requests got cache HITs → edge functions were NOT called
4. The proxy's `logBotCrawl` in Step 3 **should** have logged these cache-hit requests, but the logging rate dropped 95% anyway

**The remaining mystery:** Why did `logBotCrawl` (Step 3) stop working for cache-hit requests? The code runs unconditionally after the cache check. Possible explanations:
- The Vercel serverless function was hitting cold-start timeouts under high load after the CDN purge
- The Supabase REST API insert in `logBotCrawl` was silently failing (the function uses `try/catch` with `console.error` — errors are swallowed)
- The `rendered_pages` cache reads added latency, and combined with the `logBotCrawl` await, the function was timing out before completing the insert
- Vercel's serverless function execution limit (10s on Hobby, 60s on Pro) may have been exceeded with cache read + upstream call + bot logging all in one request

---

## Fixes Applied

### Fix 1: Disabled the `rendered_pages` cache (commit `732b741a`, deployed to production)

Changed `api/serve-clean-html.js` to always call the upstream edge function:

**Before:**
```javascript
// 1. Check SSR cache (only for cacheable functions without dynamic params)
if (isCacheable) {
  const ttl = TTL_HOURS[fn] || 24;
  html = await getCachedPage(path, ttl, key);
  if (html) fromCache = true;
}

// 2. Cache miss → call upstream edge function
if (!html) {
```

**After:**
```javascript
// Cache disabled — every request hits the edge function directly.
// Edge functions handle their own bot logging via logBotVisit.

// Always call upstream edge function (cache disabled — logging depends on it)
{
```

Also removed the cache write:
```javascript
// Before:
if (isCacheable && upstream.status >= 200 && upstream.status < 400) {
  const pageType = PAGE_TYPE[fn] || 'other';
  setCachedPage(path, html, pageType, key).catch(() => {});
}

// After:
// Cache write disabled — edge functions handle logging inline
```

**Rationale:** The edge functions are optimized to return in <1000ms. There is no need for a caching layer. The cache was adding complexity, breaking logging, and has caused repeated incidents ("drains keep breaking" per Robert).

### What has NOT been fixed:

**The edge functions still don't call `logBotVisit`.** The import exists in all 5 serve-bot functions but none of them actually invoke it. All logging still depends on the proxy's `logBotCrawl`. If the proxy's logging fails for any reason, we have zero fallback.

**Recommendation:** Add actual `logBotVisit(sb, req, path)` calls to each serve-bot function as a belt-and-suspenders approach. The proxy logging would be the primary, edge function logging the backup. This would also catch any requests that somehow bypass the proxy.

---

## Current Status (21:00 UTC Mar 24)

After the cache-disable deploy (~18:30 UTC):
```
17:00 UTC:   7/hr  (pre-deploy)
18:00 UTC: 103/hr  (deploy live)
19:00 UTC:  76/hr
20:00 UTC: 145/hr
21:00 UTC: 276/hr  ← trending up
```

Non-Meta is recovering but still well below the ~2,500–4,000/hr baseline from previous days at the same hours. Meta remains at zero.

**Comparison to same hours on previous days:**
```
18:00-20:00 UTC window:
  Mar 22: 6,629 non-Meta
  Mar 23: 7,785 non-Meta
  Mar 24:   324 non-Meta (after fix)
```

The fix is directionally correct (crawls are rising), but we're still at ~5% of the expected non-Meta rate. This needs continued monitoring.

---

## Open Questions

1. **Why is non-Meta still 95% below baseline?** The cache is disabled, the proxy logging is confirmed working (manual tests succeed), but organic bot traffic is not recovering to expected levels. Possible explanations:
   - Bot crawl patterns may take 24–48h to normalize after a site goes partially offline (bots back off when they encounter errors or slow responses)
   - The `isLoggablePath()` filter may be excluding paths that were previously logged through a different mechanism
   - There may be a second caching layer (Vercel Edge Network) that we haven't disabled

2. **Why did Meta stop at 02:20 UTC?** This appears to be independent of our deploy. Meta was crawling at 1,100/10min at 02:10 and dropped to 68/10min at 02:20. This could be a crawl budget decision, a rate limit on their side, or a response to the site being intermittently slow during the deploy transition.

3. **Should we add `logBotVisit` calls to the edge functions?** Currently dead code. Would provide redundant logging as a safety net.

---

## Files Changed

| File | Change |
|------|--------|
| `api/serve-clean-html.js` | Disabled `rendered_pages` cache — always calls upstream edge function |
| `supabase/functions/_shared/log-bot-visit.ts` | No change (reference only — imported but never called by serve-bot functions) |

## How to Verify the Fix

```bash
# 1. Confirm cache is disabled — response should take 500-1000ms (edge function call), not <50ms (cache)
curl -s -o /dev/null -w "Time: %{time_total}s" -H "User-Agent: GPTBot/1.0" \
  "https://www.top10lists.us/arizona/phoenix/top10realestateagents"

# 2. Confirm logging works — check if a new row appears
curl -s -H "User-Agent: TestBot/1.0" "https://www.top10lists.us/arizona/phoenix/top10realestateagents"
# Then query:
# SELECT bot_name, page_path, crawled_at FROM bot_crawl_logs ORDER BY crawled_at DESC LIMIT 3;

# 3. Monitor hourly rates
# SELECT date_trunc('hour', crawled_at) as hour, COUNT(*)::int as crawls
# FROM bot_crawl_logs WHERE crawled_at >= now() - interval '6 hours'
# GROUP BY 1 ORDER BY 1;
```
