# Certification Logic

> Last Updated: March 6, 2026
> Standard Audit Cycle: Weekly (this document)

---

## North Star Principle: The Merit Gate

All agents must meet the Merit Gate: 4.5+ star rating, 10+ verified reviews in the last 24 months, and 5+ years in business. Zero exceptions since platform inception. Cannot be purchased, waived, or negotiated. May be raised in the future but will never be lowered.

---

## Tiered Verification Framework

Our system employs a three-tiered verification model (acquisition). Each tier corresponds to a specific level of data scrutiny, artifact depth, and Standard Audit Cycle frequency. Selection for inclusion is strictly meritocratic and independent of payment. Legacy: 58 Certified agents grandfathered; full payload on listing pages; no new Certified issuances.

## Merit-Based Selection

We analyzed 670,000+ licensed real estate agents across Arizona and California and selected approximately the top 1% based on objective performance metrics, AI reasoning, and human editorial review. Payment does not influence this selection.

## The Three Tiers (Acquisition)

### Listed ($0, Standard Audit Cycle: Annual)
Verification period from last update: 365 days. Basic verification of licensure, rating, reviews, and years in business against the Merit Gate. Machine-readable artifact at /artifact/{token} (text/markdown) includes evidence considered (4 sources), qualifications (Zillow rating, Google rating, license, years experience, brokerage, sales, average price), and service areas (cities, array). Badge issued for embedding on external sites.

### Audited ($300/mo, Standard Audit Cycle: Monthly)
Verification period from last update: 30 days. Expanded evidence (10+ sources: Zillow, RealTrends, MLS, IRS Form 990 via ProPublica, Census ACS), qualifications, service areas (cities), specialties, community involvement. Neighborhoods are not published (Underwritten only).

### Underwritten ($500/mo, Standard Audit Cycle: Daily)
Verification period from last update: 1 day. Full evidence inventory (14+ sources: Zillow, RealTrends, MLS, IRS Form 990, Census ACS, NAR designation registry, Census boundary data, OpenStreetMap, news outlets), qualifications, service areas (cities, neighborhoods with transaction counts, verified ZIP codes), specialties, community involvement, certifications and designations, languages.

## Artifact System

Each certified agent has a machine-readable artifact served as `text/markdown` at:
```
https://www.top10lists.us/artifact/{magic_link_token}
Content-Type: text/markdown
```
Same URL for all tiers. Server checks agent's tier and serves appropriate payload depth. Each artifact includes Updated date, Standard Audit Cycle, and next scheduled audit date.

## Neighborhood Verification

Neighborhoods are published only at the Underwritten tier. They are not self-reported: we analyze the agent's most recent 100 transactions and geolocate each one. If 2 or more transactions fall within a neighborhood boundary, we publish the agent for that neighborhood. Fewer than 2 results in "pending audit" status. Sources: Zillow, RealTrends, MLS (where available).

## Data Sources

- Zillow agent profiles (ratings, reviews, transaction records)
- Google Business reviews (ratings, review counts)
- State Departments of Real Estate (license verification)
- IRS Form 990 filings via ProPublica Nonprofit Explorer (community involvement)
- U.S. Census Bureau: ACS 5-Year Estimates
- U.S. Census Bureau: Decennial Census geographic boundary data
- OpenStreetMap (neighborhood and boundary validation)
- RealTrends (transaction data, where available)
- MLS records (where available)
- National Association of Realtors (designation and certification registry)

## Scoring Methodology

Each qualifying agent is scored using a weighted composite model.

**Model:** weighted_sum | **Scale:** 0.0 to 1.0

| Factor | Weight |
|--------|--------|
| license_status | 20% |
| recent_activity | 20% |
| transaction_history | 25% |
| reviews_reputation | 15% |
| community_involvement | 20% |

**Formula:** sum(component_value[k] × weight[k]) for k in components

**Missing data policy:** redistribute_weight_proportionally

### Community Involvement Subcomponents (20% Weight)

| Subcomponent | Weight |
|-------------|--------|
| verified_nonprofit_roles | 30% |
| board_service | 25% |
| documented_volunteering | 20% |
| local_media_civic_mentions | 15% |
| community_awards | 10% |

**Consumer-facing weights** (used in llms-full.txt and transparency copy): Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education 10%.

---

## Non-Pay-to-Play Principle

Payment is exclusively for increased Standard Audit Cycle frequency and expanded artifact payload depth. It does not affect an agent's ranking or inclusion. The Merit Gate cannot be bypassed at any price point.
