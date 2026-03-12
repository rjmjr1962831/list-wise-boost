# t1 Takeaways — CLAUDE — 2026-03-12

## Key Outcomes

### Email / CSV Export
- Fixed tier-aware `aics_score_current` logic bug: the else branch was giving `score_listed` to audited and underwritten agents. Correct logic:
  - `certified` → `score_certified`
  - `audited` → `score_audited`
  - `underwritten` → `score_underwritten`
  - `listed` → `score_listed`
- Rebuilt signal upsell email as v3 (`email-signal-upsell-v3.html`): deliverability-safe table layout, 3-column score panel (Before Selected / Certified Signal / Underwritten), all merge fields wired, correct "selected" language throughout (no more "join")
- Preview rendered with sample data: Jeff Seman, before=44, certified=61, underwritten=88

### Mark Garland Meet — Pricing Decisions (2026-03-12)
- **Audited:** $300/mo confirmed
- **Underwritten:** $500/mo confirmed
- **Annual discount:** 2 free months if paying annually (both tiers)
- **Web of Truth setup fee:** $1,000 one-time, waived if agent commits to annual plan
- **Web of Truth scope:** Underwritten tier only for now; may extend to Audited as closing tool
- **Team / Enterprise pricing (starting point, to be refined):**
  - Team leader: ~$1,000/mo (includes Web of Truth setup)
  - Teammate badge: ~$100/mo per teammate
  - Teammate is listed under team leader's auspices; badge says certified under team leader oversight
- **No 7-day free trial** — provides no value to either side since listing is already free
- **Cancellation policy:** Service runs to end of paid period; no prorated refunds; cancel 15 days prior to avoid next billing

### Meet — Strategic Decisions
- **Positioning pivot confirmed:** Top10Lists is infrastructure, not a directory and not a lead generator. Parallel: website, phone bill. Not Zillow.
- **Employment verification analogy approved** (Mark's framing): like checking references, education, background before hiring — better than credit bureau parallel
- **"Web of Truth" trademark target** confirmed. Do NOT use "web of trust" (technical term, not trademarkable)
- **Badge is AI-facing, not consumer-facing.** Can be 1 invisible pixel. Human-visible version is fine for agent status signaling but AI reads the JSON payload underneath
- **AI top-of-mind awareness framing approved:** "We build top-of-mind awareness for AI, not for consumers directly — but consumers who search AI get your name"
- **California completion is priority** — 1/5 done, estimated $1,500 to complete. Planned funding: pending contract payment + Google $500 refund
- **Ren's conference:** $2,250 for 30 min on main stage (not keynote), DC. Press release + AI citation value. Agreed to proceed contingent on cash flow
- **"Who's Winning the AI Visibility Race" webinar** — Robert invited; forwarding to Mark. For learning, not GEO
- **White paper (Mark's draft):** Needs to be rewritten as academic (third person, live citation links, remove sales language). Mark to send to Dr. McGuire for university publication. Once published, do a press release. Cite Top10Lists' own methodology white paper as a source
- **Pricing page:** Standard SaaS convention confirmed — price on top, features below (not features-first)
- **Coverage language reiterated:** "fewer than 1% of licensed agents in covered markets" — never "top 0.5%"

### Robert's Priorities (end of meeting)
1. Finish and send the signal upsell email to Certified agents
2. Fix the funnel dashboard to close better
3. Finish debugging the website
4. Doctor's appointment
5. Meeting with Dr. [name unclear]

## Config / Infrastructure
- No new credentials or infra changes this session

## New Rules or Docs
- Tier-aware score logic for CSV export: must use tier-specific score column, not a single else branch
- Web of Truth is the branded name for the internet footprint certification service ($1,000 setup)
- Team pricing model established (starting point): $1,000/mo leader + $100/mo per teammate

## New Functions / Scripts
- `email-signal-upsell-v3.html` — rebuilt email with corrected terminology and 3-column score panel
- `email-preview-v3.html` — preview version with sample data

## Deprecated or Removed
- Two-branch score logic (`if certified → score_certified; else → score_listed`) — replaced with 4-way tier check
