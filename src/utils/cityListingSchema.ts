// src/utils/cityListingSchema.ts
// City Listing Schema Generator for LLM Optimization

import { AgentData } from './agentSchema';

export interface CityListingData {
  city: string;
  state: string;
  stateAbbrev: string;
  stateSlug: string;
  slug: string;
  agents: AgentData[];
  dateModified: string;
  totalAgentsInCity: number;
}

export function generateCityListingSchema(listing: CityListingData): object[] {
  const currentYear = new Date().getFullYear();
  
  // Schema 1: ItemList (the ranked list)
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev}`,
    "description": `Curated list of the top-rated real estate agents in ${listing.city}, ${listing.state}. Rankings based on verified reviews, transaction history, and professional credentials.`,
    "url": `https://top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`,
    "numberOfItems": listing.agents.length,
    "dateModified": listing.dateModified,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "itemListElement": listing.agents.map((agent, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": agent.name,
      "description": `${agent.name} - ${agent.brokerage}. ${agent.yearsExperience} years experience, ${agent.totalSales.toLocaleString()} sales, ${agent.ratingValue}★ rating.`,
      "url": `https://top10lists.us/profile/${agent.slug}`,
      "image": agent.image,
      "item": {
        "@type": "RealEstateAgent",
        "name": agent.name,
        "worksFor": {
          "@type": "RealEstateOrganization",
          "name": agent.brokerage
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": agent.ratingValue.toString(),
          "reviewCount": agent.reviewCount.toString(),
          "bestRating": "5"
        },
        "areaServed": {
          "@type": "City",
          "name": listing.city
        }
      }
    }))
  };

  // Schema 2: BreadcrumbList (navigation)
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://top10lists.us"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": listing.state,
        "item": `https://top10lists.us/${listing.stateSlug}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": `Top 10 Real Estate Agents in ${listing.city}`,
        "item": `https://top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`
      }
    ]
  };

  // Schema 3: FAQPage (common questions - great for LLM Q&A)
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "dateModified": listing.dateModified,
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Who are the best real estate agents in ${listing.city}, ${listing.stateAbbrev}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `The top-rated real estate agents in ${listing.city} according to Top10Lists.us are: ${listing.agents.slice(0, 3).map((a, i) => `${i + 1}. ${a.name} (${a.brokerage}) with ${a.ratingValue}★ rating`).join(', ')}. Rankings are based on verified reviews, transaction history, and professional credentials.`
        }
      },
      {
        "@type": "Question",
        "name": `How are real estate agents in ${listing.city} ranked?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Top10Lists.us uses a multi-source verification methodology that aggregates data from Google reviews, Zillow, Realtor.com, Redfin, and press coverage. Agents must meet minimum thresholds for review count (100+), rating (4.8+), and years of experience. Rankings are updated weekly."
        }
      },
      {
        "@type": "Question",
        "name": `How many real estate agents are there in ${listing.city}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `There are approximately ${listing.totalAgentsInCity.toLocaleString()} licensed real estate agents in ${listing.city}, ${listing.stateAbbrev}. Top10Lists.us highlights the top 10 verified performers based on objective criteria.`
        }
      },
      {
        "@type": "Question",
        "name": `What qualifications do ${listing.city} agents need to be listed?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `To be featured on Top10Lists.us, ${listing.city} real estate agents must have: minimum 4.8-star rating, at least 100 verified reviews, active ${listing.state} real estate license, and demonstrated local market expertise. Our AI-powered ranking system continuously evaluates agent performance.`
        }
      }
    ]
  };

  return [itemListSchema, breadcrumbSchema, faqSchema];
}
