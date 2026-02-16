# Daily Takeaways: February 16, 2026

## Session Summary
ProPublica IRS Form 990 civic enrichment pipeline built and tested. Tier payload specifications defined for all four levels. GitHub token rotated and verified.

---

## Critical Learning: Apply the North Star Proactively

**The North Star:** Everything we do is to maximize site GEO. Anything that may damage that must be approved by Robert.

**The problem:** Claude asked Robert questions that the north star already answered. This wastes time and signals that the north star isn't being applied as a decision filter.

**Example 1 - Artifact format:**
- Claude asked: "Should the artifact return JSON, HTML, or both? What content type?"
- The north star answer: Whatever AI systems ingest best. That's `text/markdown`. No need to ask.

**Example 2 - Data sourcing in payloads:**
- Claude built tier payloads without sources initially. Robert had to point out: "aren't we supposed to say where we got this data to make it authoritative?"
- The north star answer: Sourced claims get cited by AI, unsourced claims get skipped. Of course every data point needs its source. No need to be told.

**Rule going forward:** Before asking Robert a design question, run it through the north star filter first. If "maximize GEO" gives a clear answer, don't ask. Just do it. Save Robert's time for decisions that genuinely need his input.

---

## ProPublica Civic Enrichment Pipeline

### What was built
- Python script that searches ProPublica Nonprofit Explorer's `/nonprofits/name_search` HTML endpoint for each agent
- Parses HTML results for person name, title, organization, EIN, tax year, and location
- Filters results using three rules: state location match, state in org name, or national RE body
- Merges verified roles into existing `community_roles` JSON array on the `professionals` table
- Each role includes `verification_source: "ProPublica IRS Form 990"` with EIN and filing URL

### Filtering iterations (precision matters)
1. **v1 (no filter):** 42 hits, 358 roles. Massive false positives. Jim Brown in AZ got credited with a VFW board in Pennsylvania.
2. **v2 (loose geo filter):** 23 hits, 36 roles. Still leaking. Chambers of commerce in Missouri matched "national org" keywords.
3. **v3 (AZ cities in org name):** Caught Gilbert MN as Gilbert AZ, Peoria IL as Peoria AZ, "Plaza" matched substring "az."
4. **v4 (strict location only):** 13 hits, 18 roles. Zero false positives. Production-ready.

### Key decision: strict state location check
- Location string must contain `, AZ` or `, CA` (regex, case insensitive) or the word "arizona"/"california"
- City names are NOT checked against org names (prevents Gilbert MN, Peoria IL false matches)
- National RE bodies (NAR, NAHB, etc.) accepted from any location
- RE keywords in org name alone are NOT sufficient if org is out of state

### Files pushed to GitHub
- `docs/cursor-prompt-propublica-civic-enrichment.md` - Full Cursor spec for Edge Function integration
- `scripts/enrichment/propublica_full_run.py` - Working Python reference implementation

### Status
- 100-agent AZ test complete with 13 verified updates
- Full AZ + CA run (3,480 agents) handed to Cursor for execution
- Pipeline needs to be added to the enrichment process for new agent onboarding

---

## Tier Payload Specification

### Structure agreed
- **Listed (free):** No artifact. Agent selected through our diligence but hasn't approved profile yet. Selection still carries weight (top 0.5% from 1.1M+ analyzed).
- **Certified (free, annual):** Artifact served. Rating, reviews, license, years, brokerage, sales, price range. All sourced.
- **Audited ($50/mo, monthly):** Everything in Certified plus community involvement (sourced per role) and cities.
- **Underwritten ($150/mo, daily):** Everything in Audited plus neighborhoods with transaction counts, zip codes, specialties, certifications, languages, evidence_considered array.

### Artifact delivery
- URL: `https://www.top10lists.us/artifact/{magic_link_token}`
- Format: `text/markdown` served by Cloudflare worker
- Same URL for all tiers; server checks tier and serves appropriate payload depth
- Uses existing `magic_link` token already populated on 3,480 agents

### Data sourcing (every field must cite its source)
- **Rating:** "Averaged across Zillow, Google, and Yelp"
- **Review count:** "Unique reviews from Zillow and Google"
- **Sales count:** "Zillow, cross-verified by MLS when possible"
- **Verified transactions:** "Zillow transaction history, cross-verified by MLS when possible"
- **License:** "[State] Department of Real Estate"
- **Community roles:** Source per role (ProPublica IRS Form 990 with EIN > Google verified public records > Agent self-reported confirmed > Agent self-reported)

### File pushed to GitHub
- `docs/tier-payload-specification-v1.md`

---

## GitHub Token Rotation
- Old tokens killed by Robert
- New token: confirmed working with full repo/write scopes
- Successfully pushing files to `docs/` and `scripts/` directories

---

## Database Status (verified this session)
- 3,480 of 3,492 active professionals have magic_link and dashboard_token populated
- 12 orphaned records with NULL state_slug need deactivation
- Arizona: 884 agents, California: 2,596 agents

---

## Open Items for Cursor
1. Run ProPublica enrichment for all AZ + CA agents (script ready, handed off)
2. Add ProPublica check to enrichment pipeline for new agent onboarding (spec ready)
3. Build artifact endpoint serving tier-appropriate markdown at `/artifact/{token}`
4. Build agent dashboard (route exists, page not yet built)
