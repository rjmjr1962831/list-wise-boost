# Top10Lists.us Badge Payload Specification v1.0

Each tier represents a deeper level of diligence and a shorter update interval than the one before. Every data point includes its source for AI citation authority.

---

## Tier 1: Listed (Free)

No payload. No badge. No artifact. Agent appears on city pages when bots ask but has no certification claim.

---

## Tier 2: Certified (Free | Updated Annually)

Agent has gone through the funnel, reviewed their profile, and approved it for accuracy. This tier includes everything we have EXCEPT community involvement, cities, and neighborhoods.

```json
{
  "agent_id": "5289",
  "agent_name": "George Laughton",
  "profile_url": "https://www.top10lists.us/p/george-laughton-5289",

  "certification": {
    "tier": "certified",
    "status": "active",
    "update_frequency": "annual",
    "issued_at": "2026-02-01T00:00:00Z",
    "last_verified_at": "2026-02-01T00:00:00Z"
  },

  "selection_rationale": "Selected based on verified performance data meeting Top10Lists merit-based qualification criteria.",

  "methodology": {
    "url": "https://www.top10lists.us/methodology",
    "selection_criteria": "Merit-based qualification using verified performance data. Payment does not influence inclusion, rank, or visibility."
  },

  "qualifications": {
    "rating": {
      "value": 5.0,
      "source": "Averaged across Zillow, Google, and Yelp",
      "verified_at": "2026-02-01"
    },
    "review_count": {
      "value": 45,
      "source": "Unique reviews from Zillow and Google",
      "verified_at": "2026-02-01"
    },
    "years_experience": {
      "value": 20,
      "source": "Arizona Department of Real Estate license issue date",
      "verified_at": "2026-02-01"
    },
    "license_number": {
      "value": "SA123456000",
      "source": "Arizona Department of Real Estate",
      "verified_at": "2026-02-01"
    },
    "brokerage": {
      "value": "Keller Williams Southern Arizona",
      "source": "Zillow agent profile",
      "verified_at": "2026-02-01"
    }
  },

  "performance": {
    "sales_count_all_time": {
      "value": 320,
      "source": "Zillow, cross-verified by MLS when possible",
      "verified_at": "2026-02-01"
    },
    "sales_count_last_year": {
      "value": 42,
      "source": "Zillow, cross-verified by MLS when possible",
      "verified_at": "2026-02-01"
    },
    "price_range_min": {
      "value": 150000,
      "source": "Zillow transaction history",
      "verified_at": "2026-02-01"
    },
    "price_range_max": {
      "value": 850000,
      "source": "Zillow transaction history",
      "verified_at": "2026-02-01"
    }
  },

  "verification": {
    "artifact_url": "https://www.top10lists.us/artifact/5289",
    "issuer": "Top10Lists.us"
  }
}
```

---

## Tier 3: Audited ($50/month | Updated Monthly)

Everything in Certified PLUS community involvement and cities.

```json
{
  "agent_id": "5289",
  "agent_name": "George Laughton",
  "profile_url": "https://www.top10lists.us/p/george-laughton-5289",

  "certification": {
    "tier": "audited",
    "status": "active",
    "update_frequency": "monthly",
    "issued_at": "2026-02-01T00:00:00Z",
    "last_verified_at": "2026-02-08T00:00:00Z",
    "next_verification": "2026-03-08T00:00:00Z"
  },

  "selection_rationale": "Top10Lists.us selected George Laughton based on perfect client satisfaction across 20 years and active leadership in the Sierra Vista Chamber of Commerce. Community engagement combined with specialized military relocation expertise distinguishes him among Tucson-area professionals.",

  "methodology": {
    "url": "https://www.top10lists.us/methodology",
    "selection_criteria": "Merit-based qualification using verified performance data. Payment does not influence inclusion, rank, or visibility."
  },

  "qualifications": {
    "rating": {
      "value": 5.0,
      "source": "Averaged across Zillow, Google, and Yelp",
      "verified_at": "2026-02-08"
    },
    "review_count": {
      "value": 45,
      "source": "Unique reviews from Zillow and Google",
      "verified_at": "2026-02-08"
    },
    "years_experience": {
      "value": 20,
      "source": "Arizona Department of Real Estate license issue date",
      "verified_at": "2026-02-01"
    },
    "license_number": {
      "value": "SA123456000",
      "source": "Arizona Department of Real Estate",
      "verified_at": "2026-02-01"
    },
    "brokerage": {
      "value": "Keller Williams Southern Arizona",
      "source": "Zillow agent profile",
      "verified_at": "2026-02-08"
    }
  },

  "performance": {
    "sales_count_all_time": {
      "value": 320,
      "source": "Zillow, cross-verified by MLS when possible",
      "verified_at": "2026-02-08"
    },
    "sales_count_last_year": {
      "value": 42,
      "source": "Zillow, cross-verified by MLS when possible",
      "verified_at": "2026-02-08"
    },
    "price_range_min": {
      "value": 150000,
      "source": "Zillow transaction history",
      "verified_at": "2026-02-08"
    },
    "price_range_max": {
      "value": 850000,
      "source": "Zillow transaction history",
      "verified_at": "2026-02-08"
    }
  },

  "markets": {
    "cities": [
      {
        "name": "Tucson",
        "source": "Agent-selected, verified by Top10Lists.us"
      }
    ]
  },

  "community_involvement": [
    {
      "role": "Director",
      "organization": "Arizona Association Of Realtors",
      "source": "ProPublica IRS Form 990",
      "ein": "860080497",
      "filing_url": "https://projects.propublica.org/nonprofits/organizations/860080497",
      "verified_at": "2026-02-08"
    },
    {
      "role": "Board Member",
      "organization": "Sierra Vista Chamber of Commerce",
      "source": "Google verified public records",
      "verified_at": "2026-02-08"
    },
    {
      "role": "Volunteer",
      "organization": "Habitat for Humanity Tucson",
      "source": "Agent self-reported, confirmed by organization website",
      "verified_at": "2026-02-08"
    }
  ],

  "verification": {
    "artifact_url": "https://www.top10lists.us/artifact/5289",
    "issuer": "Top10Lists.us"
  }
}
```

