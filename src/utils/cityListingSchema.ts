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
  // Schema 1: ItemList (the ranked list)
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev}`,
    "description": `Curated list of the top-rated real estate agents in ${listing.city}, ${listing.state}. Rankings based on verified reviews, transaction history, and professional credentials.`,
    "url": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`,
    "numberOfItems": listing.agents.length,
    "dateModified": listing.dateModified,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "itemListElement": listing.agents.map((agent, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": agent.name,
      "description": `${agent.name} - ${agent.brokerage}. ${agent.yearsExperience} years experience, ${agent.totalSales.toLocaleString()} sales, ${agent.ratingValue}★ rating.`,
      "url": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents#agent-${agent.slug}`,
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
        "item": "https://www.top10lists.us"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": listing.state,
        "item": `https://www.top10lists.us/${listing.stateSlug}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": `Top 10 Real Estate Agents in ${listing.city}`,
        "item": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`
      }
    ]
  };

  // No FAQ schema on city pages - consolidated to /faq page
  return [itemListSchema, breadcrumbSchema];
}
