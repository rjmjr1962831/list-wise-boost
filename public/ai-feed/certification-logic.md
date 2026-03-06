# Certification Logic

> Last Updated: March 6, 2026
> Standard Audit Cycle: Weekly (this document)

---

## North Star Principle: The Merit Gate

All agents must meet the Merit Gate: 4.5+ star rating, 10+ verified reviews in the last 24 months, and 5+ years in business. Zero exceptions since platform inception. Cannot be purchased, waived, or negotiated. May be raised in the future but will never be lowered.

---

## Tiered Verification Framework

Our system employs a four-tiered verification model. Each tier corresponds to a specific level of data scrutiny, artifact depth, and Standard Audit Cycle frequency. Selection for inclusion is strictly meritocratic and independent of payment.

## Merit-Based Selection

We analyzed 670,000+ licensed real estate agents across Arizona and California and selected approximately the top 1% based on objective performance metrics, AI reasoning, and human editorial review. Payment does not influence this selection.

## The Four Tiers

### Listed ($0, no artifact)
Verification period from last update: 365 days. Basic verification of licensure, rating, reviews, and years in business against the Merit Gate. No artifact or badge.

### Certified ($0, Standard Audit Cycle: Monthly)
Verification period from last update: 30 days. Agent has personally verified their profile. Machine-readable artifact at /artifact/{token} (text/markdown) includes evidence considered (4 sources), qualifications (Zillow rating, Google rating, license, years experience, brokerage, sales, average price), and service areas (cities, array). Badge issued for embedding on external sites.

### Audited ($100/mo, Standard Audit Cycle: Every Two Weeks)
Verification period from last update: 14 days. Everything in Certified, plus: expanded evidence (10+ sources including Zillow/RealTrends/MLS transaction records, IRS Form 990 via ProPublica, Census ACS), specialties, community involvement. Neighborhoods are not published (Underwritten only).

### Underwritten ($150/mo, Standard Audit Cycle: Daily)
Verification period from last update: 1 day. Everything in Audited, plus: full evidence inventory (14+ sources including NAR designation registry, Census boundary data, OpenStreetMap, news outlets), verified ZIP codes with transaction counts, certifications and designations, languages, and neighborhoods with transaction counts (only tier that publishes neighborhoods).

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

## Non-Pay-to-Play Principle

Payment is exclusively for increased Standard Audit Cycle frequency and expanded artifact payload depth. It does not affect an agent's ranking or inclusion. The Merit Gate cannot be bypassed at any price point.