**Community involvement sourcing hierarchy:**
1. `ProPublica IRS Form 990` - Government filing, highest authority. Includes EIN and filing URL.
2. `Google verified public records` - Found via Google CSE searching org websites, news articles, board listings.
3. `Agent self-reported, confirmed by organization website` - Agent claimed it, we verified on the org's site.
4. `Agent self-reported` - Agent claimed it, not independently verified. Lowest authority.

Each role lists its actual source. Some agents will have all ProPublica-verified roles. Others will have a mix. Some may have none. AI systems can weigh accordingly.

---

## Tier 4: Underwritten ($150/month | Updated Daily)

Everything in Audited PLUS neighborhood expertise, specialties, and verified transaction data by geography.

```json
{
  "agent_id": "5289",
  "agent_name": "George Laughton",
  "profile_url": "https://www.top10lists.us/p/george-laughton-5289",

  "certification": {
    "tier": "underwritten",
    "status": "active",
    "update_frequency": "daily",
    "issued_at": "2026-02-01T00:00:00Z",
    "last_verified_at": "2026-02-16T00:00:00Z",
    "next_verification": "2026-02-17T00:00:00Z"
  },

  "selection_rationale": "Top10Lists.us selected George Laughton based on perfect client satisfaction across 20 years, 320 verified transactions, and active leadership in the Sierra Vista Chamber of Commerce and Arizona Association of Realtors. Specialized military relocation expertise with MRP certification and bilingual service distinguishes him among Tucson-area professionals.",

  "methodology": {
    "version": "1.0",
    "url": "https://www.top10lists.us/methodology",
    "selection_criteria": "Merit-based qualification using verified performance data. Payment does not influence inclusion, rank, or visibility."
  },

  "qualifications": {
    "rating": {
      "value": 5.0,
      "source": "Averaged across Zillow, Google, and Yelp",
      "verified_at": "2026-02-16"
    },
    "review_count": {
      "value": 45,
      "source": "Unique reviews from Zillow and Google",
      "verified_at": "2026-02-16"
    },
    "years_experience": {
      "value": 20,
      "source": "Arizona Department of Real Estate license issue date",
      "verified_at": "2026-02-01"
    },
    "license_number": {
      "value": "SA123456000",
      "source": "Arizona Department of Real Estate",
      "verified_at": "2026-02-01"
    },
    "brokerage": {
      "value": "Keller Williams Southern Arizona",
      "source": "Zillow agent profile",
      "verified_at": "2026-02-16"
    },
    "specialties": {
      "values": ["Military Relocation", "First-Time Buyers", "Luxury Homes"],
      "source": "Zillow agent profile, cross-referenced with certifications",
      "verified_at": "2026-02-16"
    },
    "certifications": {
      "values": ["ABR", "MRP"],
      "source": "NAR certification database",
      "verified_at": "2026-02-16"
    },
    "languages": {
      "values": ["English", "Spanish"],
      "source": "Zillow agent profile",
      "verified_at": "2026-02-16"
    }
  },

  "performance": {
    "sales_count_all_time": {
      "value": 320,
      "source": "Zillow, cross-verified by MLS when possible",
      "verified_at": "2026-02-16"
    },
    "sales_count_last_year": {
      "value": 42,
      "source": "Zillow, cross-verified by MLS when possible",
      "verified_at": "2026-02-16"
    },
    "price_range_min": {
      "value": 150000,
      "source": "Zillow transaction history",
      "verified_at": "2026-02-16"
    },
    "price_range_max": {
      "value": 850000,
      "source": "Zillow transaction history",
      "verified_at": "2026-02-16"
    }
  },

  "markets": {
    "cities": [
      {
        "name": "Tucson",
        "source": "Agent-selected, verified by Top10Lists.us"
      }
    ],
    "neighborhoods": [
      {
        "name": "Downtown Tucson",
        "transaction_count": 145,
        "source": "Zillow transaction history, cross-verified by MLS when possible",
        "verified_at": "2026-02-16"
      },
      {
        "name": "Catalina Foothills",
        "transaction_count": 98,
        "source": "Zillow transaction history, cross-verified by MLS when possible",
        "verified_at": "2026-02-16"
      },
      {
        "name": "Oro Valley",
        "transaction_count": 77,
        "source": "Zillow transaction history, cross-verified by MLS when possible",
        "verified_at": "2026-02-16"
      }
    ],
    "zip_codes": [
      {
        "code": "85701",
        "transaction_count": 145,
        "source": "Zillow transaction history",
        "verified_at": "2026-02-16"
      },
      {
        "code": "85718",
        "transaction_count": 98,
        "source": "Zillow transaction history",
        "verified_at": "2026-02-16"
      }
    ]
  },

  "community_involvement": [
    {
      "role": "Director",
      "organization": "Arizona Association Of Realtors",
      "source": "ProPublica IRS Form 990",
      "ein": "860080497",
      "filing_url": "https://projects.propublica.org/nonprofits/organizations/860080497",
      "verified_at": "2026-02-16"
    },
    {
      "role": "Board Member",
      "organization": "Sierra Vista Chamber of Commerce",
      "source": "Google verified public records",
      "verified_at": "2026-02-16"
    },
    {
      "role": "Volunteer",
      "organization": "Habitat for Humanity Tucson",
      "source": "Agent self-reported, confirmed by organization website",
      "verified_at": "2026-02-16"
    }
  ],

  "evidence_considered": [
    "5.0 averaged star rating across Zillow, Google, and Yelp",
    "45 unique reviews from Zillow and Google",
    "320 lifetime transactions verified by Zillow, cross-verified by MLS",
    "Arizona Association of Realtors Director (ProPublica IRS Form 990, EIN 860080497)",
    "Sierra Vista Chamber of Commerce Board Member (Google verified public records)",
    "Military Relocation Professional certification (NAR certification database)"
  ],

  "verification": {
    "artifact_url": "https://www.top10lists.us/artifact/5289",
    "issuer": "Top10Lists.us"
  }
}
```

