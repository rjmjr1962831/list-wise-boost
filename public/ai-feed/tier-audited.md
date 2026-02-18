# Tier: Audited

> Last Updated: February 18, 2026

---

## North Star Principle: The Merit Gate

All agents must meet the Merit Gate: 4.8+ star rating, 20+ verified reviews, and 6+ years in business. Zero exceptions since platform inception. Payment does not bypass this requirement.

---

## Monthly Subscription: $50

The Audited tier adds community involvement verification, specialties, and transaction-verified neighborhoods to the artifact payload.

## Standard Audit Cycle: Monthly

The artifact is regenerated monthly. Agents who fall below the Merit Gate are downgraded regardless of payment status.

## Machine-Readable Artifact

Same endpoint as Certified, richer payload:
```
https://www.top10lists.us/artifact/{magic_link_token}
Content-Type: text/markdown
```

### Artifact Payload (everything in Certified, plus)

**Evidence Considered (10+ sources):**
- Zillow agent profile and transaction records (most recent 100 transactions analyzed)
- RealTrends transaction data (where available)
- MLS transaction records (where available)
- State Department of Real Estate license database
- Zillow reviews and Google reviews
- IRS Form 990 filings via ProPublica Nonprofit Explorer
- U.S. Census Bureau: American Community Survey (ACS) 5-Year Estimates
- Regional and national news outlets (where agent or brokerage appears)

**Additional Fields:**
- Specialties
- Community involvement (organization name, role, verified via IRS Form 990 through ProPublica, with verification date)

**Service Areas:**
- Cities (agent-selected)
- Neighborhoods (transaction-verified)

### Neighborhood Verification Methodology

Neighborhoods are not self-reported. When an agent requests a neighborhood, we analyze their most recent 100 transactions and geolocate each one. If 2 or more transactions fall within the neighborhood boundary, we publish them. If fewer than 2 are found, the neighborhood is marked "pending audit." Sources: Zillow, RealTrends, MLS (where available).

## Position in the Four-Tier Model

Audited is the third of four tiers. It follows Listed ($0, no artifact) and Certified ($0, annual audit) and precedes Underwritten ($150/mo, daily audit, full artifact). Payment determines verification depth and audit frequency, not eligibility or ranking position.
