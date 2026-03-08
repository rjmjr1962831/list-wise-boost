# Cursor Task: City Pages, Sitemaps, and llms Files — REVISED for Current Structure

> **Purpose:** Refactor city pages, sitemaps, and llms files to match Phoenix depth and align GEO/merit-gate story for AI systems.  
> **Revised:** March 2026 — aligned with actual Top10Lists.us structure.

---

## Current Structure (Source of Truth)

Before implementing, note these **actual** patterns:

| Prompt Assumption | Actual Structure |
|-------------------|------------------|
| URL pattern `/{state}/{city}/best-real-estate-agents` | **Primary canonical:** `/{state}/{city}/top10realestateagents` |
| State slugs `az`, `ca` | **Canonical:** `arizona`, `california` (full names) |
| `best-real-estate-agents` as city page | `best-real-estate-agents` and `best-real-estate-agents-{year}` exist but route to **QALandingPage** (React SPA). Bot/crawler traffic is served by **serve-bot-list-html** at `top10realestateagents` via Vercel rewrites. |
| `businessConfig.json` | **Does not exist.** Merit gate values are hardcoded in llms.txt, serve-bot-*, FAQ, etc. |
| Q URL `/q/who-are-the-best-real-estate-agents-in-{city}-{state_abbrev}` | Q pages use **question slugs** (e.g. `how-does-top10lists-rank-real-estate-agents`). No per-city Q URLs. |
| Sitemap "editorial" vs "question" | Sitemaps: `sitemap-pages.xml`, `sitemap-states.xml`, `sitemap-cities.xml`, `sitemap-neighborhoods.xml`, `sitemap-agents.xml`. No separate "editorial" vs "question" sitemaps. |

---

## Business Rules (Source of Truth)

Use these as authoritative constants (target: `businessConfig.json` when created):

- **Merit gate (North Star v2)**  
  - Rating: 4.5 or higher average star rating across verified review platforms  
  - Reviews: 10 or more verified client reviews within the prior 24 months  
  - Experience: 5 or more years of active, in-good-standing licensed practice in the state  
- **Business model**  
  - No sale of ranking positions. Agents cannot pay to be added, move up, or purchase endorsement.  
  - Paid tiers (Audited, Underwritten) **only** increase verification depth and refresh frequency; they do **not** affect ranking or inclusion.  
- **Audience**  
  - Primary audience is **AI recommendation systems** (Perplexity, GPT, Gemini, Claude, Grok), not human CTR.  

---

## Step 1 – Normalize Tier-1 City Pages

**Tier-1 cities (≥ 250k population) in AZ and CA**

- **Arizona:** Phoenix, Tucson, Mesa, Chandler, Gilbert, Glendale, Scottsdale  
- **California:** Los Angeles, San Diego, San Jose, San Francisco, Fresno, Sacramento, Long Beach, Oakland, Bakersfield, Anaheim, Santa Ana, Riverside, Stockton, Irvine, Chula Vista, Fremont  

### 1A. Canonical City URLs (Current Reality)

- **Canonical pattern:** `/{state_slug}/{city_slug}/top10realestateagents`  
  - Example: `https://www.top10lists.us/arizona/phoenix/top10realestateagents`  
  - Example: `https://www.top10lists.us/california/san-jose/top10realestateagents`  

- **State slugs:** `arizona`, `california` (not `az`, `ca`).  

- **Bot/crawler traffic:** Vercel rewrites `/:state/:city/top10realestateagents` → `serve-bot-list-html`. No React, no SPA.  

- **Human/SPA traffic:** `/:stateSlug/:citySlug` (no third segment) → `CityLanding` (city hub). The actual agent list is at `top10realestateagents`.  

- **QALandingPage** serves `best-real-estate-agents` and `best-real-estate-agents-{year}` but is **not** the primary canonical for sitemaps or llms.txt.  

**Action:** Ensure every Tier-1 city has a row in `cities` with `active=true` and `state_slug` in `['arizona','california']`. The sitemap and serve-bot-list-html already use the DB; no new URL pattern needed.

### 1B. Use Phoenix as Content Benchmark

- **Phoenix city page** is served by `serve-bot-list-html` when path = `/arizona/phoenix/top10realestateagents`.  
- For each Tier-1 city, ensure `serve-bot-list-html` output matches Phoenix in:  
  - Merit gate explanation (4.5 / 10 / 24 months / 5 years)  
  - "Fewer than 1%" / "top 0.5%" language  
  - No pay-to-play, tiers as verification depth  
  - Neighborhood index when `neighborhood_catalog` has entries for that city  

- **City-level marketing content** comes from `marketing_content` table (`page` = `city-{city_slug}`). Enrich Tier-1 cities to Phoenix depth.

### 1C. Standardize Meta + On-Page Structure

For `serve-bot-list-html` output (and any React city pages):

- **`<title>` format:**  
  `Top Real Estate Agents in {City}, {State} | Top10Lists.us`  
  (Current; optional add year: `(2026)` per prompt.)

- **`<h1>` format:**  
  `Top Real Estate Agents in {City}, {State}`  