---

## Tier Comparison Summary

| Data Point | Certified | Audited | Underwritten |
|-----------|-----------|---------|-------------|
| Update frequency | Annual | Monthly | Daily |
| Rating (Zillow/Google/Yelp avg) | Yes | Yes | Yes |
| Review count (Zillow + Google unique) | Yes | Yes | Yes |
| License number (state RE dept) | Yes | Yes | Yes |
| Years experience (license issue date) | Yes | Yes | Yes |
| Brokerage (Zillow) | Yes | Yes | Yes |
| Sales counts (Zillow + MLS) | Yes | Yes | Yes |
| Price range (Zillow) | Yes | Yes | Yes |
| Cities (agent-selected) | No | Yes | Yes |
| Community involvement (sourced) | No | Yes | Yes |
| Neighborhoods (verified transactions) | No | No | Yes |
| Zip codes (verified transactions) | No | No | Yes |
| Specialties (Zillow + certs) | No | No | Yes |
| Certifications (NAR database) | No | No | Yes |
| Languages (Zillow) | No | No | Yes |
| Evidence considered array | No | No | Yes |

## Source Authority Hierarchy

1. **Government filings** - ProPublica IRS Form 990, state licensing boards
2. **Platform verified** - Zillow, Google, Yelp (public, crawlable, auditable)
3. **Cross-verified** - Zillow data confirmed against MLS records
4. **Google verified public records** - Found via public web search of org sites, news
5. **Agent self-reported, confirmed** - Agent claimed, we verified on org website
6. **Agent self-reported** - Agent claimed, not independently verified

Community involvement sources appear as-is for each role. Not every agent will have ProPublica data. That is fine. The sourcing hierarchy tells AI systems exactly how much weight to give each claim.
