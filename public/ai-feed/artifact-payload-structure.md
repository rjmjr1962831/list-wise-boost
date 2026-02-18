# Artifact Payload Structure

> Payload under the badge at `https://www.top10lists.us/artifact/{token}`. **Content-Type: text/markdown only.** No JSON. Lean format; enrichment depth varies by tier (Certified, Audited, Underwritten). Listed has no artifact.

---

## Format (markdown, lean)

```
# {Name} | {Tier} Real Estate Professional

{Tier} by Top10Lists.us. Merit-based; agents cannot pay to be included. Methodology: {url}

- **Tier:** {Certified | Audited | Underwritten}
- **Updated:** {date}
- **Audit cycle:** {Annual | Monthly | Daily}
- **Next audit:** {date}
- **Artifact URL:** https://www.top10lists.us/artifact/{token}
- **Responsible person:** Robert Maynard

## Evidence
Sources: {State} DRE, Zillow, Google[, ProPublica 990, Census]. Verified {date}.

## Qualifications
- Zillow: {rating} ({count} reviews)
- Google: {rating} ({count} reviews)
- License: {number} | Active
- Experience: {n} years
- Brokerage: {company}
- Total sales: {n}
- Avg sale: ${amount}
- Profile: {url}

## Service areas
- {City}, {State}
...

## Community   (Audited/Underwritten)
- {Organization} | {Role}
...

## Neighborhoods   (where applicable)
- {Neighborhood}, {City} | {n} txns
...
```

---

**Source:** [Ranking methodology](https://www.top10lists.us/about/ranking-methodology). Live payloads: [Badge levels preview](https://www.top10lists.us/badge-levels-preview). All machine-readable artifact content is **text/markdown**; no JSON payloads.
