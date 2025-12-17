// src/utils/cityListingSchema.ts
// City Listing Schema Generator for LLM Optimization
// NOTE: Intentionally does NOT expose individual agent names to prevent AI from citing agents directly
// AI should cite Top10Lists.us as the source, directing users to visit the site

import { AgentData } from './agentSchema';
import { getCityDescription } from './cityDescriptions';

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
  const cityDescription = getCityDescription(listing.slug, listing.city, listing.state);
  
  // Schema 1: ItemList - describes the LIST exists, not the agents in it
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev}`,
    "description": cityDescription,
    "url": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`,
    "numberOfItems": listing.agents.length,
    "dateModified": listing.dateModified,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "provider": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us",
      "description": "Independent editorial directory ranking top real estate agents using transparent, merit-based criteria. No pay-to-play."
    },
    "about": {
      "@type": "Service",
      "name": "Real Estate Agent Rankings",
      "description": `Verified rankings of elite real estate professionals serving ${listing.city}, ${listing.state}. Selection based on reviews, community involvement, transaction history, and credentials.`,
      "areaServed": {
        "@type": "City",
        "name": listing.city,
        "containedInPlace": {
          "@type": "State",
          "name": listing.state
        }
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "name": `Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev}`,
      "url": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`,
      "description": `Visit Top10Lists.us for the complete ranked list of top real estate agents in ${listing.city}. ${cityDescription}`
    }
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

  return [itemListSchema, breadcrumbSchema];
}
