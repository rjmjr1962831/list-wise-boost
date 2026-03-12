# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Completed deep GEO audit of production: scored 78/100 with 7 errors, 9 warnings, 25 passed checks
- **Root cause found: 344 stale static HTML files in `public/` were overriding live edge function rewrites.** Vercel serves static files before evaluating rewrites, so stale pre-rendered pages with fake data (Best Realty, Dream Realty, Example Realty, 555 phone numbers) were being served to AI crawlers instead of the live edge function output. All 344 files removed.
- Fixed cross-file consistency issues across 6 AI discovery files (llms.txt, llms-full.txt, mcp.json, ai-content-index.json, for-ai, serve-bot-content-html)
- Fixed 2 agent image_url refs pointing to dead Supabase project `bgdtekbhelormzbymkhh` (Eileen Taggart, Robert Maynard) — updated to `wiotrvoirdgzfacuuiem`
- Added title-casing for city names in areaServed JSON-LD (e.g., "west-hollywood" → "West Hollywood")
- Re-activated 4 agents (Hope Beneteau, Marsee Wilhems, Stacy Klibanoff, Deborah Potestio) that were incorrectly flagged for "555" in brokerage phone numbers, not personal phones
- Current active agent counts: 3,274 total (AZ: 872, CA: 2,390)
- Agent profile uncached load time: ~500ms average (470ms–650ms range)

## Config / Infrastructure
- **Vercel cache purged** and force-deployed to clear stale CDN entries
- **3 edge functions deployed:** serve-bot-agent-html, serve-bot-content-html, site-health-check
- Vercel proxy (`api/serve-clean-html.js`) already sets `Vercel-CDN-Cache-Control: s-maxage=0` — Vercel CDN should not cache API responses, but browser cache is 5 min (`max-age=300, stale-while-revalidate=3600`)
- Edge function `serve-bot-list-html` returns `Cache-Control: public, max-age=86400` — this is the Supabase response header, overridden by the Vercel proxy

## New Rules or Docs
- **Certified tier refresh = Annual** (not Monthly). Certified is legacy (~58 grandfathered agents, no new issuances). Resolved conflicting references across 6 files.
- **Evidence sources = "up to 20"** (not "12" or "14+"). Enrichment checks ~1,000 places, cites only when relevant, max 20 sources per agent.
- **Listed tier auditCycle = Annual** (not "None"). Fixed in mcp.json.
- **Static HTML in `public/` will override vercel.json rewrites.** Never place static files at paths that should be handled by edge function rewrites. This is a Vercel behavior: static files take priority over rewrites.

## New Functions / Scripts
- No new functions or scripts created this session.

## Deprecated or Removed
- **344 stale static city/neighborhood HTML files removed** from `public/arizona/*/top10realestateagents/` and `public/california/*/top10realestateagents/`. These were pre-rendered pages from an obsolete build step that contained fake/placeholder data. All city and neighborhood pages now served exclusively via `serve-bot-list-html` edge function through vercel.json rewrites.
- **Health check regex updated:** `6+\s*years` → `(?<!\d)6+\s*years` to prevent false positives on "26+ years" matching "6+ years"
