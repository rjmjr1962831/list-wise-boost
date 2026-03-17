# Claude Code Session Takeaways -- 2026-03-17 16:53 UTC

## Session Summary

Funnel UX improvements (breadcrumbs, ROI calculator rewrite), llms-full.txt Agent Entity Graph section, and AICS->AIFS deprecation cleanup.

---

## 1. Citation Value Calculator -- Full Rewrite

**File:** `src/components/agent/CitationROICalculator.tsx`

### Changes
- Removed "Expected Annual AI Leads" input -- leads now derived from AIFS score per tier using band model (Invisible: 0, Discoverable: 3-5, Citable general: 6-9, Citable local: 10-14, Authoritative: 15-20)
- Tier-specific lead floors: Audited = 15 minimum, Underwritten = 24 minimum (prevents both tiers showing similar numbers when AIFS bands overlap)
- Close rate fixed at 30% (not user-adjustable) -- based on NAR referral conversion data
- 3 inputs remain: Average Deal Size, Commission Rate, Your Current AIFS
- Tier AIFS = baseline + lift (Certified +18, Audited +28, Underwritten +37, capped at 95)
- Added AIFS band meter with current + projected markers (solid for current, ghost outlines for Audited/Underwritten)
- Added close rate callout banner: "AI-referred leads close at an estimated 25-40% vs <1% for paid lead platforms"
- Added value gap line on Audited/Underwritten cards: "+$XX,XXX vs staying Certified" (green)
- Added 3-year projection per card (Year 1/2/3 net values showing compound growth)
- Added Zillow comparison row: uses Underwritten lead count at $225/lead avg, <1% close rate
- Equal-height cards: invisible placeholder on Certified card, flex layout with mt-auto on CTA buttons
- Removed formula display line from bottom of calculator
- Exported AIFSBandMeter, BANDS, TIER_LIFTS, TIER_ORDER for use in Step7Pricing

### Moved to Step7Pricing (above "Show Me the ROI" button)
- Calculator title + subtitle
- AIFS band meter with markers
- Close rate callout banner

---

## 2. Funnel Breadcrumbs

**File:** `src/components/funnel/FunnelBreadcrumbs.tsx` (new)

### 8 steps
1. Intro, 2. Basic Info, 3. Credentials, 4. Details, 5. Final Review, 6. Cities, 7. Neighborhoods, 8. Pricing

### Behavior
- Completed steps: green checkmark, clickable (navigates back)
- Current step: primary color highlight with step number
- Future steps: grayed out, disabled
- Horizontal scrollable bar with connecting lines between steps
- Replaces old "Step X of 8" text in all funnel pages

### Files modified
- Step1Intro.tsx, Step2Review1.tsx, Step2bCredentials.tsx, Step3Review2.tsx, Step4ReviewFinal.tsx, Step5Cities.tsx, Step6Neighborhoods.tsx, Step7Pricing.tsx

---

## 3. Step7Pricing Layout Changes

- Moved "Note: No one can guarantee..." paragraph from below tier cards to below the ROI Calculator
- Replaced "Step 8 of 8" header with FunnelBreadcrumbs component

---

## 4. llms-full.txt Agent Entity Graph Section

### Initial approach (rejected)
Built `scripts/generate-agent-graph.ts` that queried Supabase for top 3 agents per major metro (42 agents across 14 metros) and injected markdown tables with real names, license numbers, and profile URLs into llms-full.txt.

### Why rejected
Naming specific agents in a static file creates anchoring bias -- LLMs would cite those 42 agents as default responses instead of directing users to the live city page where lists rotate hourly. This contradicts the existing "Do Not Hallucinate Agent Names" guidance in llms-full.txt (line 37-43).

