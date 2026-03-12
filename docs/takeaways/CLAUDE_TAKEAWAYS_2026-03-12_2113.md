# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Deep GEO audit on production identified ~12 issues across clean-room HTML, schema markup, redirects, and stale data
- All hardcoded agent counts (3,487/889/2,598) replaced with live DB queries across all edge functions and static files
- Two-gate architecture (merit selection + data certification) documented in for-ai.txt and schema markup (JSON-LD)
- City-level 301 redirects added for bare `/arizona/:city` and `/california/:city` URLs with negative lookahead to protect `/agents/` paths
- Floor+5 review count pattern applied uniformly across all schema generators (cityListingSchema, structuredData, verifiedAgentSchema)
- GEO score improved from initial ~72 to 93/100 after all fixes
- Final audit confirmed all three content pages (/transparency, /for-ai, /methodology) now show dynamic counts (3,274 / 872 / 2,390)

## Config / Infrastructure
- `vercel.json`: Added 301 redirects for `/arizona/:city` → `/arizona/:city/top10realestateagents` and same for California, with `(?!agents|top10realestateagents)` negative lookahead
- `scripts/generate-dynamic-counts.ts` (NEW): Build-time script that queries Supabase for live agent/city/neighborhood counts and injects into mcp.json, ai-content-index.json, llms.txt, llms-full.txt
- `package.json`: Added `generate-counts` script and integrated into build pipeline

## New Rules or Docs
- `public/for-ai.txt`: Added two-gate architecture section documenting merit selection (Gate 1, free) vs data certification (Gate 2, paid tiers for depth)
- Two-gate model added to for-ai HTML page with JSON-LD TechArticle schema

## New Functions / Scripts
- `scripts/generate-dynamic-counts.ts` — build-time count injection for static AI-facing files
- `serve-bot-content-html`: Added `getLiveCounts()` shared function that queries `professionals` table via `run_sql` RPC with graceful fallback to static values
- `serve-bot-content-html`: `renderTransparency()` and `renderMethodology()` converted from sync to async to support DB queries

## Deprecated or Removed
- All hardcoded agent counts (3,487 / 889 / 2,598) eliminated from edge functions — these were stale since agent count dropped to 3,274
- Hardcoded `SITE_LAST_UPDATED` date in structuredData.ts replaced with `new Date().toISOString().split('T')[0]`
- `credentialId` field in AgentBadge.tsx replaced with schema.org-compliant `identifier`
