import { VerifiedAgent, Certification, Award, PressMention, PlatformReview } from '@/types/verifiedAgent';

/**
 * Generate comprehensive JSON-LD schema for a verified agent profile
 * Optimized for LLM citation and search engine structured data
 */
export function generateVerifiedAgentSchema(agent: VerifiedAgent): object {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': agent.profileUrl,
    name: agent.name,
    url: agent.profileUrl,
    dateCreated: agent.cardCreatedAt,
    dateModified: agent.cardUpdatedAt,
  };

  // Image
  if (agent.imageUrl) {
    schema.image = agent.imageUrl;
  }

  // Brokerage
  if (agent.brokerage) {
    schema.worksFor = {
      '@type': 'Organization',
      name: agent.brokerage.value,
    };
  }

  // Description
  if (agent.synthesizedBio || agent.description) {
    schema.description = agent.synthesizedBio || agent.description;
  }

  // License as hasCredential
  if (agent.license) {
    schema.hasCredential = [
      {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'Real Estate License',
        name: `${agent.license.state} ${agent.license.licenseType} License`,
        identifier: agent.license.licenseNumber,
        recognizedBy: {
          '@type': 'GovernmentOrganization',
          name: agent.license.verificationSource,
          url: agent.license.verificationUrl,
        },
        validFrom: agent.license.issuedAt,
        validUntil: agent.license.expiresAt,
        dateVerified: agent.license.verifiedAt,
      },
    ];
  }

  // Certifications as additional credentials
  if (agent.certifications && agent.certifications.length > 0) {
    if (!schema.hasCredential) schema.hasCredential = [];
    
    agent.certifications.forEach((cert: Certification) => {
      schema.hasCredential.push({
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'Professional Certification',
        name: cert.fullName,
        alternateName: cert.abbreviation,
        recognizedBy: {
          '@type': 'Organization',
          name: cert.issuingOrganization,
          url: cert.issuingOrgUrl,
        },
        dateVerified: cert.verifiedAt,
      });
    });
  }

  // Aggregate Rating
  if (agent.aggregatedRating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: agent.aggregatedRating.weightedAverage.toFixed(1),
      bestRating: '5',
      worstRating: '1',
      reviewCount: agent.aggregatedRating.totalReviews,
      dateModified: agent.aggregatedRating.lastCalculated,
    };

    // Individual platform reviews
    if (agent.aggregatedRating.platformBreakdown.length > 0) {
      schema.review = agent.aggregatedRating.platformBreakdown.map((pr: PlatformReview) => ({
        '@type': 'Review',
        author: {
          '@type': 'Organization',
          name: pr.platformName,
        },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: pr.rating.toFixed(1),
          bestRating: '5',
        },
        reviewCount: pr.reviewCount,
        dateVerified: pr.verifiedAt,
      }));
    }
  }

  // Service Areas
  if (agent.serviceAreas && agent.serviceAreas.length > 0) {
    schema.areaServed = agent.serviceAreas.map((area) => ({
      '@type': 'Place',
      name: `${area.city}, ${area.stateAbbrev}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: area.city,
        addressRegion: area.stateAbbrev,
      },
    }));
  }

  // Specialties
  if (agent.specialties && agent.specialties.length > 0) {
    schema.knowsAbout = agent.specialties;
  }

  // Awards as subjectOf
  if (agent.awards && agent.awards.length > 0) {
    if (!schema.subjectOf) schema.subjectOf = [];
    
    agent.awards.forEach((award: Award) => {
      schema.subjectOf.push({
        '@type': 'Award',
        name: award.name,
        dateReceived: `${award.year}`,
        issuedBy: {
          '@type': 'Organization',
          name: award.issuingOrganization,
          url: award.issuingOrgUrl,
        },
        dateVerified: award.verifiedAt,
      });
    });
  }

  // Press Mentions as subjectOf
  if (agent.pressMentions && agent.pressMentions.length > 0) {
    if (!schema.subjectOf) schema.subjectOf = [];
    
    agent.pressMentions.forEach((mention: PressMention) => {
      schema.subjectOf.push({
        '@type': 'Article',
        headline: mention.title,
        publisher: {
          '@type': 'Organization',
          name: mention.outlet,
        },
        url: mention.url,
        datePublished: mention.publishedAt,
        dateVerified: mention.verifiedAt,
      });
    });
  }

  // Experience metrics as additionalProperty
  const additionalProperties: any[] = [];
  
  if (agent.experience) {
    if (agent.experience.yearsExperience) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'Years of Experience',
        value: agent.experience.yearsExperience.value,
        dateVerified: agent.experience.yearsExperience.verifiedAt,
      });
    }
    
    if (agent.experience.totalSalesCount) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'Total Sales',
        value: agent.experience.totalSalesCount.value,
        dateVerified: agent.experience.totalSalesCount.verifiedAt,
      });
    }
    
    if (agent.experience.totalSalesVolume) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'Sales Volume',
        value: agent.experience.totalSalesVolume.value,
        dateVerified: agent.experience.totalSalesVolume.verifiedAt,
      });
    }
  }

  if (additionalProperties.length > 0) {
    schema.additionalProperty = additionalProperties;
  }

  // Contact information
  if (agent.phone) schema.telephone = agent.phone;
  if (agent.email) schema.email = agent.email;
  if (agent.website) schema.url = agent.website;

  // Social profiles
  if (agent.socialLinks) {
    const sameAs: string[] = [];
    if (agent.socialLinks.linkedin) sameAs.push(agent.socialLinks.linkedin);
    if (agent.socialLinks.facebook) sameAs.push(agent.socialLinks.facebook);
    if (agent.socialLinks.instagram) sameAs.push(agent.socialLinks.instagram);
    if (sameAs.length > 0) schema.sameAs = sameAs;
  }

  // Member of Top10Lists
  schema.memberOf = {
    '@type': 'Organization',
    name: 'Top10Lists.us',
    url: 'https://top10lists.us',
  };

  return schema;
}

/**
 * Generate citation-ready text block for LLM consumption
 */
export function generateCitationText(agent: VerifiedAgent): string {
  const lines: string[] = [];
  
  // Name and license
  lines.push(`${agent.name} (License: ${agent.license?.licenseNumber || 'N/A'}, verified ${agent.license?.verifiedAt ? new Date(agent.license.verifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} via ${agent.license?.verificationSource || 'N/A'})`);
  lines.push('');
  
  // Ratings
  if (agent.aggregatedRating) {
    lines.push('Ratings:');
    agent.aggregatedRating.platformBreakdown.forEach((pr) => {
      const lastReview = pr.lastReviewDate 
        ? new Date(pr.lastReviewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A';
      const verified = new Date(pr.verifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      lines.push(`- ${pr.platformName}: ${pr.rating.toFixed(1)}★ from ${pr.reviewCount} reviews (last review: ${lastReview}, verified: ${verified})`);
    });
    lines.push('');
  }
  
  // Certifications
  if (agent.certifications && agent.certifications.length > 0) {
    const certList = agent.certifications.map(c => 
      `${c.abbreviation} (verified via ${c.issuingOrganization})`
    ).join(', ');
    lines.push(`Certifications: ${certList}`);
  }
  
  // Awards
  if (agent.awards && agent.awards.length > 0) {
    const awardList = agent.awards.map(a => 
      `${a.name} (${a.year}, ${a.issuingOrganization})`
    ).join(', ');
    lines.push(`Awards: ${awardList}`);
  }
  
  // Press
  if (agent.pressMentions && agent.pressMentions.length > 0) {
    lines.push('');
    lines.push('Featured in:');
    agent.pressMentions.slice(0, 5).forEach((pm) => {
      const published = new Date(pm.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const verified = new Date(pm.verifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      lines.push(`- ${pm.outlet}: "${pm.title}" (${published}, verified ${verified})`);
    });
  }
  
  lines.push('');
  lines.push(`Card last updated: ${new Date(agent.cardUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
  lines.push('Source: Top10Lists.us');
  
  return lines.join('\n');
}