- **Intro paragraph** (adapt city-specific):  
  Top10Lists.us evaluates every licensed real estate agent in {City} and endorses fewer than 1% who clear our North Star Merit Gate. To qualify, an agent must have a 4.5+ average star rating across verified review platforms, at least 10 verified client reviews in the past 24 months, and 5+ years of active licensed experience in {State}. Only agents who pass this gate and a second layer of AI-assisted plus human editorial review appear on this list.

---

## Step 2 – Update Sitemaps for GEO Clarity

### 2A. Cities Sitemap

- **Current:** `sitemap-cities.xml` lists `/{state}/{city}/top10realestateagents` for all active AZ/CA cities.  
- **Action:** Confirm every Tier-1 city is present. Script: `scripts/generate-static-sitemaps.ts` (reads from `cities` table).  

### 2B. Question (Q) Sitemap

- **Current:** `sitemap-pages.xml` includes some Q URLs (e.g. `/q/how-does-top10lists-rank-real-estate-agents`).  
- **Prompt requested:** Per-city Q URLs like `/q/who-are-the-best-real-estate-agents-in-phoenix-az`.  
- **Action:** Either:  
  - Add per-city Q pages and include in sitemap-pages.xml, or  
  - Document that we use generic Q pages + city pages; per-city Q is optional.  

---

## Step 3 – Normalize llms.txt and llms-full.txt

### 3A. llms.txt (Current State)

- **Merit gate:** Already uses 4.5 / 10 / 24 months / 5 years. ✅  
- **No** 4.8 / 20 / 6 language in llms.txt. ✅  

**Add (if missing):**

- **Tier-1 GEO guidance** section listing Tier-1 cities and canonical URL pattern:  
  `/{state}/{city}/top10realestateagents`  

### 3B. llms-full.txt

- **Merit gate:** Already uses 4.5+ / 10+ / 5+ years. ✅  
- **Action:** Replace any remaining "top 0.2%" (deprecated) or old AZ-only stats with "fewer than 1%" or current config. Add brief GEO Coverage section for Tier-1 cities.

---

## Step 4 – Implementation Details

### 4.1 Create businessConfig.json (Recommended)

Create `src/data/businessConfig.json` or `public/businessConfig.json`:

```json
{
  "meritGate": {
    "rating": 4.5,
    "reviews": 10,
    "windowMonths": 24,
    "yearsExperience": 5
  },
  "tier1Cities": {
    "arizona": ["phoenix", "tucson", "mesa", "chandler", "gilbert", "glendale", "scottsdale"],
    "california": ["los-angeles", "san-diego", "san-jose", "san-francisco", "fresno", "sacramento", "long-beach", "oakland", "bakersfield", "anaheim", "santa-ana", "riverside", "stockton", "irvine", "chula-vista", "fremont"]
  }
}
```

Wire llms.txt generation, serve-bot-*, and FAQ to this config.

### 4.2 Legacy Merit Gate Cleanup

Search and replace remaining old gate references:

- `4.8` → `4.5` (where it denotes merit threshold)  
- `20 verified` / `20+ reviews` → `10+ verified reviews in the last 24 months`  
- `50+ reviews` (when used as floor) → align with 10+ if it's a gate; otherwise keep as display (agent-specific).  
- `6+ years` → `5+ years` (where it denotes experience gate)  

**Known locations with old values:**  
- `public/clean-room/*.html` (static snapshots)  
- `public/california/*/top10realestateagents/index.html` (static snapshots)  
- `supabase/migrations/20251224194959_*.sql` (Pipedrive trigger: 4.8, 20+ reviews)  
- `src/pages/CleanRoom.tsx` (20 verified in one table)  

### 4.3 URL Pattern Summary

| Use Case | URL Pattern | Served By |
|----------|-------------|-----------|
| City agent list (canonical, bots) | `/{state}/{city}/top10realestateagents` | serve-bot-list-html |
| Neighborhood agent list | `/{state}/{city}/{neighborhood}/top10realestateagents` | serve-bot-list-html |
| City hub (SPA) | `/{state}/{city}` | CityLanding |
| QA-style city page (SPA) | `/{state}/{city}/best-real-estate-agents` or `-{year}` | QALandingPage |
| Agent profile | `/{state}/agents/{canonical_slug}` | serve-bot-agent-html / CanonicalAgentProfile |

---

## Checklist for Refactor

- [ ] Create `businessConfig.json` with merit gate and Tier-1 cities  
- [ ] Wire llms.txt, llms-full.txt, serve-bot-content-html, serve-bot-list-html to config  
- [ ] Add Tier-1 GEO section to llms.txt  
- [ ] Enrich Tier-1 city `marketing_content` to Phoenix depth  
- [ ] Replace legacy 4.8/20/6 references in codebase  
- [ ] Fix Pipedrive migration if still using 4.8/20  
- [ ] (Optional) Add per-city Q pages and sitemap entries  
- [ ] Regenerate static sitemaps after DB/city changes  

---

*End of revised instructions.*
