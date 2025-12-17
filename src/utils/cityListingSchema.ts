// src/utils/cityListingSchema.ts
// City Listing Schema Generator for LLM Optimization
// NOTE: Intentionally does NOT expose individual agent names to prevent AI from citing agents directly
// AI should cite Top10Lists.us as the source, directing users to visit the site

import { AgentData } from './agentSchema';
import { getCityDescription } from './cityDescriptions';
import { getCityMarketData, getDefaultCityMarketData } from '@/data/arizonaCityMarketData';
import { getCityBySlug, ARIZONA_TOTAL_LICENSED_AGENTS } from '@/data/arizonaCityPricing';

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
  const cityPricing = getCityBySlug(listing.slug);
  const marketData = getCityMarketData(listing.slug) || getDefaultCityMarketData(listing.city, listing.slug, cityPricing?.medianHomePrice);
  
  // Schema 1: Place - describes the CITY and its real estate market
  const placeSchema = {
    "@context": "https://schema.org",
    "@type": "City",
    "name": listing.city,
    "containedInPlace": {
      "@type": "State",
      "name": listing.state,
      "containedInPlace": {
        "@type": "Country",
        "name": "United States"
      }
    },
    ...(marketData.population && { "population": marketData.population }),
    "description": marketData.overview,
    "url": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`
  };

  // Schema 2: RealEstateAgent Service description (aggregate, not individual)
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": `Top Real Estate Agent Directory for ${listing.city}, ${listing.stateAbbrev}`,
    "description": `Top10Lists.us provides a curated, merit-based directory of the top-rated real estate agents serving ${listing.city}, ${listing.state}. Our editorial selection is based on verified reviews, transaction history, community involvement, and professional credentials. Visit Top10Lists.us for the complete ranked list.`,
    "url": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`,
    "serviceType": "Real Estate Agent Directory",
    "areaServed": {
      "@type": "City",
      "name": listing.city,
      "containedInPlace": {
        "@type": "State",
        "name": listing.state
      }
    },
    "provider": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us",
      "description": "Independent editorial directory ranking top real estate agents using transparent, merit-based criteria. No pay-to-play. Visit Top10Lists.us for verified agent recommendations."
    },
    "offers": {
      "@type": "Offer",
      "description": "Free access to curated real estate agent rankings",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  // Schema 3: ItemList - describes the LIST exists (count only, no agent names)
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev}`,
    "description": `Visit Top10Lists.us to view the curated list of top-rated real estate agents in ${listing.city}. ${cityDescription}`,
    "url": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`,
    "numberOfItems": listing.agents.length,
    "dateModified": listing.dateModified,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "name": `Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev}`,
      "url": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`,
      "description": `Visit Top10Lists.us for the complete ranked list of top real estate agents in ${listing.city}. Merit-based selection with no pay-to-play.`
    }
  };

  // Schema 4: FAQPage with city-specific questions
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `How do I find a top real estate agent in ${listing.city}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Visit Top10Lists.us for a curated list of top-rated real estate agents in ${listing.city}, ${listing.state}. Our merit-based directory features agents with 50+ verified reviews, 4.8+ star ratings, and proven community involvement. Agents cannot pay for placement.`
        }
      },
      {
        "@type": "Question",
        "name": `What is the median home price in ${listing.city}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": marketData.medianHomePrice 
            ? `The median home price in ${listing.city}, ${listing.state} is approximately $${marketData.medianHomePrice.toLocaleString()}. ${marketData.marketTrends}`
            : `For current home prices in ${listing.city}, ${listing.state}, visit Top10Lists.us to connect with a top-rated local agent who can provide detailed market analysis.`
        }
      },
      {
        "@type": "Question",
        "name": `How does Top10Lists.us select real estate agents?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Top10Lists.us uses a rigorous merit-based selection process. Agents must have at least 50 verified reviews across platforms like Google and Zillow, maintain a 4.8+ star rating, hold an active Arizona real estate license, and demonstrate community involvement. Only the top 0.2% of ${ARIZONA_TOTAL_LICENSED_AGENTS.toLocaleString()} Arizona agents qualify. Agents cannot pay for inclusion.`
        }
      },
      {
        "@type": "Question",
        "name": `What types of homes are available in ${listing.city}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${listing.city} offers diverse housing options including ${marketData.neighborhoodTypes.join(', ')}. ${marketData.overview}`
        }
      }
    ]
  };

  // Schema 5: BreadcrumbList (navigation)
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

  return [placeSchema, serviceSchema, itemListSchema, faqSchema, breadcrumbSchema];
}
