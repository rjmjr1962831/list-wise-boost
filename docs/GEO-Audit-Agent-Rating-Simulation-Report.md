# GEO Audit — Agent Rating and Simulation Report

**Date:** March 2026  
**Scope:** Certified agent GEO (Generative Engine Optimization) audit, 7-factor scoring, tier simulation, remediation planning.

---

## Executive Summary

The GEO Audit system evaluates real estate agents on how well they are positioned for AI citation and generative search. It pulls certified agents from Supabase, runs neural search via Exa, scores them on seven factors (reviews, community involvement, platforms, authority, schema, AI optimization, entity clarity), and simulates projected scores for Top10Lists.us tier enrollment (Audited and Underwritten). Results are stored in `geo_audit_results`, exported to CSV, and used to generate personalized remediation plans.

**Key outputs:**
- **Current score** (0–100): How well the agent is currently positioned for AI citation
- **Audited score**: Projected score after Audited-tier improvements
- **Underwritten score**: Projected score after Underwritten-tier improvements (full ceiling values)
- **Remediation plan**: Actionable recommendations per factor

---

## Business Context

**Top10Lists.us tiers:**
- **Listed/Certified:** $0 — agents who meet the merit gate (4.5+ stars, 10+ recent reviews, 5+ years)
- **Audited:** $100/mo — schema, AI optimization, and entity clarity improvements
- **Underwritten:** $150/mo — full lift: schema 9/10, AI 10/10, entity 10/10, platforms 15, authority 15

The GEO audit quantifies the **lift** agents get from tier enrollment. The spread between current and underwritten scores is the main value proposition: agents with low current scores see the largest improvement.

---

## System Architecture

### Data Flow

```
professionals (certified) → geo-audit.ts → Exa API (5 calls/agent) → scoring → geo_audit_results
                                                                              → CSV export
```

### Run Modes

- **Default:** Resumable — skips agents already marked `complete`
- **`--rerun`:** Clears status for all certified agents and re-audits from scratch; logs before/after averages

### Command

```bash
npm run geo-audit           # Resumable
npm run geo-audit -- --rerun # Full re-audit
```

