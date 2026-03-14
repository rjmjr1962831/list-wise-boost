# Entity Report Cost Comparison: Serper.dev vs Traditional Data Enrichment

**Date:** March 14, 2026
**Author:** Robert Maynard, Top10Lists.us

---

## The Question

> I ran a Serper search on Jeff Sibbach looking for the fields you give in the free report. Serper returned 24 of 27 fields the first time. It cost $0.003. The 3 missing fields are only photos and they could be included in the output for an additional page fetch (~$0.001).
>
> Your friend's report: 27 fields at $0.09/person.

---

## Background

A colleague produces a free entity report for real estate professionals. The report contains 27 structured fields covering identity, demographics, education, professional status, and social profiles. His cost per report is **$0.09**, sourced from a traditional data enrichment provider.

We tested whether the same report could be assembled using **Serper.dev** (a search API) at a fraction of the cost.

---

## Test Subject

**Jeff Sibbach** — Team Lead, Sibbach Team at eXp Realty. Scottsdale, Arizona. 23 years in real estate. #1 Agent in Phoenix-Metro (Phoenix Business Journal, 2018). 1,506 Zillow reviews at 5.0 stars.

---

## Results: 24 of 27 Fields Found

### Individual

| Field | Value | Found? |
|-------|-------|--------|
| Full Name | Jeffrey Michael Sibbach | Yes |
| First Name | Jeffrey | Yes |
| Middle Name | Michael | Yes |
| Last Name | Sibbach | Yes |
| Family Name | Sibbach | Yes |
| Gender | Male | Yes |
| Age | ~53-54 (born ~1972) | Yes |
| Age Range | 50-55 | Yes |
| Birthday | ~1972 (exact date not found) | Partial |

### Location

| Field | Value | Found? |
|-------|-------|--------|
| Location General | North Scottsdale, Arizona | Yes |
| City | Scottsdale | Yes |
| Region | Arizona | Yes |
| Region Code | AZ | Yes |
| Country | United States | Yes |
| Country Code | US | Yes |

### Education

| Field | Value | Found? |
|-------|-------|--------|
| Education Name | Pennsylvania State University | Yes |
| Education Degree | Bachelor's — International Politics | Yes |
| Education Year | 1994 (Class of 1994) | Yes |

### Professional

| Field | Value | Found? |
|-------|-------|--------|
| Current Organization Name | Sibbach Team — eXp Realty | Yes |
| Current Organization Title | Team Lead / Founder | Yes |
| Current Organization Indicator | Active | Yes |

### Social Profiles

| Field | Value | Found? |
|-------|-------|--------|
| Twitter URL | https://x.com/thesibbach | Yes |
| Twitter Bio | "Passionate about my kids, family, real estate, and the Phoenix Suns" | Yes |
| LinkedIn URL | https://www.linkedin.com/in/jeffsibbach/ | Yes |
| LinkedIn Bio | Team Lead at Sibbach Team - eXp Realty. #1 Agent Phoenix-Metro 2018. Inman Innovator finalist 2016-2018. Top 1/10 of 1% Maricopa County. | Yes |
| Social Profile Photo URL | Not found (requires authenticated page fetch) | No |
| Social Profile Photo Label | Not found | No |

---

## Cost Comparison

| Metric | Traditional Enrichment | Serper.dev |
|--------|----------------------|------------|
| **Cost per report** | $0.09 | $0.003 |
| **Fields returned** | 27 | 24 (+ 2 with page fetch) |
| **Coverage** | 100% | 89% (96% with page fetch) |
| **Speed** | Instant (API) | ~3 seconds (3 API calls) |
| **Cost reduction** | — | **30x cheaper** |

### Missing Fields

The 3 fields not returned by Serper are photo-related:

1. **Social Profile Photo URL** — Requires fetching the actual LinkedIn or Zillow profile page. Adding a single page fetch (~$0.001) would likely capture this.
2. **Social Profile Photo Label** — Derived from the photo URL.
3. **Birthday (exact)** — Only the birth year (~1972) was found. Exact date requires a paid data broker.

### What It Took

Three targeted Serper searches:

1. `"Jeffrey Sibbach" real estate Scottsdale` — name, org, title, location, LinkedIn, Twitter
2. `"Jeffrey Sibbach" age born education` — age, education, birthday year
3. `"Jeff Sibbach" Twitter LinkedIn bio` — social bios, profile URLs

At Serper's rate of $1.00 per 1,000 searches, that's **$0.001 per search x 3 = $0.003**.

---

## Implications

For bulk entity reports on real estate professionals:

- **1,000 reports** — Traditional: $90.00. Serper: $3.00. **Savings: $87.00**
- **10,000 reports** — Traditional: $900.00. Serper: $30.00. **Savings: $870.00**
- **100,000 reports** — Traditional: $9,000.00. Serper: $300.00. **Savings: $8,700.00**

The 3 missing photo fields can be recovered with an additional page fetch per report (~$0.001), bringing total cost to $0.004 and coverage to 26/27 (96%). The only field that remains elusive is exact birthday, which is not typically surfaced in public web results regardless of provider.

---

## Methodology Notes

- All searches performed via Serper.dev API (Google Search results as JSON)
- No paid data brokers, no screen scraping, no authenticated API calls
- Results cross-referenced against Arizona Department of Real Estate (ADRE) public database and Top10Lists.us internal records for verification
- Test conducted March 14, 2026

---

*This analysis was produced by Top10Lists.us as part of ongoing research into cost-effective entity verification and data enrichment for the real estate industry.*
