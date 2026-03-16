# Claude Code Takeaways -- 2026-03-14

## Key Outcomes
- Rewrote CLAUDE.md from scratch as the single comprehensive operating manual for all Claude instances (Code, Web, Cursor)
- Synthesized all knowledge sources: old CLAUDE.md, full COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md (21 sections), memory files (deprecated functions, closing comparison, pricing analysis, feedback), and Claude Web baseline project knowledge
- Corrected stack description everywhere: "React SPA (Vite)" replaced with "Static HTML (humans) + clean room HTML (AI)". Hard rule added: never serve JS/React pages to anyone
- Updated Claude Web project baseline with correct commands (pk -> CLAUDE.md, ryt -> COMPREHENSIVE), hard rules, and current business model
- Evaluated Zillow Unofficial API on RapidAPI (by eatwithusdotnet/V.O.N) as affordable alternative to Apify memo23 for ongoing agent enrichment
  - Agent endpoints: agentBylocation, agentInfo, agentReviews, agentSoldProperties, agentForSaleProperties, agentForRentProperties
  - Pricing: Free basic tier, PRO $20/mo, ULTRA $40/mo, MEGA $100/mo (vs ~$0.50/agent on Apify)
  - Estimated ~800-1,200 requests/month for tier-based refresh cadence -- PRO tier likely sufficient
  - Not yet subscribed or tested; next step is free tier test with known agents
- Identified that the project's system prompt enrichment-api code block still references dead Supabase project `bgdtekbhelormzbymkhh` -- must be corrected to `wiotrvoirdgzfacuuiem`

## Config / Infrastructure
- CLAUDE.md pushed to staging (commit 2c418c29) -- now accessible to Claude Web via GitHub API
- No new env vars or credentials this session

## New Rules or Docs
- CLAUDE.md expanded from 70 lines to 312 lines with 20 sections covering: project, north star, merit gate, business model (with Web of Truth, team pricing, tier framing), scoring, content serving, URLs, Supabase, git/deployment, verification, execution rules, data quality/EE-A-T, data sources, email sequencer, dead infrastructure, internal docs, conflict resolution, commands, quick reference, value proposition/sales context
- Hard rule codified: "No React SPA, no JavaScript-rendered pages. Never serve a JS/React page to anyone."
- Certified tier confirmed active (not legacy) throughout CLAUDE.md
- Post-pk rules check (4 questions) included in CLAUDE.md commands section

## New Functions / Scripts
- None this session

## Deprecated or Removed
- Old 70-line CLAUDE.md replaced with comprehensive 312-line version
- "React SPA (Vite)" stack description deprecated from all project knowledge docs
- KNOWN BUG: System prompt enrichment-api block still references dead project `bgdtekbhelormzbymkhh` -- needs fix