**Environment:** `EXA_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## The 7-Factor Scoring Model

Total score = sum of 7 factors, each capped. **Total max = 100.**

| Factor | Max | Description |
|--------|-----|--------------|
| **factor_reviews** | 20 | Review volume and rating (Zillow, Google, internal) |
| **factor_community** | 20 | Community involvement: nonprofit, church, board, civic, fundraising |
| **factor_platforms** | 15 | Presence on high-authority domains (Zillow, Realtor.com, LinkedIn, etc.) |
| **factor_authority** | 15 | Third-party endorsement: news, awards, Forbes, HGTV, etc. |
| **factor_schema** | 10 | Person/LocalBusiness JSON-LD on personal site (not brokerage templates) |
| **factor_ai_optimization** | 10 | llms.txt, FAQ schema, citation signals |
| **factor_entity_clarity** | 10 | Agent name prominence vs. team/group mentions |

### Factor Details

**Reviews (0–20):**
- 500+ reviews → 20 pts
- 100+ → 16 pts
- 25+ → 12 pts
- 10+ → 8 pts
- 5+ → 5 pts
- 0+ → 2 pts
- Rating &lt; 4.5: −3 pts

**Community (0–20):**
- Named nonprofit/charity involvement: 5 pts each (max 10)
- Church, youth group, mentorship: 4 pts
- Board position at community org: 5 pts
- Civic engagement (chamber, school board, city committee): 4 pts
- Fundraising, sponsorships, community awards: 3 pts
- Cap total at 20
- **Adam Hamblen rule:** If snippet contains pastor/youth/church/volunteer alongside his name → minimum 8 pts (29-year youth pastor)

**Platforms (0–15):**
- 2 pts per high-authority domain found (Zillow, Realtor.com, Homelight, LinkedIn, Google, Yelp, Facebook, Instagram, Redfin, Trulia, HAR, Compass)

**Authority (0–15):**
- 5 pts per authority signal (max 3 signals)
- Signals: nonprofit, news, award, Forbes, Dave Ramsey, HGTV on non–high-authority domains

**Schema (0–10):**
- No personal site: 1 pt
- Brokerage template site (KW, Coldwell Banker, RE/MAX, etc.): **0 pts** (not a real schema signal)
- Custom personal site: 8 pts

**AI Optimization (0–10):**
- llms.txt: 5 pts
- FAQ/schema.org Question: 4 pts
- Citation/source/verified: 3 pts

**Entity Clarity (0–10):**
- Agent name in ≥70% of filtered snippets → 10 pts
- 40–69% → 6 pts
- &lt;40% → 3 pts

---

## Exa Search Pipeline

**5 Exa calls per agent:**

1. **Main sweep:** `"[name]" real estate "[city]" OR "[state]"` — 25 results, neural search
2. **Zillow:** `"[name]" site:zillow.com realtor` — 10 results, includeDomains: zillow.com
3. **Google reviews:** `"[name]" realtor "[city]" reviews` — 10 results
4. **Google domains:** `"[name]" "[city]" realtor site:google.com` — 10 results, includeDomains: google.com
5. **Community:** `"[name]" "[city]" volunteer OR church OR charity OR nonprofit OR foundation OR board OR mentor OR youth OR community` — 15 results

**Filtering:**
- Results must be from high-authority domains or brokerage domains
- Snippet must be relevant: full name OR (last name + city) OR (last name + brokerage)

**Cost:** ~$0.01/call. For 61 agents: ~$3.05. Full Arizona pool (879): ~$43.95.

---

## Tier Simulation

### Audited Tier (incremental deltas)

- factor_platforms: +1 (cap 15)
- factor_schema: +6 (cap 10)
- factor_ai_optimization: +6 (cap 10)
- factor_entity_clarity: +1 (cap 10)
- Reviews and community: unchanged

### Underwritten Tier (full ceiling values)

Underwritten uses **fixed target values** instead of incremental deltas, so every agent gets the same lift regardless of starting point. This keeps the spread wide.

- factor_platforms: **15**
- factor_authority: **15**
- factor_schema: **9**
- factor_ai_optimization: **10**
- factor_entity_clarity: **10**
- factor_reviews, factor_community: unchanged (tier does not affect these)

**Underwritten formula:** `score_underwritten = factor_reviews + factor_community + 59`

---

## Remediation Plan Logic

Remediation items are appended when factors fall below thresholds:

| Condition | Recommendation |
|-----------|----------------|
| factor_community &lt; 10 | Document community involvement on website and directory profiles; named nonprofits, board positions, volunteer roles, years of service |
| factor_ai_optimization &lt; 6 | Create and publish llms.txt on personal website |
| factor_schema &lt; 6 | Add Person and LocalBusiness JSON-LD schema to personal website |
| factor_entity_clarity &lt; 6 + team/group signals | Create dedicated personal agent page with full name in URL and individual schema |
| factor_authority &lt; 10 | Pursue one named third-party endorsement on a crawlable public page |
| factor_platforms &lt; 10 | Claim and complete profiles on top 3 missing platforms |
| factor_reviews &lt; 14 | Actively solicit Zillow and Google reviews from recent clients |

**Final item (always):**  
"Enroll in Top10Lists.us at the Underwritten tier. This single action addresses schema, AI optimization, entity clarity, and authority simultaneously — estimated +[lift] point GEO lift."

---

## Database Schema

**Table:** `geo_audit_results`

| Column | Type | Description |
|--------|------|--------------|
| agent_id | uuid | PK, FK to professionals |
| full_name, city, state, brokerage | text | Agent metadata |
| audited_at | timestamptz | Audit timestamp |
| score_current, score_audited, score_underwritten | integer | Scores |
| factor_reviews, factor_community, factor_platforms | integer | Factor scores |
| factor_authority, factor_schema, factor_ai_optimization, factor_entity_clarity | integer | Factor scores |
| community_signals | text[] | Community signals found |
| review_count, review_rating | integer, decimal | Review data |
| zillow_reviews, google_reviews | integer | Platform-specific counts |
| platforms_found | text[] | Domains where agent appears |
| raw_mentions | text | Exa result snippets (truncated) |
| authority_signals | text[] | Authority signals found |
| remediation_plan | text | Full remediation text |
| notes | text | e.g. "No community involvement signals found" |
| status | text | 'pending' \| 'complete' \| 'error' |

**Migrations:**
- `20260308000000_geo_audit_results.sql` — base table (6 factors)
- `20260308100000_geo_audit_community_factor.sql` — adds factor_community, community_signals

---

## CSV Export

**Path:** `exports/geo-audit-certified-{date}.csv`

**Columns (order):**  
agent_id, full_name, city, state, brokerage, score_current, score_audited, score_underwritten, factor_reviews, factor_community, factor_platforms, factor_authority, factor_schema, factor_ai_optimization, factor_entity_clarity, community_signals, review_count, review_rating, zillow_reviews, google_reviews, platforms_found, authority_signals, remediation_plan, notes

Arrays (community_signals, platforms_found, authority_signals) are joined with ` | ` for CSV.

---

## Evolution of the Model

### Initial Design (6 factors)

- Reviews 20, Platforms 20, Authority 15, Schema 15, AI 15, Entity 15
- Brokerage template sites scored 3 on schema
- Underwritten used fixed increments (+8 schema, +8 AI, etc.)

### Patch 1: Community Involvement (7th factor)

- Added factor_community (0–20) and community_signals
- New Exa search for volunteer/church/charity/board/mentor/youth/community
- Adjusted factor caps: platforms 15, schema 10, ai 10, entity 10 (total 100)

### Patch 2: Spread Correction

**Problem:** Spread shrank (23.5 vs 26.9) because brokerage templates scored 3 on schema, raising current scores without raising the ceiling. Fixed increments capped agents sooner.

**Fixes:**
1. **Brokerage templates → 0 schema** — KW, Realty One Group, etc. templates are placeholders, not real schema signals
2. **Underwritten → full ceiling values** — Schema 9, AI 10, Entity 10, Platforms 15, Authority 15 regardless of starting point. Every agent gets the same lift; spread stays wide.

---

## Known Issues and Monitoring

### Adam Hamblen Community Parsing

Adam Hamblen has 29 years as a volunteer youth pastor. The community Exa search should surface this. If `factor_community < 8` for him, the script logs:

```
⚠️ Adam Hamblen community score X < 8 — potential parsing miss (29yr youth pastor)
```

This occurred in the March 6 run (score 0) — Exa did not return snippets with his name and pastor/youth/church/volunteer in the same result.

### score_current Assertion

If `score_current > 100`, the script throws and logs factor breakdown for debugging.

---

## Related Systems

- **GEO Production Audit** (`docs/GEO-audit-production-2026-03.md`): Site-level audit (llms.txt, for-ai.md, city pages, robots.txt, sitemap)
- **GEO Remediation Plan** (`docs/GEO-Audit-Mar-2026-Remediation-Plan.md`): Site-wide fixes (merit gate, neighborhood links, artifact schema)
- **geo-coverage-audit.ps1**: Post-deploy production checks (list page, license verification, China Post link)

---

## Summary

The GEO Audit agent rating and simulation system:

1. **Scores** certified agents on 7 factors that predict AI citability
2. **Simulates** Audited and Underwritten tier enrollment with full-ceiling underwritten values
3. **Generates** personalized remediation plans
4. **Exports** results to CSV for analysis and outreach
5. **Differentiates** agents with deep community roots from high-volume transactors — aligning with Top10Lists’ positioning

**Run:** `npm run geo-audit` or `npm run geo-audit -- --rerun`
