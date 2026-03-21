# Claude Takeaways — 2026-03-20 23:02 UTC

## Session Summary (continued)

Full clean-room migration: every public page migrated from React SPA to Supabase edge functions serving complete HTML. 760-page smoke test.

## Changes Made

### Clean-Room Migration Complete
- Created `serve-bot-home-html` edge function — homepage with dynamic DB counts, 2 JSON-LD schemas
- Created `serve-bot-pages-html` edge function — 15 pages: about, ranking-methodology, privacy, terms, sms-terms, opt-in, payments-security, press, ai-compare, for-ai-systems, join/for-agents, ai-citation-whitepaper, ai-liability, protocol-services, zillow-explained, plus coming-soon for CO/FL/TX/NY
- Created `serve-bot-qa-html` edge function — 20 Q&A pages with FAQPage JSON-LD
- Updated vercel.json: 27 new rewrites, SPA catch-all scoped to authenticated routes only
- Updated api/serve-clean-html.js: added 3 new functions to allowed list
- Removed all pre-rendered SPA shell HTML files from public/ (about, ranking-methodology, for-agents, for-ai-systems, join, opt-in, payments-security, press, privacy, sms-terms, terms, ai-citation-whitepaper, ai-liability, protocol-services, zillow-explained, colorado, florida, texas, new-york)
- All 3 edge functions deployed to Supabase

### Sitemap Cleanup
- Removed 14 phantom URLs from sitemap-pages.xml (6 nonexistent pages: how-it-works, compare, developers, resources, guides, contact, partners, careers; 8 Q&A slugs with wrong names)
- Fixed all Q&A slugs to match actual deployed slugs
- Updated lastmod dates to 2026-03-20

### Bug Fixes
- Fixed "Community involvement" → "Community" in zillow-explained edge function
- Fixed esc() null handling in serve-bot-founder-html preventing crash
- Fixed /for-agents 400 error (added as alias for /join in edge function)

## Smoke Test Results (760 pages)
- 744 return 200 with clean-room HTML, zero SPA
- 14 were phantom sitemap entries (now removed)
- 2 agent profiles return 404 (data issues, not routing)
- Zero public pages serving React SPA
- All authenticated routes (admin, agent/login, agent/dashboard) still serve SPA
- MCP server: all 6 tools operational including get_founder_profiles

## Architecture Decision
Robert decided 2026-03-20: ALL public pages must serve clean-room HTML from edge functions. React SPA only for authenticated pages. Saved to memory as feedback_cleanroom_architecture.md and project_cleanroom_migration.md.

## Key Lesson
Pre-rendered HTML files in public/ take precedence over Vercel rewrites. When migrating to edge functions, the static files must be removed first or the rewrites will never execute.
