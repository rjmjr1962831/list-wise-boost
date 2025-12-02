// src/utils/agentSchema.ts
// Agent Profile Schema Generator for LLM Optimization

export interface AgentData {
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
  realtorUrl?: string;
  dateModified: string; // ISO 8601 format
}

export function generateAgentProfileSchema(agent: AgentData): object {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": agent.name,
    "url": `https://top10lists.us/profile/${agent.slug}`,
    "image": agent.image,
    "description": agent.description,
    "telephone": agent.phone || undefined,
    "email": agent.email || undefined,
    
    "worksFor": {
      "@type": "RealEstateOrganization",
      "name": agent.brokerage
    },
    
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": agent.ratingValue.toString(),
      "bestRating": "5",
      "worstRating": "1",
      "reviewCount": agent.reviewCount.toString()
    },
    
    "areaServed": {
      "@type": "City",
      "name": agent.city,
      "containedInPlace": {
        "@type": "State",
        "name": agent.state,
        "alternateName": agent.stateAbbrev
      }
    },
    
    "knowsAbout": agent.specialties,
    
    "hasCredential": {
      "@type": "EducationalOccupationalCredential",
      "credentialCategory": "Real Estate License",
      "recognizedBy": {
        "@type": "GovernmentOrganization",
        "name": `${agent.state} Department of Real Estate`
      },
      "identifier": agent.licenseNumber
    },
    
    "memberOf": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://top10lists.us"
    },
    
    // Custom properties for LLM context
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "Years of Experience",
        "value": agent.yearsExperience
      },
      {
        "@type": "PropertyValue",
        "name": "Total Sales",
        "value": agent.totalSales
      },
      {
        "@type": "PropertyValue",
        "name": "License Number",
        "value": agent.licenseNumber
      }
    ],
    
    // Freshness signal - critical for LLM prioritization
    "dateModified": agent.dateModified,
    
    // External verification links
    "sameAs": [
      agent.zillowUrl,
      agent.realtorUrl,
      agent.website
    ].filter(Boolean)
  };
}

// Helper to convert Professional type to AgentData
import { Professional } from '@/types/professional';

export function professionalToAgentData(
  professional: Professional,
  city: string,
  state: string,
  stateAbbrev: string
): AgentData {
  const yearsExp = professional.years_experience || professional.stats?.yearsExperience || 0;
  const totalSales = professional.total_sales || professional.stats?.totalSales || 0;
  // Cast to any to access extended fields that may exist on DB records
  const extendedProf = professional as any;
  
  return {
    name: professional.name,
    slug: professional.id || '',
    image: professional.image || '/placeholder.svg',
    brokerage: professional.company || 'Independent Agent',
    description: professional.description || professional.synthesized_bio || `Top-rated real estate agent in ${city}, ${stateAbbrev}`,
    ratingValue: professional.rating || 0,
    reviewCount: professional.reviews || 0,
    city,
    state,
    stateAbbrev,
    licenseNumber: professional.license_number || '',
    yearsExperience: typeof yearsExp === 'number' ? yearsExp : parseInt(yearsExp as string) || 0,
    totalSales: typeof totalSales === 'number' ? totalSales : parseInt(totalSales as string) || 0,
    specialties: professional.specialties || [],
    phone: professional.phone,
    email: professional.email,
    website: professional.website,
    zillowUrl: extendedProf.zillow_profile_url,
    dateModified: new Date().toISOString()
  };
}
