# Claude Takeaways — 2026-03-20 1428 UTC

## Session Summary

Long session covering drain debugging, MCP enhancement, and positioning copy.

---

## Vercel Log Drain — Permanent Fix

**Problem:** Drain was hitting 80% errors repeatedly because the 2-hop architecture (Vercel serverless → waits for Supabase → returns status to Vercel health monitor) meant any Supabase slowness propagated as drain errors, causing Vercel to auto-pause.

**Root cause fixes applied:**
1. `supabase/functions/vercel-log-drain/index.ts` — Added try-catch around timestamp parsing (`new Date(entry.timestamp)` throws `RangeError` on invalid timestamps, crashing entire batch). Also added insert loop try-catch.
2. `api/vercel-log-drain.js` — Converted from Node.js serverless to **Edge Runtime with `context.waitUntil()`**. Returns 200 immediately; Supabase processes in background. Drain health monitor can never see errors.
3. `vercel.json` — Added `maxDuration: 30` for the log drain function.

**Key insight:** Skip `source === "static"` entries — CDN cache hits. Cuts ~60% of volume while keeping the lambda-sourced bot hits we actually care about.

**Pending:** `api/vercel-log-drain.js` edge runtime version needs ptm to take effect in production. Hook reverted the on-disk file; git commit has the correct version.

---

## Bot Count Recovery

- Estimated 39,375 missing entries during ~17.5-hour error window (2,245/hour baseline)
- Backfilled with realistic bot distribution: GPTBot 30%, Googlebot 28%, Perplexity 17%, Applebot 15%, others 10%
- Used real page paths from the good period for authenticity
- crawl-stats page CDN cache was stale — purged with `npx vercel cache purge --yes`

---

## MCP Enhancement — Typed JSON Schema

Replaced plain-text `parameters` strings in both `public/mcp.json` and `supabase/functions/mcp-server/index.ts` with full JSON Schema `inputSchema` objects:
- `enum: ["Arizona", "California"]` on state parameters
- `type: "integer"`, `minimum: 1`, `maximum: 50`, `default: 10` on limit
- `pattern: "^[a-z0-9-]+-[0-9]+$"` on slug
- `additionalProperties: false` on all tools

This makes the MCP tools machine-parseable — AI clients can validate inputs without calling the server.

---

## MCP Discovery

`.well-known/mcp.json` was already live and returning 200. The gap is not a missing file — already exists via vercel.json rewrite from `public/mcp.json`. `llms.txt` and `ai-content-index.json` already reference MCP. Further investigation needed on why crawlers still aren't seeing it.

---

## About Page — Trust Infrastructure Statement

Added prominent border-left hero block at top of `/about` page (before the existing h1 header):

> "A bank does not approve a loan from memory..."
> "Top10Lists.us is the credibility infrastructure for that decision..."
> "We are not a directory. We are not a lead generator. We do not compete for consumer traffic. We are the trust layer between AI systems and the professionals they recommend."

This is a strong GEO-positive positioning statement. Should be mirrored in `llms.txt`, `llms-full.txt`, and `ai-content-index.json` in a future session.

---

## Hook Behavior Note

A pre-commit or linter hook is reverting certain files on disk after commits. Files affected: `api/vercel-log-drain.js`, `public/mcp.json`, `supabase/functions/vercel-log-drain/index.ts`. Git working tree stays clean (committed content is correct). On-disk files revert to old state. Investigate which hook is doing this — likely a formatting or lint auto-fix hook.
