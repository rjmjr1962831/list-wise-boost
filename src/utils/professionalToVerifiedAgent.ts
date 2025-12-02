import { VerifiedAgent, LicenseInfo, AggregatedRating, PlatformReview, Certification, Award, PressMention, DataSourceLog, VerifiedField } from '@/types/verifiedAgent';
import { getCertificationInfo, DATA_SOURCES } from '@/config/dataSources';

/**
 * Transform a Professional database record to VerifiedAgent format
 * Maps existing fields and structures data for LLM-optimized display
 */
export function professionalToVerifiedAgent(
  professional: any,
  cityName: string,
  state: string,
  stateAbbrev: string
): VerifiedAgent {
  const now = new Date().toISOString();
  
  // Build license info
  const license: LicenseInfo = {
    licenseNumber: professional.license_number || 'N/A',
    licenseType: professional.license_type || 'Salesperson',
    status: professional.license_status || 'Active',
    state: stateAbbrev,
    issuedAt: professional.license_issued_at || professional.license_verified_at || now,
    expiresAt: professional.license_expires_at,
    verifiedAt: professional.license_verified_at || now,
    verificationUrl: DATA_SOURCES.AZDRE.url,
    verificationSource: DATA_SOURCES.AZDRE.name,
  };

  // Build platform reviews from existing data
  const platformBreakdown: PlatformReview[] = [];
  
  // Zillow reviews (primary source)
  if (professional.review_stars_rating && professional.num_total_reviews) {
    platformBreakdown.push({
      platform: 'zillow',
      platformName: 'Zillow',
      rating: Number(professional.review_stars_rating) || 0,
      reviewCount: professional.num_total_reviews || 0,
      lastReviewDate: professional.most_recent_review_date,
      verifiedAt: professional.zillow_data_fetched_at || now,
      profileUrl: professional.zillow_profile_url,
    });
  }

  // Check for platform_reviews JSONB (new enhanced data)
  if (professional.platform_reviews && Array.isArray(professional.platform_reviews)) {
    professional.platform_reviews.forEach((pr: any) => {
      // Avoid duplicating Zillow if already added
      if (pr.platform !== 'zillow' || platformBreakdown.length === 0) {
        platformBreakdown.push({
          platform: pr.platform,
          platformName: pr.platformName || pr.platform,
          rating: pr.rating,
          reviewCount: pr.reviewCount,
          lastReviewDate: pr.lastReviewDate,
          verifiedAt: pr.verifiedAt || now,
          profileUrl: pr.profileUrl,
        });
      }
    });
  }

  // Calculate aggregated rating
  const totalReviews = platformBreakdown.reduce((sum, p) => sum + p.reviewCount, 0);
  const weightedSum = platformBreakdown.reduce((sum, p) => sum + (p.rating * p.reviewCount), 0);
  const weightedAverage = totalReviews > 0 ? weightedSum / totalReviews : 0;

  const aggregatedRating: AggregatedRating = {
    weightedAverage,
    totalReviews,
    platformBreakdown,
    lastCalculated: now,
  };

  // Build certifications from certifications_verified or certifications JSONB
  const certifications: Certification[] = [];
  const certSource = professional.certifications_verified || professional.certifications || [];
  
  if (Array.isArray(certSource)) {
    certSource.forEach((cert: any) => {
      if (typeof cert === 'string') {
        // Simple string abbreviation - look up info
        const info = getCertificationInfo(cert);
        if (info) {
          certifications.push({
            abbreviation: cert,
            fullName: info.fullName,
            issuingOrganization: info.issuingOrganization,
            issuingOrgUrl: info.issuingOrgUrl,
            verifiedAt: now,
          });
        }
      } else if (cert.abbreviation) {
        // Full certification object
        certifications.push({
          abbreviation: cert.abbreviation,
          fullName: cert.fullName || cert.abbreviation,
          issuingOrganization: cert.issuingOrganization || 'Unknown',
          issuingOrgUrl: cert.issuingOrgUrl || '',
          dateEarned: cert.dateEarned,
          verifiedAt: cert.verifiedAt || now,
          verificationUrl: cert.verificationUrl,
        });
      }
    });
  }

  // Build awards from awards_verified or notable_achievements
  const awards: Award[] = [];
  const awardsSource = professional.awards_verified || professional.notable_achievements || [];
  
  if (Array.isArray(awardsSource)) {
    awardsSource.forEach((award: any) => {
      if (award.title || award.name) {
        awards.push({
          name: award.title || award.name,
          year: award.year || new Date().getFullYear(),
          issuingOrganization: award.organization || award.issuingOrganization || award.source || 'Unknown',
          issuingOrgUrl: award.url || award.issuingOrgUrl,
          verifiedAt: award.verifiedAt || now,
          description: award.description,
        });
      }
    });
  }

  // Build press mentions
  const pressMentions: PressMention[] = [];
  const pressSource = professional.press_mentions || [];
  
  if (Array.isArray(pressSource)) {
    pressSource.forEach((mention: any) => {
      if (mention.title && mention.url) {
        pressMentions.push({
          title: mention.title,
          outlet: mention.source || mention.outlet || 'Unknown',
          outletType: mapOutletType(mention.source || mention.outlet),
          url: mention.url,
          publishedAt: mention.date || mention.publishedAt || now,
          verifiedAt: mention.verifiedAt || now,
          excerpt: mention.excerpt || mention.description,
          author: mention.author,
        });
      }
    });
  }

  // Build data sources log
  const dataSources: DataSourceLog[] = professional.data_sources_log || [];
  
  // Add default sources based on what data we have
  if (dataSources.length === 0) {
    if (professional.zillow_data_fetched_at) {
      dataSources.push({
        sourceId: 'zillow',
        sourceName: 'Zillow',
        lastFetchedAt: professional.zillow_data_fetched_at,
        fieldsUpdated: ['reviews', 'rating', 'sales_stats'],
      });
    }
    if (professional.license_verified_at) {
      dataSources.push({
        sourceId: 'azdre',
        sourceName: 'Arizona DRE',
        lastFetchedAt: professional.license_verified_at,
        fieldsUpdated: ['license_number', 'license_status'],
      });
    }
  }

  // Build experience metrics
  const experience = {
    yearsExperience: createVerifiedField(
      professional.years_experience,
      'Zillow',
      professional.zillow_data_fetched_at
    ),
    totalSalesCount: createVerifiedField(
      professional.total_sales,
      'Zillow',
      professional.zillow_data_fetched_at
    ),
    currentListings: createVerifiedField(
      professional.current_listings,
      'Zillow',
      professional.zillow_data_fetched_at
    ),
  };

  // Build specialties
  const specialties = professional.specialty || [];

  // Construct the full VerifiedAgent
  const verifiedAgent: VerifiedAgent = {
    id: professional.id,
    name: professional.name,
    slug: createSlug(professional.name),
    profileUrl: `https://top10lists.us/profile/${professional.id}`,
    imageUrl: professional.image_url,
    videoUrl: professional.sidebar_video_url,
    
    brokerage: createVerifiedField(
      professional.company || professional.business_name,
      'Zillow',
      professional.zillow_data_fetched_at
    ),
    brokerageAddress: professional.address,
    
    license,
    aggregatedRating,
    experience,
    specialties,
    certifications,
    awards,
    pressMentions,
    
    serviceAreas: [{
      city: cityName,
      state,
      stateAbbrev,
      neighborhoods: professional.service_areas || [],
    }],
    
    description: professional.description,
    synthesizedBio: professional.synthesized_bio,
    selectionRationale: professional.selection_rationale,
    
    phone: professional.phone,
    email: professional.email,
    website: professional.website,
    
    socialLinks: {
      linkedin: professional.social_linkedin,
      facebook: professional.social_facebook,
      instagram: professional.social_instagram,
    },
    
    cardCreatedAt: professional.card_created_at || professional.created_at,
    cardUpdatedAt: professional.updated_at,
    dataSources,
    
    rank: professional.rank,
    isPremierAgent: professional.is_premier_agent,
    isTopAgent: professional.is_top_agent,
    isBrandBuilder: professional.is_brand_builder,
  };

  return verifiedAgent;
}

/**
 * Helper to create a VerifiedField wrapper
 */
function createVerifiedField<T>(value: T, source: string, verifiedAt?: string): VerifiedField<T> {
  return {
    value,
    source,
    verifiedAt: verifiedAt || new Date().toISOString(),
  };
}

/**
 * Create URL-safe slug from name
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Map outlet name to outlet type
 */
function mapOutletType(outlet: string): 'newspaper' | 'magazine' | 'tv' | 'online' | 'trade' {
  const lower = outlet?.toLowerCase() || '';
  
  if (lower.includes('journal') || lower.includes('times') || lower.includes('post') || lower.includes('republic')) {
    return 'newspaper';
  }
  if (lower.includes('magazine') || lower.includes('weekly')) {
    return 'magazine';
  }
  if (lower.includes('tv') || lower.includes('news') || lower.includes('abc') || lower.includes('nbc') || lower.includes('cbs') || lower.includes('fox')) {
    return 'tv';
  }
  if (lower.includes('realtor') || lower.includes('real estate') || lower.includes('agent')) {
    return 'trade';
  }
  
  return 'online';
}
