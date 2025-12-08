// src/utils/agentSchema.ts
// Scalable Agent Profile Schema Generator for LLM Optimization

import { Professional } from '@/types/professional';

export interface AgentSchemaData {
  name: string;
  slug: string;
  image: string;
  brokerage: string;
  description: string;
  ratingValue: number;
  reviewCount: number;
  city: string;
  state: string;
  stateAbbrev: string;
  licenseNumber: string;
  yearsExperience: number;
  totalSales: number;
  specialties: string[];
  phone?: string;
  email?: string;
  website?: string;
  zillowUrl?: string;
  socialLinkedin?: string;
  socialFacebook?: string;
  socialInstagram?: string;
  dateModified: string;
  achievements?: string[];
}

/**
 * Generates a scalable JSON-LD schema for individual agent profiles
 * Template designed for LLM ingestion and citation
 */
export function generateAgentProfileSchema(agent: AgentSchemaData): object {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": agent.name,
    "worksFor": {
      "@type": "Organization",
      "name": agent.brokerage || "Independent Agent"
    },
    // Use city page anchor instead of profile URL to prevent profile indexing
    "url": `https://top10lists.us/${agent.stateAbbrev.toLowerCase()}/${agent.city.toLowerCase().replace(/\s+/g, '-')}/top10realestateagents#agent-${agent.slug}`,
    "image": agent.image,
    "description": `Top ${agent.city} real estate agent with ${agent.yearsExperience || 'extensive'} years of experience and ${agent.totalSales > 0 ? `${agent.totalSales.toLocaleString()} verified sales` : 'proven track record'}.`,
    "areaServed": {
      "@type": "Place",
      "name": `${agent.city}, ${agent.state}`
    },
    "memberOf": {
      "@type": "Organization",
      "name": "Top10Lists.us"
    },
    "dateModified": agent.dateModified
  };

  // Add aggregate rating if available
  if (agent.ratingValue > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": agent.ratingValue.toString(),
      "reviewCount": agent.reviewCount.toString(),
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  // Add specialties array
  if (agent.specialties && agent.specialties.length > 0) {
    schema.specialty = agent.specialties;
    schema.knowsAbout = agent.specialties;
  }

  // Add license identifier
  if (agent.licenseNumber) {
    schema.identifier = {
      "@type": "PropertyValue",
      "propertyID": "license",
      "value": agent.licenseNumber
    };
    
    schema.hasCredential = {
      "@type": "EducationalOccupationalCredential",
      "credentialCategory": "Real Estate License",
      "recognizedBy": {
        "@type": "GovernmentOrganization",
        "name": `${agent.state} Department of Real Estate`
      },
      "identifier": agent.licenseNumber
    };
  }

  // Add contact info
  if (agent.phone) schema.telephone = agent.phone;
  if (agent.email) schema.email = agent.email;

  // Add sameAs for external profiles
  const sameAs: string[] = [];
  if (agent.zillowUrl) sameAs.push(agent.zillowUrl);
  if (agent.website) sameAs.push(agent.website);
  if (agent.socialLinkedin) sameAs.push(agent.socialLinkedin);
  if (agent.socialFacebook) sameAs.push(agent.socialFacebook);
  if (agent.socialInstagram) sameAs.push(agent.socialInstagram);
  if (sameAs.length > 0) schema.sameAs = sameAs;

  // Add achievements/awards
  if (agent.achievements && agent.achievements.length > 0) {
    schema.award = agent.achievements.slice(0, 10);
  }

  // Add additional properties for LLM context
  schema.additionalProperty = [
    {
      "@type": "PropertyValue",
      "name": "Years of Experience",
      "value": agent.yearsExperience || "NA"
    },
    {
      "@type": "PropertyValue",
      "name": "Total Sales",
      "value": agent.totalSales || "NA"
    }
  ];

  return schema;
}

/**
 * Converts a Professional database record to AgentSchemaData
 */
