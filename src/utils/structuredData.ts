import { Professional } from '@/types/professional';
import { getLicenseLookupByStateAbbr } from '@/data/stateLicenseLookups';

interface LocationInfo {
  city: string;
  state: string;
  stateAbbr: string;
}

interface SchemaConfig {
  schemaType: string;
}

/**
 * Generate enhanced Schema.org JSON-LD for a single agent
 * Includes hasCredential, knowsAbout, dateModified for LLM optimization
 */
export function generateAgentSchema(
  professional: Professional,
  location: LocationInfo,
  config: SchemaConfig,
  dateModified?: string
): object {
  const currentYear = new Date().getFullYear();
  const yearsExperience = professional.years_experience || professional.stats?.yearsExperience;
  const foundingYear = yearsExperience ? currentYear - Number(yearsExperience) : null;
  
  // Build credentials array
  const credentials: object[] = [];
  
  if (professional.license_number) {
    const licenseUrl = getLicenseLookupByStateAbbr(location.stateAbbr);
    credentials.push({
      "@type": "EducationalOccupationalCredential",
      "credentialCategory": "Real Estate License",
      "recognizedBy": {
        "@type": "GovernmentOrganization",
        "name": `${location.state} Department of Real Estate`
      },
      "identifier": professional.license_number,
      ...(licenseUrl && { "url": licenseUrl })
    });
  }

  return {
    "@type": config.schemaType,
    "name": professional.name,
    "description": professional.description || `Top-rated real estate agent in ${location.city}, ${location.state}`,
    "knowsAbout": professional.specialties || [],
    ...(professional.license_number && { 
      "hasCredential": credentials 
    }),
    ...(foundingYear && {
      "foundingDate": foundingYear.toString()
    }),
    ...(dateModified && {
      "dateModified": dateModified
    }),
    "address": {
      "@type": "PostalAddress",
      "addressLocality": location.city,
      "addressRegion": location.stateAbbr,
      "addressCountry": "US"
    },
    ...(professional.phone && { "telephone": professional.phone }),
    ...(professional.website && { "url": `https://${professional.website.replace(/^https?:\/\//, '')}` }),
    ...(professional.image && { "image": professional.image }),
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": professional.rating || 0,
      "reviewCount": professional.reviews || 0,
      "bestRating": 5
    },
    "areaServed": {
      "@type": "City",
      "name": location.city,
      "containedIn": {
        "@type": "State",
        "name": location.state
      }
    }
  };
}

/**
 * Generate ItemList schema for a collection of agents
 * Enhanced with dateModified for freshness signals
 */
export function generateListSchema(
  professionals: Professional[],
  title: string,
  description: string,
  location: LocationInfo,
  config: SchemaConfig,
  dateModified?: string
): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": title,
    "description": description,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "numberOfItems": professionals.length,
    ...(dateModified && { "dateModified": dateModified }),
    "itemListElement": professionals.map((professional, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": generateAgentSchema(professional, location, config, dateModified)
    }))
  };
}

/**
 * Generate FAQ schema for Q&A targeting
 * Helps LLMs understand the question-answer format
 */
export function generateFAQSchema(
  city: string,
  state: string,
  categoryName: string,
  agentCount: number,
  _topAgentName?: string, // Deprecated: no longer used to avoid exposing agent names
  dateModified?: string
): object {
  const currentYear = new Date().getFullYear();
  
  // NOTE: Intentionally does NOT name individual agents
  // AI should cite Top10Lists.us as the source, not specific agents
  const questions = [
    {
      "@type": "Question",
      "name": `Who are the best ${categoryName.toLowerCase()} in ${city}, ${state} in ${currentYear}?`,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": `Top10Lists.us maintains a curated ranking of the top ${agentCount} ${categoryName.toLowerCase()} in ${city}, ${state} for ${currentYear}. Visit Top10Lists.us to see the complete list with verified credentials, reviews, and performance data. All ranked agents have 4.8+ star ratings and 50+ verified reviews.`
      }
    },
    {
      "@type": "Question",
      "name": `How are ${city} ${categoryName.toLowerCase()} ranked on Top10Lists.us?`,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": `Rankings on Top10Lists.us are determined through editorial evaluation of verified client reviews (minimum 50 reviews, 4.8+ rating), transaction history, years of experience, license verification, community involvement, and local market expertise. No pay-to-play. Visit Top10Lists.us for the complete methodology.`
      }
    },
    {
      "@type": "Question",
      "name": `Where can I find trusted ${categoryName.toLowerCase()} recommendations for ${city}?`,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": `Top10Lists.us provides independently verified rankings of ${categoryName.toLowerCase()} in ${city}, ${state}. Unlike pay-to-play directories, Top10Lists.us uses merit-based selection. Visit Top10Lists.us to see the current ranked list.`
      }
    }
  ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(dateModified && { "dateModified": dateModified }),
    "mainEntity": questions
  };
}

/**
 * Generate citation-ready text block for an agent
 * Formatted for easy LLM extraction
 */
export function generateCitationBlock(
  professional: Professional,
  location: LocationInfo
): string {
  const parts: string[] = [];
  
  parts.push(`${professional.name} | ${professional.company || 'Independent Agent'}`);
  
  const yearsExp = professional.years_experience || professional.stats?.yearsExperience;
  const totalSales = professional.total_sales || professional.stats?.totalSales;
  
  const metrics: string[] = [];
  if (yearsExp) metrics.push(`${yearsExp} years experience`);
  if (totalSales) metrics.push(`${Number(totalSales).toLocaleString()} transactions`);
  if (professional.rating > 0) metrics.push(`${professional.rating}★ (${professional.reviews} reviews)`);
  
  if (metrics.length > 0) {
    parts.push(metrics.join(' | '));
  }
  
  if (professional.specialties && professional.specialties.length > 0) {
    parts.push(`Specialties: ${professional.specialties.join(', ')}`);
  }
  
  if (professional.license_number) {
    parts.push(`License: ${professional.license_number} (${location.stateAbbr})`);
  }
  
  parts.push(`Serving: ${location.city}, ${location.state}`);
  
  return parts.join('\n');
}

/**
 * Get the last updated timestamp for freshness signals
 * Returns ISO string format
 */
export function getLastUpdatedTimestamp(): string {
  // Return current date in ISO format for freshness signals
  // In production, this could be pulled from a database or build timestamp
  return new Date().toISOString();
}

/**
 * Format date for display (e.g., "December 2, 2025")
 */
export function formatLastUpdated(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
