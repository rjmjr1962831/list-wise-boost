# Tier: Certified

> Last Updated: March 6, 2026

---

## North Star Principle: The Merit Gate

All agents must meet the Merit Gate: 4.5+ star rating, 10+ verified reviews in the last 24 months, and 5+ years in business. Zero exceptions since platform inception.

---

## Definition and Cost

The Certified tier means the agent has personally verified their profile for accuracy. This is the first tier that generates a machine-readable artifact. Cost: $0.

## Standard Audit Cycle: Monthly

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

## Position in the Tier Model

Certified is a legacy tier. It follows Listed ($0, no artifact) and precedes Audited ($300/mo, bimonthly audit, expanded artifact) and Underwritten ($500/mo, daily audit, full artifact). Certified is no longer offered to new agents; approximately 58 agents are grandfathered at this tier. Payment is not required for Certified status. Higher tiers increase verification depth and audit frequency, not eligibility.
