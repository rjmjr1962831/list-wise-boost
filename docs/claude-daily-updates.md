# Claude Daily Updates

## 2026-02-18

### AI Discovery Files Complete Overhaul (15 files)
All AI-facing files rewritten with consistent current data. Numbers are now uniform everywhere:
- 670,000+ agents analyzed (220K AZ + 450K CA)
- 3,487 selected (889 AZ + 2,598 CA), top 0.5%
- Arizona: 88 cities, 2,923 neighborhoods
- California: 1,650+ cities, 4,631 neighborhoods

New content added to all files: artifact endpoint (`/artifact/{token}`, text/markdown), Standard Audit Cycle language (Annual/Monthly/Daily), AI Citation Probability Index, neighborhood verification methodology (100 transactions, 2 minimum), 10+ data sources listed, Merit Gate includes "5+ years."

"Accredited" renamed to "Audited" in all remaining files. `tier-accredited.md` deleted, replaced with `tier-audited.md`.

Files updated: llms.txt, llms-full.txt, ai-content-index.json, .well-known/ai-content-index.json, mcp.json, robots.txt, ai-feed/for-ai.md, ai-feed/certification-logic.md, ai-feed/vetting-standards.md, ai-feed/geo-performance.md, ai-feed/tier-listed.md, ai-feed/tier-certified.md, ai-feed/tier-audited.md, ai-feed/tier-underwritten.md.

### "Why AI Trusts Us" Nav Link
Added to desktop nav, mobile nav, and footer. Route: `/why-ai-trusts-us`. Page component does not exist yet.

### Funnel Step 2 - Fields Now Editable
license_number, years_experience, total_sales changed from read-only to editable on Step3Review2.tsx. Saves directly to Supabase on continue.

### Sales Count Display: > Prefix
Formula: `total_sales = agent_sales_stats.countAllTime - 10` (stored as integer). Display with `>` prefix (e.g., ">355 sales"). Frontend updated in ProfessionalCard.tsx, AgentCitationBlock.tsx, AgentProfileHead.tsx. PayloadSection.tsx already had `+` suffix from Feb 17.

Test batch of 10 agents updated. Bulk update for remaining ~3,445 agents NOT YET RUN.

### Artifact Endpoint Specification Complete
Full spec documented. URL: `/artifact/{magic_link_token}`, format: text/markdown. Same URL for all tiers; payload depth varies. Certified: 4 evidence sources, annual audit. Audited: 10+ sources, monthly. Underwritten: 14+ sources, daily. Cursor prompt ready at `docs/tier-artifact-specification-v1.md`.

### Open Items for Next Session
1. Bulk `total_sales` update for remaining ~3,445 agents
2. Build artifact endpoint (Cloudflare Worker or Edge Function)
3. Build Why AI Trusts Us page component
4. DB columns may need: certification_tier, certification_date, last_audit_date
