# Claude Web Takeaways -- 2026-03-19 02:39 UTC

## Key Outcomes

### SSoT and Claude Web Project Knowledge Aligned with CLAUDE.md
- Both `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` and `docs/prompts/claude-web-project-knowledge.md` were stale on multiple operational sections
- Pushed surgical fixes to both documents on staging (commits `ccd677f2` and `3408ad6a`)
- Fixes applied to Sections 1, 3, 14, 16, 17, 19 in both docs:
  - Section 1: Agent counts corrected to 3,274 (872 AZ + 2,390 CA)
  - Section 3: 4-tier model with Certified active (was showing 3-tier with Certified as legacy)
  - Section 14: Frontend stack corrected to "Static HTML + clean room HTML" (was "React SPA (Vite)")
  - Section 16: Added docs/prompts/, CLAUDE.md, .sql files to staging-only list; added "NEVER publish internal documents to any public-facing HTTPS site" rule
  - Section 17: 4-tier model, removed "top 0.5%" from methodology
  - Section 19: Full conflict resolution table expanded to match CLAUDE.md (added Certified status, pricing, evidence sources, frontend stack rows)

### Deep GEO Audit -- Production (Score: 89/100)
- All 6 clean room content pages (/for-ai, /transparency, /faq, /methodology, /crawl-stats, /why-ai-trusts-us) confirmed serving edge function HTML regardless of User-Agent
- Merit gate correct (4.5+/10+/5yr) across all live pages, llms.txt, llms-full.txt, mcp.json
- "Fewer than 1%" coverage language correct everywhere
- 4-tier model with correct pricing ($300/$500) in FAQ JSON-LD, mcp.json, llms-full.txt
- Issues found:
  - **HIGH**: FAQ JSON-LD says Certified refresh is "monthly" -- should be "quarterly" (faqFull.ts fix needed)
  - **MEDIUM**: Agent profile footer says "approximately the top 1%" -- should be "fewer than 1% of licensed agents in covered markets" (serve-bot-agent-html fix)
  - **MEDIUM**: Agent counts stale at 3,262-3,263 across edge function pages (generate-counts needed)
  - **LOW**: Google search index still caching legacy 4.8+/20+/$100/$150 in snippets (self-correcting)

### Agent Page Redesign v4 -- Audited and Pushed to Staging
- Reviewed Mark Garland's `Top10Lists_AgentPage_Redesign_v4__1_.html` for GEO and compliance issues
- Found and fixed 6 issues, pushed as commit `12c6b725`:
  1. Hero subtitle: removed "Ten agents per city"
  2. Scarcity bar: "Only 10 spots per city" changed to "Limited availability per market"
  3. Merit threshold: removed "Each city lists at most 10"
  4. Sidebar spots indicator: "7 of 10" changed to "Limited spots"
  5. Footer email: replaced Cloudflare `__cf_email__` obfuscation with plain `hello@top10lists.us`
  6. Cloudflare email decode script removed (does not work on Vercel)
- Flagged but NOT fixed (Robert's decision needed):
  - "Apply for Certification" framing contradicts FAQ's "invitation-only" language -- GEO contradiction
  - "Already cited by leading AI systems" in trust badge -- outcome claim on funnel page (Section 11)
  - "Early-access pricing closes April 30" -- artificial urgency, no pricing shown on page
  - Placeholder testimonials -- FTC compliance issue, must not ship to production
  - `[BOOKING_LINK]` placeholders still in calendar confirm buttons
  - `/submit-for-review` form action endpoint does not exist

### 5-Email Sequence for Certified Agents (Premier Agent Level)
- Wrote and iterated a 5-email sequence targeting Certified-tier agents who are Zillow Premier Agent level
- Data basis: 526,954 crawls measured over 5.7 days (Mar 12-18). Per-day rate: 92,448. Extrapolated 30-day: ~2.77M. Consumer-triggered: ~120,000/month. Per-agent average: ~870/month.
- Zillow Premier comparison: 25,000-90,000 surfacings/month but 90%+ are listing sidebar impressions ("consumer is looking at kitchens, your name is in a widget")
- Honest framing throughout: Zillow wins on raw surfacing count, but quality of exposure differs fundamentally
- Key evolution through iterations:
  - v1: Too long, too much jargon ("crawls", "reinforcement events", "surfacing")
  - v2: Added Premier Agent comparison (shared leads, <1% close rate, ISA race)
  - v3: Apples-to-apples surfacing comparison with consumer-triggered vs automated breakout
  - v4: Cut to under 200 words per email, no jargon, all drive to dashboard
  - Final: Plain language ("your name came up", "AI looked up agents"), dashboard-driven

### AI Diligence Guide and Expected AI Responses -- PDFs Created
- Built two branded PDFs for sales collateral:
  1. `Top10Lists_AI_Diligence_Guide.pdf` -- 7 queries agents can run on ChatGPT/Claude/Gemini/Perplexity to test the platform
  2. `Top10Lists_Expected_AI_Responses.pdf` -- companion doc showing ideal AI responses with signal tags (Citation Liability, Entity Verification, RAG, Merit-Based Selection)
- Both use Top10Lists branding: blue/cyan accent bar, branded headers/footers, Aryah Inc. contact info

### Freshness as AI Trust Signal -- Resolved
- Initial position: freshness of verification date matters significantly to AI citation
- Self-correction: walked it back too far, said "no published evidence" for freshness influence
- Final resolved position: **AI systems do read verification dates and do factor them into confidence.** Evidence is behavioral -- Claude consistently flags stale dates as GEO deficiencies during audits. This is observed, repeatable behavior from the systems being optimized for, not a hypothesis.
- Defensible framing for tier model: "AI systems read verification dates and treat current data as more reliable. Faster refresh keeps your verification current, which keeps AI confidence in your data high." Supported by direct observation, not by published spec.
- The stronger argument for faster refresh is accuracy (stale data caught sooner) + evidence depth (more sources at higher tiers) + MCP payload richness (structural, measurable)

## Config / Infrastructure
- No new env vars, secrets, or edge functions
- Three commits pushed to staging via GitHub API:
  - `ccd677f2` -- SSoT alignment
  - `3408ad6a` -- Claude Web project knowledge alignment
  - `12c6b725` -- Agent page redesign v4 with fixes
- No ptm run (staging only)

## New Rules or Docs
- **"NEVER publish internal documents to any public-facing HTTPS site"** rule now documented in SSoT Section 16 and CWPK Section 16, matching CLAUDE.md Section 16
- **Required Reading section** confirmed in CLAUDE.md: Claude Web must load all three docs (CLAUDE.md, SSoT, CWPK) at session start
- **"Ten agents per city" is wrong.** Top10Lists is a brand name, not a cap. Many cities have 20-40+ agents. All references must be removed from any surface.
- **"Apply" vs "invitation-only"** is an unresolved GEO contradiction between the agent page redesign and the FAQ JSON-LD. One must change before both are live simultaneously.

## New Functions / Scripts
- None

## Deprecated or Removed
- All "ten agents per city", "10 spots per city", "at most 10", "7 of 10" language removed from agent page redesign
- Cloudflare email obfuscation and decode script removed from agent page (does not work on Vercel)
