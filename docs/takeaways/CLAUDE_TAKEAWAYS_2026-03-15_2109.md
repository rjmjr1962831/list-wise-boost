# Claude Takeaways -- 2026-03-15 21:09 UTC

## AIFS (AI Footprint Score) -- Full Implementation

### New Scoring Model (Replaces AICS)
- **AIFS** = AI Footprint Score (originally "Fingerprint", renamed to "Footprint" per Robert)
- Blends live SERP entity signals (Serper.dev) with internal verified data
- 4 bands: Invisible (0-35), Fragmented (0-65), Recognized (66-85), High Fidelity (86-100)
- Invisible band removed from funnel pricing page display (agents in funnel are always at least Fragmented)
- No Underwritten multiplier on SERP scores -- Underwritten advantage is daily refresh (more frequent rescoring)

### Scoring Weights
- SERP signals (max 60 pts): Knowledge Graph (25), Sitelink Salience (10), Related Citations (15), Third-Party Validation (10)
- Internal signals (max 40 pts): Data Freshness (20), Selection Rationale (10), Crypto Verification (10)
- Refresh cadence by tier: Underwritten=daily, Audited=7 days, Certified=30 days, Listed=90 days

### Database
- New table: `aifs_scores` with full signal breakdown, gap analysis, tier lift projections, raw Serper response cache
- Denormalized columns on `professionals`: `aifs_score`, `aifs_band`
- Migration: `20260315000000_aifs_scores.sql`
- Cron: `batch-aifs-score-run` every 5 minutes (not yet deployed)
- Existing `geo_audit_results` scores (score_unlisted, score_listed, score_certified, score_audited, score_underwritten) used as fallback until AIFS cron populates data

### Edge Function
- `batch-aifs-score` -- new edge function (not yet deployed)
- 3 modes: cron (empty body), single agent (agent_ids array), force rescore
- Batch 50 agents, concurrency 10 Serper calls
- Serper cost: ~$13/mo for weekly full-batch, negligible

### Frontend Changes

**Step7Pricing.tsx (Funnel Pricing Page):**
- Replaced AICS hero with interactive AIFSGauge component
- Force currentTier to "certified" (this IS the upsell page)
- Scores pulled from `geo_audit_results` (score_certified, score_audited, score_underwritten)
- Interactive band selector: clicking a band shows projected score + description for that tier
- "Tap a level to see your projected score" hint text
- Challenge question with copy-to-clipboard: "I am a real estate agent. Look at Top10lists.us through the lens of AI Citability..."
- "Show Me the ROI" button scrolls to Citation Value Calculator
- Removed: gates passed strip, transparency footnote, "Amplify what you've earned" header
- Moved: Note about no guarantees to below tier cards

**AIFSGauge.tsx (New Component):**
- Full and compact modes
- 3 visible bands on funnel page (Fragmented, Recognized, High Fidelity)
- 4 bands total (includes Invisible for dashboard use)
- Interactive: clicking a band updates displayed score and description
- Two-scenario descriptions per band: citation behavior + "should I do business with this agent" reference check
- No SERP signal breakdown, no missing points block (removed per Robert)

**CitationROICalculator.tsx (New Component):**
- Inputs: Annual Sales Volume (currency formatted, no decimals), Commission Rate, Expected Monthly AI Citations
- 30% close rate (NAR referral benchmark)
- AIFS amplifier: higher tier score = proportionally more citations (score/baseScore ratio)
- 12-month Trust Compound multiplier: Certified 1.0x, Audited 1.15x, Underwritten 1.35x
- Per-tier breakdown: citation revenue, compound multiplier, annual cost, net value, ROI %
- Underwritten always shows highest ROI due to AIFS amplification + compound

**OverviewSection.tsx (Agent Dashboard):**
- Replaced AICS display with compact AIFSGauge
- Loads AIFS data from aifs_scores table
- Renamed "AI Citability Score" to "AI Footprint Score"

**ListMaker.tsx:**
- Added 13 AIFS export fields with select-all toggle

**businessConfig.json:**
- Added aifsWeights and aifsBands configuration

### Sandbox Test Agent
- Marcus Chen (AZ, Scottsdale, Underwritten)
- ID: 149c7dfd-c70a-4a72-ad51-c991fef7ffb4
- Verification token: d2641c6b-ba41-447e-9b7b-2fa5c4203364
- Dashboard token: 68909473d4d25843b87cc4f77b0dbb4f767fddadb8f3228a093717426906e5a5
- Realistic scores: score_certified=42, score_audited=68, score_underwritten=91
- Full payload: certifications, selection rationale, professional_cities, geo_audit_results

### Standing Rules Added (Takeaways)
1. Do not hallucinate
2. Do not summarize documents unless specifically asked
3. Do not truncate documents unless Robert asks

### Deployment Status
- Funnel pricing page: pushed to staging (commit e430637d)
- AIFS edge function + migration: NOT yet deployed (pending Robert's go)
- Calculator + ROI button: local only, not yet pushed

### Not Yet Done
- Deploy migration + edge function to Supabase
- Run initial AIFS batch scoring
- Dashboard page tuning (Robert mentioned CA funnel needs work)
- Email outreach prep (Smartleads)
