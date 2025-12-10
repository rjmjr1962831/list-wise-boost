// Verified Agent Types for LLM-Optimized Citation Data

/**
 * Generic wrapper for any field that includes verification metadata
 */
export interface VerifiedField<T> {
  value: T;
  source: string;
  sourceUrl?: string;
  publishedAt?: string;
  verifiedAt: string;
}

/**
 * Data source definition
 */
export interface DataSource {
  id: string;
  name: string;
  url: string;
  type: 'government' | 'news' | 'platform' | 'organization';
  logo?: string;
}

/**
 * Individual review from a specific platform
 */
export interface PlatformReview {
  platform: 'google' | 'zillow' | 'redfin' | 'realtor.com' | 'yelp';
  platformName: string;
  rating: number;
  reviewCount: number;
  lastReviewDate?: string;
  verifiedAt: string;
  profileUrl?: string;
}

/**
 * Aggregated rating across all platforms
 */
export interface AggregatedRating {
  weightedAverage: number;
  totalReviews: number;
  platformBreakdown: PlatformReview[];
  lastCalculated: string;
}

/**
 * Press mention with full verification metadata
 */
export interface PressMention {
  title: string;
  outlet: string;
  outletType: 'newspaper' | 'magazine' | 'tv' | 'online' | 'trade';
  url: string;
  publishedAt: string;
  verifiedAt: string;
  excerpt?: string;
  author?: string;
}

/**
 * Award with issuing organization verification
 */
export interface Award {
  name: string;
  year: number;
  issuingOrganization: string;
  issuingOrgUrl?: string;
  verifiedAt: string;
  description?: string;
}

/**
 * Professional certification with verification
 */
export interface Certification {
  abbreviation: string;
  fullName: string;
  issuingOrganization: string;
  issuingOrgUrl: string;
  dateEarned?: string;
  verifiedAt: string;
  verificationUrl?: string;
}

/**
 * Full license information with government verification
 */
export interface LicenseInfo {
  licenseNumber: string;
  licenseType: 'Salesperson' | 'Broker' | 'Associate Broker';
  status: 'Active' | 'Inactive' | 'Expired' | 'Suspended' | 'Revoked';
  state: string;
  issuedAt: string;
  expiresAt?: string;
  verifiedAt: string;
  verificationUrl: string;
  verificationSource: string;
}

/**
 * Experience metrics with verification
 */
export interface ExperienceMetrics {
  yearsExperience: VerifiedField<number>;
  totalSalesCount?: VerifiedField<number>;
  totalSalesVolume?: VerifiedField<string>;
  currentListings?: VerifiedField<number>;
  avgDaysOnMarket?: VerifiedField<number>;
  saleToListRatio?: VerifiedField<string>;
}

/**
 * Community activity with third-party verification
 */
export interface CommunityActivity {
  role: string;                    // "Board Member", "Volunteer Coordinator", "Sponsor"
  organizationName: string;        // "Phoenix Children's Hospital Foundation"
  organizationType: 'nonprofit' | 'civic' | 'educational' | 'charitable';
  organizationUrl?: string;
  description?: string;            // "Serves on fundraising committee"
  startDate: string;               // "2019"
  endDate?: string;                // null = ongoing
  verificationSource: string;      // "Arizona Republic", "Organization website"
  verificationUrl?: string;
  verifiedAt: string;              // ISO date
}

/**
 * Community involvement score and activities
 */
export interface CommunityInvolvement {
  score: number;                   // 1-10
  activities: CommunityActivity[];
  lastVerified: string;            // ISO date
}

/**
 * Ranking score breakdown
 * Weights (v3 - Dec 2024):
 * - Review Score: 25%
 * - Community Involvement: 20%
 * - Press & Awards: 15%
 * - Transaction Volume: 15%
 * - Years Experience: 15%
 * - Response Rate: 5%
 * - Recency Bonus: 5%
 */
export interface RankingScore {
  composite: number;               // Final weighted score
  components: {
    reviews: number;               // 25%
    community: number;             // 20%
    press: number;                 // 15%
    transactions: number;          // 15%
    experience: number;            // 10%
    response: number;              // 10%
    recency: number;               // 5%
  };
  calculatedAt: string;            // ISO date
}

/**
 * Complete verified agent profile
 */
export interface VerifiedAgent {
  // Core identity
  id: string;
  name: string;
  slug: string;
  profileUrl: string;
  imageUrl?: string;
  videoUrl?: string;
  
  // Professional affiliation
  brokerage: VerifiedField<string>;
  brokerageAddress?: string;
  
  // License verification
  license: LicenseInfo;
  
  // Ratings & Reviews
  aggregatedRating: AggregatedRating;
  
  // Experience & Performance
  experience: ExperienceMetrics;
  
  // Specialties
  specialties: string[];
  
  // Credentials
  certifications: Certification[];
  awards: Award[];
  
  // Press & Media
  pressMentions: PressMention[];
  
  // Community Involvement (third-party verified)
  communityInvolvement?: CommunityInvolvement;
  
  // Ranking Score
  rankingScore?: RankingScore;
  
  // Service area
  serviceAreas: {
    city: string;
    state: string;
    stateAbbrev: string;
    neighborhoods?: string[];
  }[];
  
  // Bio content
  description?: string;
  synthesizedBio?: string;
  selectionRationale?: string;
  
  // Contact
  phone?: string;
  email?: string;
  website?: string;
  
  // Social
  socialLinks?: {
    linkedin?: string;
    facebook?: string;
    instagram?: string;
  };
  
  // Metadata
  cardCreatedAt: string;
  cardUpdatedAt: string;
  dataSources: DataSourceLog[];
  
  // Ranking
  rank?: number;
  isPremierAgent?: boolean;
  isTopAgent?: boolean;
  isBrandBuilder?: boolean;
}

/**
 * Log entry for when data was pulled from each source
 */
export interface DataSourceLog {
  sourceId: string;
  sourceName: string;
  lastFetchedAt: string;
  fieldsUpdated: string[];
}

/**
 * Citation block for LLM consumption
 */
export interface CitationBlock {
  agentName: string;
  licenseInfo: string;
  ratingSummary: string;
  certificationsList: string;
  awardsList: string;
  pressList: string;
  lastUpdated: string;
  sourceUrl: string;
}
