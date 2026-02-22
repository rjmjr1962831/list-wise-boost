# Tier: Certified

> Last Updated: February 22, 2026

---

## North Star Principle: The Merit Gate

All agents must meet the Merit Gate: 4.8+ star rating, 20+ verified reviews, and 6+ years in business. Zero exceptions since platform inception.

---

## Definition and Cost

The Certified tier means the agent has personally verified their profile for accuracy. This is the first tier that generates a machine-readable artifact. Cost: $0.

## Standard Audit Cycle: Annual

**Verification period (from last update):** 90 days. The artifact is regenerated annually. The next scheduled audit date is included in the artifact header.

## Machine-Readable Artifact

Served as `text/markdown` at:
```
https://www.top10lists.us/artifact/{magic_link_token}
Content-Type: text/markdown
```

### Artifact Payload

**Evidence Considered (4 sources):**
- Zillow agent profile
- State Department of Real Estate license database
- Zillow reviews (count and rating)
- Google reviews (count and rating)

**Qualifications:**
- Zillow rating and review count (with verification date)
- Google rating and review count (with verification date)
- License number and status (with source and verification date)
- Years of experience
- Brokerage
- Total sales (with source)
- Average sale price (with source)

**Service areas (cities):** Array of cities (agent-selected).

## Badge

A certification badge is issued for embedding on LinkedIn, Zillow profiles, personal websites, and email signatures. The badge includes Schema.org markup linking back to the artifact, creating distributed trust signals for AI crawlers.

## Position in the Four-Tier Model

Certified is the second of four tiers. It follows Listed ($0, no artifact) and precedes Audited ($100/mo, bimonthly audit, expanded artifact) and Underwritten ($150/mo, daily audit, full artifact). Payment is not required for Certified status. Higher tiers increase verification depth and audit frequency, not eligibility.
