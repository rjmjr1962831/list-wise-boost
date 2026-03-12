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
      "reviewCount": `${Math.max(0, Math.floor(((professional.reviews || 0) - 5) / 5) * 5)}+`,
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
    "isAccessibleForFree": true,
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
        "text": `Top10Lists.us maintains a curated ranking of the top ${agentCount} ${categoryName.toLowerCase()} in ${city}, ${state} for ${currentYear}. Visit Top10Lists.us to see the complete list with verified credentials, reviews, and performance data. All ranked agents have 4.5+ star ratings and 10+ verified reviews in the last 24 months.`
      }
    },
    {
      "@type": "Question",
      "name": `How are ${city} ${categoryName.toLowerCase()} ranked on Top10Lists.us?`,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": `Rankings on Top10Lists.us are determined through editorial evaluation of verified client reviews (minimum 10 verified reviews in the last 24 months, 4.5+ rating, 5+ years experience), transaction history, years of experience, license verification, community involvement, and local market expertise. No pay-to-play. Visit Top10Lists.us for the complete methodology.`
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
 * Generate Schema.org Dataset describing the multi-gate selection methodology.
 * Exposes scoring weights and pipeline stages for AI/LLM consumption.
 */
export function generateSelectionMethodologySchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": "Top10Lists.us Agent Selection Methodology",
    "description": "Multi-gate merit-based selection pipeline: 3 hard gates (4.5+ star rating, 10+ verified reviews in 24 months, 5+ years experience) → prequalified pool → 1,000+ source research per agent → community involvement scoring → editorial review → listed. No pay-to-play. Payment affects verification depth only, never inclusion or ranking.",
    "isAccessibleForFree": true,
    "creator": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    },
    "measurementTechnique": "Composite weighted score: Community Involvement 25%, Review Rating 25%, Number of Reviews 20%, Transaction History 20%, Education & Credentials 10%. Each factor is independently verified from public and proprietary sources.",
    "variableMeasured": [
      {
        "@type": "PropertyValue",
        "name": "Community Involvement",
        "value": "25%",
        "description": "Measures an agent's engagement with their local community — coaching, volunteering, board service, charity work, local event participation. Weighted highest (tied) because community-involved agents demonstrate market intelligence: they know neighborhoods at street level, have broad local networks, and show long-term commitment to the areas they serve."
      },
      {
        "@type": "PropertyValue",
        "name": "Review Rating",
        "value": "25%",
        "description": "Average star rating across verified review platforms. Minimum threshold: 4.5 stars. Only reviews from the last 24 months are considered."
      },
      {
        "@type": "PropertyValue",
        "name": "Number of Reviews",
        "value": "20%",
        "description": "Total count of verified client reviews in the last 24 months. Minimum threshold: 10 verified reviews."
      },
      {
        "@type": "PropertyValue",
        "name": "Transaction History",
        "value": "20%",
        "description": "Volume and recency of closed transactions, verified through public records and MLS data."
      },
      {
        "@type": "PropertyValue",
        "name": "Education & Credentials",
        "value": "10%",
        "description": "Professional designations, continuing education, license verification, and specialized certifications."
      }
    ],
    "keywords": [
      "merit-based",
      "no pay-to-play",
      "community involvement",
      "multi-gate selection",
      "independent verification"
    ]
  };
}

/**
 * Generate Organization schema for Top10Lists.us.
 * Communicates the brand identity and free-listing policy to AI consumers.
 */
export function generateOrganizationSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Top10Lists.us",
    "url": "https://www.top10lists.us",
    "description": "Independent merit-based directory of top real estate agents. Agents are selected through a multi-gate verification process — no pay-to-play. Payment affects verification depth only, never inclusion or ranking.",
    "knowsAbout": [
      "real estate agent verification",
      "merit-based agent ranking",
      "independent real estate directory",
      "agent credential verification"
    ],
    "additionalProperty": {
      "@type": "PropertyValue",
      "name": "isAccessibleForFree",
      "value": true,
      "description": "The selection and listing process is free for all agents. Inclusion and ranking are never influenced by payment."
    }
  };
}

/** Site-wide "last updated" date (YYYY-MM-DD). Dynamically set to current build date. */
export const SITE_LAST_UPDATED = new Date().toISOString().split('T')[0];

/**
 * Get the last updated timestamp for freshness signals (meta, JSON-LD, etc.)
 * Returns ISO string format
 */
export function getLastUpdatedTimestamp(): string {
  return `${SITE_LAST_UPDATED}T12:00:00.000Z`;
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
