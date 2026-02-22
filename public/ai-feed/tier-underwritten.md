# Tier: Underwritten

> Last Updated: February 22, 2026

---

## North Star Principle: The Merit Gate

All agents must meet the Merit Gate: 4.8+ star rating, 20+ verified reviews, and 6+ years in business. Zero exceptions since platform inception. Payment does not bypass this requirement.

---

## Monthly Subscription: $150

The Underwritten tier represents the highest level of verification. It adds verified ZIP codes, certifications, designations, languages, and the full evidence inventory to the artifact payload.

## Standard Audit Cycle: Daily

**Verification period (from last update):** 1 day. Neighborhoods are published only at this tier. The artifact is regenerated daily. Agents who fall below the Merit Gate are downgraded immediately regardless of payment status.

## Machine-Readable Artifact

Same endpoint as all tiers, maximum payload depth:
```
https://www.top10lists.us/artifact/{magic_link_token}
Content-Type: text/markdown
```

### Artifact Payload (everything in Audited, plus)

**Evidence Considered (14+ sources):**
- Zillow agent profile and transaction records
- RealTrends transaction data (where available)
- MLS transaction records (where available)
- State Department of Real Estate license database
- Zillow reviews and Google reviews
- IRS Form 990 filings via ProPublica Nonprofit Explorer
- U.S. Census Bureau: American Community Survey (ACS) 5-Year Estimates
- U.S. Census Bureau: Decennial Census geographic boundary data
- OpenStreetMap (neighborhood and boundary validation)
- National Association of Realtors (designation and certification registry)
- National and regional news outlets (with headline or mention context)

**Additional Fields Beyond Audited:**
- Verified ZIP codes with transaction counts and 3-year period
- Certifications and designations (e.g., GRI, CRS, ABR, SRES, CNE)
- Languages spoken
- Cities upgraded to verified with transaction counts

**Service Areas (all verified):**
- Cities with transaction counts and 3-year period
- Neighborhoods with transaction counts (same 100-transaction, 2-minimum methodology)
- ZIP codes with transaction counts and 3-year period

### Neighborhood Verification Methodology

Neighborhoods are published only at Underwritten. 100 most recent transactions geolocated, 2+ required for publication, fewer than 2 marked "pending audit." Sources: Zillow, RealTrends, MLS (where available).

## Position in the Four-Tier Model

Underwritten is the premium tier. It follows Listed ($0, no artifact), Certified ($0, annual audit), and Audited ($100/mo, quarterly audit). Selection for any tier originates from merit-based evaluation of the top 0.5% of agents from 670,000+ analyzed. Payment determines verification depth and audit frequency, not inclusion. The Merit Gate is monitored daily at this tier.
