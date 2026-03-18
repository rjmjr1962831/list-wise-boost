# Claude Code Takeaways -- 2026-03-18 (continued session)

## Key Outcomes

### Internal Document Security
- Removed CLAUDE.md and all 258 .sql files from main branch
- Added CLAUDE.md and supabase/migrations/ to internal-documents.txt exclusion list
- Added glob pass in merge-to-main.ps1 to strip all *.sql files from main regardless of location
- Established rule: internal documents must NEVER be published to any public-facing HTTPS URL (production, staging site, Vercel previews, Supabase storage). Accessible only via private GitHub repo.
- Updated CLAUDE.md with Required Reading section containing direct GitHub staging branch links for Claude Web access

### Supabase Security Fixes (3 linter errors resolved)
- `agent_bot_crawl_stats` view: recreated with `security_invoker = true` (was SECURITY DEFINER)
- `bot_crawl_logs` table: enabled RLS + `service_role_all` policy
- `geo_serp_results` table: enabled RLS + `service_role_all` policy
- All fixes applied via run-migration edge function

### MCP Discovery
- Added `/.well-known/mcp.json` Vercel rewrite pointing to existing `/mcp.json`
- Follows emerging convention for MCP server auto-discovery alongside `/.well-known/ai-content-index.json`
- Reviewed external advice on MCP discoverability: adopted .well-known path, rejected `<link rel="mcp-server">` (no spec) and robots.txt `MCP:` directive (not a valid directive)

### llms.txt URL Templates
- Added URL Templates section to llms.txt with all 4 canonical URL patterns: state hub, city, neighborhood, agent profile
- Includes explicit anti-hallucination rules: do not fabricate slugs, no ZIP-based URLs, no legacy short codes
- Closes gap between mcp.json (has urlTemplates) and llms.txt (didn't have them)

### Crawl Stats Page -- Data Start Date Note
- Added note that bot crawl recording began 2026-03-12 with `<time>` tags
- Until 2026-04-12 the 30-day rolling window is incomplete

## Config / Infrastructure
- `scripts/internal-documents.txt`: added CLAUDE.md, supabase/migrations/
- `scripts/merge-to-main.ps1`: added *.sql glob pass to strip all SQL files from main
- `vercel.json`: added `/.well-known/mcp.json` rewrite
- Supabase DB: RLS enabled on bot_crawl_logs and geo_serp_results; agent_bot_crawl_stats view fixed

## New Rules or Docs
- Memory saved: `feedback_no_internal_docs_public.md` -- never publish internal docs to any public HTTPS URL
- CLAUDE.md Section 16: explicit prohibition on publishing internal docs, with examples of what counts as public
- CLAUDE.md Required Reading: direct GitHub links for Claude Web to load SSoT and project knowledge

## New Functions / Scripts
- No new functions this segment

## Deprecated or Removed
- CLAUDE.md removed from main branch (staging only, accessible via GitHub)
- 258 .sql files removed from main branch (staging only)
- agent_bot_crawl_stats SECURITY DEFINER property removed (now SECURITY INVOKER)
