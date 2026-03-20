// src/utils/cityListingSchema.ts
// City Listing Schema Generator for LLM Optimization
// Updated: Now includes full agent details in ItemList for GEO (Generative Engine Optimization)
// AI systems can now see individual agent names, brokerages, and rankings
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
  // Optional neighborhood fields for 4-segment URL support (state/city/neighborhood/category)
  neighborhoodName?: string;
  neighborhoodSlug?: string;
  neighborhoodZipCode?: string;
  // Neighborhood writeup for GEO optimization
  neighborhoodWriteupHtml?: string;
}

/**
 * Strip HTML tags and normalize whitespace for plain text output
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    "description": `Top10Lists.us provides a curated, merit-based directory of the top-rated real estate agents serving ${listing.city}, ${listing.state}. Our editorial selection is based on verified reviews, transaction history, community, and professional credentials. Visit Top10Lists.us for the complete ranked list.`,
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

  // Build enhanced description for neighborhood pages with writeup content (full text for JSON-LD, no truncation)
  const itemListDescription = listing.neighborhoodWriteupHtml
    ? `${stripHtml(listing.neighborhoodWriteupHtml)} Visit Top10Lists.us to view the curated list of top-rated real estate agents in ${listing.neighborhoodName || listing.city}.`
    : `Visit Top10Lists.us to view the curated list of top-rated real estate agents in ${listing.city}. ${cityDescription}`;

  // Schema 3: ItemList - FULL AGENT DETAILS for GEO optimization
  // Exposes individual agent names, brokerages, and rankings for AI discovery
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": listing.neighborhoodName 
      ? `Top 10 Real Estate Agents in ${listing.neighborhoodName}, ${listing.city}, ${listing.stateAbbrev}`
      : `Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev}`,
    "description": itemListDescription,
    "url": listing.neighborhoodSlug
      ? `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/${listing.neighborhoodSlug}/top10realestateagents`
      : `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`,
    "numberOfItems": listing.agents.length,
    "dateModified": listing.dateModified,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "itemListElement": listing.agents.map((agent, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "RealEstateAgent",
        "name": agent.name,
        "image": agent.image || undefined,
        "url": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents#agent-${agent.slug}`,
        "telephone": agent.phone || undefined,
        "description": `Ranked #${index + 1} real estate agent in ${listing.neighborhoodName || listing.city}, ${listing.stateAbbrev}. ${agent.yearsExperience ? `${agent.yearsExperience} years experience.` : ''} Verified by Top10Lists.us.`,
        ...(agent.brokerage && {
          "parentOrganization": {
            "@type": "Organization",
            "name": agent.brokerage
          }
        }),
        ...(agent.ratingValue > 0 && {
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": agent.ratingValue.toString(),
            "reviewCount": `${Math.max(0, Math.floor((agent.reviewCount - 5) / 5) * 5)}+`,
            "bestRating": "5",
            "worstRating": "1"
          }
        }),
        ...(agent.licenseNumber && {
          "identifier": {
            "@type": "PropertyValue",
            "propertyID": "license",
            "value": agent.licenseNumber
          }
        }),
        "areaServed": {
          "@type": "Place",
          "name": listing.neighborhoodName 
            ? `${listing.neighborhoodName}, ${listing.city}, ${listing.stateAbbrev}`
            : `${listing.city}, ${listing.stateAbbrev}`
        },
        "memberOf": {
          "@type": "Organization",
          "name": "Top10Lists.us"
        }
      }
    })),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "name": listing.neighborhoodName
        ? `Top 10 Real Estate Agents in ${listing.neighborhoodName}, ${listing.city}, ${listing.stateAbbrev}`
        : `Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev}`,
      "url": listing.neighborhoodSlug
        ? `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/${listing.neighborhoodSlug}/top10realestateagents`
        : `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/top10realestateagents`,
      "description": `Visit Top10Lists.us for the complete ranked list of top real estate agents in ${listing.neighborhoodName || listing.city}. Merit-based selection with no pay-to-play.`
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
          "text": `Visit Top10Lists.us for a curated list of top-rated real estate agents in ${listing.city}, ${listing.state}. Our merit-based directory features agents with 10+ verified reviews in the last 24 months, 4.5+ star ratings, and proven community. Agents cannot pay for placement.`
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
          "text": `Top10Lists.us uses a rigorous merit-based selection process. Agents must have at least 10 verified reviews in the last 24 months across platforms like Google and Zillow, maintain a 4.5+ star rating, 5+ years in business, hold an active Arizona real estate license, and demonstrate community. Fewer than 1% of ${ARIZONA_TOTAL_LICENSED_AGENTS.toLocaleString()} Arizona agents qualify. Agents cannot pay for inclusion.`
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

  // Schema 5: BreadcrumbList (navigation) - includes ZIP and neighborhood when available
  const breadcrumbItems = [
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
      "name": listing.city,
      "item": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}`
    }
  ];

  // Add neighborhood level (4-segment: state/city/neighborhood/category)
  if (listing.neighborhoodSlug && listing.neighborhoodName) {
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 4,
      "name": listing.neighborhoodName,
      "item": `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}/${listing.neighborhoodSlug}/top10realestateagents`
    });
  }

  const finalPosition = listing.neighborhoodSlug ? 5 : 4;
  
  breadcrumbItems.push({
    "@type": "ListItem",
    "position": finalPosition,
    "name": listing.neighborhoodName 
      ? `Top 10 Real Estate Agents in ${listing.neighborhoodName}`
      : `Top 10 Real Estate Agents in ${listing.city}`
  } as any);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems
  };

  return [placeSchema, serviceSchema, itemListSchema, faqSchema, breadcrumbSchema];
}