export function professionalToSchemaData(
  professional: Professional,
  city: string,
  state: string,
  stateAbbrev: string,
  agentSlug: string
): AgentSchemaData {
  const extendedProf = professional as any;
  
  // Extract achievements from notable_achievements
  const achievements: string[] = [];
  if (extendedProf.notable_achievements && Array.isArray(extendedProf.notable_achievements)) {
    extendedProf.notable_achievements.forEach((a: any) => {
      if (a?.title) achievements.push(a.title);
      else if (a?.text) achievements.push(a.text);
    });
  }

  return {
    name: professional.name,
    slug: agentSlug || professional.id || '',
    image: professional.image || extendedProf.image_url || '/placeholder.svg',
    brokerage: professional.company || 'Independent Agent',
    description: professional.description || extendedProf.synthesized_bio || `Top-rated real estate agent in ${city}, ${stateAbbrev}`,
    ratingValue: professional.rating || 0,
    reviewCount: professional.reviews || 0,
    city,
    state,
    stateAbbrev,
    licenseNumber: professional.license_number || '',
    yearsExperience: extendedProf.years_experience || professional.stats?.yearsExperience || 0,
    totalSales: extendedProf.total_sales || professional.stats?.totalSales || 0,
    specialties: professional.specialties || [],
    phone: professional.phone,
    email: professional.email,
    website: professional.website,
    zillowUrl: extendedProf.zillow_profile_url,
    socialLinkedin: extendedProf.social_linkedin,
    socialFacebook: extendedProf.social_facebook,
    socialInstagram: extendedProf.social_instagram,
    dateModified: new Date().toISOString(),
    achievements: achievements.length > 0 ? achievements : undefined
  };
}

/**
 * Generates a city-level Q&A schema for multiple agents
 * Used on "Best Real Estate Agents in [City] 2025" pages
 */
export function generateCityAgentListSchema(
  city: string,
  state: string,
  stateAbbrev: string,
  agents: AgentSchemaData[],
  dateModified: string
): object[] {
  const currentYear = new Date().getFullYear();
  
  // Main ItemList schema
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Top 10 Real Estate Agents in ${city}, ${stateAbbrev} (${currentYear})`,
    "description": `Curated list of the top-rated real estate agents serving ${city}, ${state}. Updated daily with verified ratings and reviews.`,
    "url": `https://top10lists.us/${stateAbbrev.toLowerCase()}/${city.toLowerCase().replace(/\s+/g, '-')}/best-real-estate-agents-${currentYear}`,
    "numberOfItems": agents.length,
    "dateModified": dateModified,
    "itemListElement": agents.slice(0, 10).map((agent, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": agent.name,
      // Use city page anchor instead of profile URL to prevent profile indexing
      "url": `https://top10lists.us/${stateAbbrev.toLowerCase()}/${city.toLowerCase().replace(/\s+/g, '-')}/top10realestateagents#agent-${agent.slug}`,
      "item": {
        "@type": "RealEstateAgent",
        "name": agent.name,
        "worksFor": {
          "@type": "Organization",
          "name": agent.brokerage
        },
        "image": agent.image,
        "aggregateRating": agent.ratingValue > 0 ? {
          "@type": "AggregateRating",
          "ratingValue": agent.ratingValue.toString(),
          "reviewCount": agent.reviewCount.toString(),
          "bestRating": "5"
        } : undefined,
        "areaServed": {
          "@type": "Place",
          "name": `${city}, ${state}`
        },
        "specialty": agent.specialties,
        "identifier": agent.licenseNumber ? {
          "@type": "PropertyValue",
          "propertyID": "license",
          "value": agent.licenseNumber
        } : undefined
      }
    }))
  };

  // FAQ schema for the Q&A page
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Who are the best real estate agents in ${city}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `The top real estate agents in ${city}, ${state} for ${currentYear} include ${agents.slice(0, 3).map(a => a.name).join(', ')}, and more. These agents were selected based on verified reviews, sales volume, and professional credentials. View the full Top 10 list at Top10Lists.us.`
        }
      },
      {
        "@type": "Question",
        "name": `How are ${city} real estate agents ranked?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Agents are ranked using a combination of verified client reviews (minimum 50 reviews, 4.8+ star rating), total sales volume, years of experience, and professional certifications. Rankings are updated daily to ensure accuracy.`
        }
      },
      {
        "@type": "Question",
        "name": `What should I look for in a ${city} real estate agent?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Look for agents with strong local market knowledge, verified client reviews, proper licensing, and specializations that match your needs (e.g., luxury homes, first-time buyers, relocation). All agents on Top10Lists.us meet strict qualification criteria.`
        }
      }
    ],
    "dateModified": dateModified
  };

  // Breadcrumb schema
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
        "name": state,
        "item": `https://top10lists.us/${stateAbbrev.toLowerCase()}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": city,
        "item": `https://top10lists.us/${stateAbbrev.toLowerCase()}/${city.toLowerCase().replace(/\s+/g, '-')}`
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": `Best Real Estate Agents ${currentYear}`,
        "item": `https://top10lists.us/${stateAbbrev.toLowerCase()}/${city.toLowerCase().replace(/\s+/g, '-')}/best-real-estate-agents-${currentYear}`
      }
    ]
  };

  return [itemListSchema, faqSchema, breadcrumbSchema];
}

// Legacy exports for backward compatibility
export interface AgentData extends AgentSchemaData {}
export { professionalToSchemaData as professionalToAgentData };