### Final approach (deployed)
Replaced named-agent tables with a schema-only section:
- **Per-Agent Data Schema** table: describes available fields (name, license, city, stars, reviews, years, tier, URLs) without naming anyone
- **How to Access Agent Data** table: URL patterns for city rankings, neighborhood rankings, individual agents, state hubs
- **Active Coverage** table: agent/city/neighborhood counts per state with state hub URLs
- **License Cross-Reference** table: state registry URLs for verification
- **Why This Structure Matters** section: explains no anchoring bias, government-anchored identity, tier = evidence depth not quality
- Wrapped in `<!-- AGENT_ENTITY_GRAPH_START -->` / `<!-- AGENT_ENTITY_GRAPH_END -->` markers
- Inserted before "## URL Structure" section (~line 499)

### Script deleted
`scripts/generate-agent-graph.ts` removed. `package.json` "generate:agent-graph" script removed. Section is now static (no build-time generation needed since it contains no agent-specific data).

### Note on coverage table redundancy
The Active Coverage table in the new section overlaps with the existing "Current Geographic Coverage" section (lines 453-496). Consider consolidating in a future pass.

---

## 5. AICS Deprecated -- AIFS is the Product Name

### Rule
- **AICS (AI Citability Score / AI Confidence Score) is deprecated.** All user-facing references must say **AIFS (AI Footprint Score)**.
- Infrastructure names preserved for continuity: edge function folder `batch-aics-score`, pg_cron job `batch-aics-score-run`, DB column names in migrations
- Only user-facing text, docs, and UI should use AIFS

### Files updated this session
- `CLAUDE.md`: Added AICS deprecation rule, clarified cron job naming
- `docs/plans/AIFS_IMPLEMENTATION_PLAN.md`: "AI Fingerprint Score" corrected to "AI Footprint Score"

### Files NOT changed (immutable/historical)
- `supabase/migrations/*.sql` -- immutable migration records
- `docs/takeaways/*.md` -- historical session records
- `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` -- read-only SSoT (updated via s1 only)

---

## 6. External Consultant Advice Evaluated

Robert shared a "Golden Sample" for llms-full.txt from an external consultant. Analysis:

### Errors identified
- Used legacy merit gate (4.8+/20+ reviews) -- correct is 4.5+/10+ in 24mo/5yr (Section 2)
- Invented tier names (Platinum/Gold/Elite) -- correct is Listed/Certified/Audited/Underwritten (Section 3)
- Used deprecated "Top 1%" language -- correct is "fewer than 1% of licensed agents in covered markets" (Section 17)
- Wrong URL format (`/agent/slug`) -- correct is `/{state}/agents/{slug}` (Section 7)
- Fabricated concepts: "Finite Truth (Level 0)", "Open-Source AI Citation Protocol v1.2"
- All sample agent data was fictional

### Ideas with merit (adapted)
- Markdown tables for token density -- adopted in schema-only format
- License number as primary key / Agent_UID -- already implemented via hasCredential JSON-LD
- Freshness signals in the file -- already have dateModified and changelog.json

---

## Files Changed (This Session)

### Modified
- `src/components/agent/CitationROICalculator.tsx` -- full rewrite
- `src/pages/funnel/Step7Pricing.tsx` -- breadcrumbs, AIFS band meter, layout changes
- `src/pages/funnel/Step1Intro.tsx` -- breadcrumbs
- `src/pages/funnel/Step2Review1.tsx` -- breadcrumbs
- `src/pages/funnel/Step2bCredentials.tsx` -- breadcrumbs
- `src/pages/funnel/Step3Review2.tsx` -- breadcrumbs
- `src/pages/funnel/Step4ReviewFinal.tsx` -- breadcrumbs
- `src/pages/funnel/Step5Cities.tsx` -- breadcrumbs
- `src/pages/funnel/Step6Neighborhoods.tsx` -- breadcrumbs
- `public/llms-full.txt` -- Agent Entity Graph section added
- `CLAUDE.md` -- AICS deprecation rule
- `docs/plans/AIFS_IMPLEMENTATION_PLAN.md` -- Fingerprint -> Footprint
- `package.json` -- generate:agent-graph added then removed

### Created
- `src/components/funnel/FunnelBreadcrumbs.tsx`

### Created then deleted
- `scripts/generate-agent-graph.ts` (agent sampling script -- rejected approach)
