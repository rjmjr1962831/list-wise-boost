import { DataSource } from '@/types/verifiedAgent';

/**
 * All data sources used for agent verification
 */
export const DATA_SOURCES: Record<string, DataSource> = {
  // Government Sources
  AZDRE: {
    id: 'azdre',
    name: 'Arizona Department of Real Estate',
    url: 'https://services.azre.gov/publicdatabase/searchlicensee.aspx',
    type: 'government',
    logo: '/images/sources/azdre.png'
  },
  
  // Review Platforms
  GOOGLE: {
    id: 'google',
    name: 'Google Business Profile',
    url: 'https://www.google.com/maps',
    type: 'platform',
    logo: '/images/sources/google.png'
  },
  ZILLOW: {
    id: 'zillow',
    name: 'Zillow',
    url: 'https://www.zillow.com',
    type: 'platform',
    logo: '/images/sources/zillow.png'
  },
  REDFIN: {
    id: 'redfin',
    name: 'Redfin',
    url: 'https://www.redfin.com',
    type: 'platform',
    logo: '/images/sources/redfin.png'
  },
  REALTOR_COM: {
    id: 'realtor.com',
    name: 'Realtor.com',
    url: 'https://www.realtor.com',
    type: 'platform',
    logo: '/images/sources/realtor-com.png'
  },
  YELP: {
    id: 'yelp',
    name: 'Yelp',
    url: 'https://www.yelp.com',
    type: 'platform',
    logo: '/images/sources/yelp.png'
  },
  
  // Professional Organizations
  CRS: {
    id: 'crs',
    name: 'Residential Real Estate Council',
    url: 'https://crs.com',
    type: 'organization',
    logo: '/images/sources/crs.png'
  },
  NAR: {
    id: 'nar',
    name: 'National Association of Realtors',
    url: 'https://www.nar.realtor',
    type: 'organization',
    logo: '/images/sources/nar.png'
  },
  REBAC: {
    id: 'rebac',
    name: 'Real Estate Buyer\'s Agent Council',
    url: 'https://www.nar.realtor/education/designations-and-certifications/abr',
    type: 'organization',
    logo: '/images/sources/rebac.png'
  },
  SRES: {
    id: 'sres',
    name: 'Seniors Real Estate Specialist Council',
    url: 'https://sres.realtor',
    type: 'organization',
    logo: '/images/sources/sres.png'
  },
  
  // News Sources
  PHOENIX_BIZ_JOURNAL: {
    id: 'pbj',
    name: 'Phoenix Business Journal',
    url: 'https://www.bizjournals.com/phoenix',
    type: 'news',
    logo: '/images/sources/pbj.png'
  },
  AZ_REPUBLIC: {
    id: 'azrepublic',
    name: 'Arizona Republic',
    url: 'https://www.azcentral.com',
    type: 'news',
    logo: '/images/sources/azrepublic.png'
  },
  FIVE_STAR: {
    id: 'fivestar',
    name: 'Five Star Professional',
    url: 'https://www.fivestarprofessional.com',
    type: 'organization',
    logo: '/images/sources/fivestar.png'
  },
  
  // National News Outlets (for agent press coverage credit)
  WSJ: {
    id: 'wsj',
    name: 'Wall Street Journal',
    url: 'https://wsj.com',
    type: 'news',
    logo: '/images/sources/wsj.png'
  },
  YAHOO_FINANCE: {
    id: 'yahoo',
    name: 'Yahoo! Finance',
    url: 'https://finance.yahoo.com',
    type: 'news',
    logo: '/images/sources/yahoo.png'
  },
  CNBC: {
    id: 'cnbc',
    name: 'CNBC',
    url: 'https://cnbc.com',
    type: 'news',
    logo: '/images/sources/cnbc.png'
  },
  NYT: {
    id: 'nyt',
    name: 'New York Times',
    url: 'https://nytimes.com',
    type: 'news',
    logo: '/images/sources/nyt.png'
  },
  FOX_NEWS: {
    id: 'fox',
    name: 'Fox News',
    url: 'https://foxnews.com',
    type: 'news',
    logo: '/images/sources/fox.png'
  },
  ABC_NEWS: {
    id: 'abc',
    name: 'ABC News',
    url: 'https://abcnews.go.com',
    type: 'news',
    logo: '/images/sources/abc.png'
  },
  CNN: {
    id: 'cnn',
    name: 'CNN',
    url: 'https://cnn.com',
    type: 'news',
    logo: '/images/sources/cnn.png'
  },
  NBC_TODAY: {
    id: 'today',
    name: 'NBC Today Show',
    url: 'https://today.com',
    type: 'news',
    logo: '/images/sources/today.png'
  },
  FORBES: {
    id: 'forbes',
    name: 'Forbes',
    url: 'https://forbes.com',
    type: 'news',
    logo: '/images/sources/forbes.png'
  },
  BLOOMBERG: {
    id: 'bloomberg',
    name: 'Bloomberg',
    url: 'https://bloomberg.com',
    type: 'news',
    logo: '/images/sources/bloomberg.png'
  },
  USA_TODAY: {
    id: 'usatoday',
    name: 'USA Today',
    url: 'https://usatoday.com',
    type: 'news',
    logo: '/images/sources/usatoday.png'
  }
};

/**
 * Get data source by ID
 */
export function getDataSource(id: string): DataSource | undefined {
  return Object.values(DATA_SOURCES).find(source => source.id === id);
}

/**
 * Get all sources of a specific type
 */
export function getSourcesByType(type: DataSource['type']): DataSource[] {
  return Object.values(DATA_SOURCES).filter(source => source.type === type);
}

/**
 * Format a date for verification display
 */
export function formatVerificationDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get relative time string (e.g., "2 days ago")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Generate verification badge text
 */
export function getVerificationText(source: DataSource, verifiedAt: string): string {
  return `Verified ${formatVerificationDate(verifiedAt)} via ${source.name}`;
}

/**
 * Common certifications lookup
 */
export const CERTIFICATION_INFO: Record<string, { fullName: string; issuingOrganization: string; issuingOrgUrl: string }> = {
  CRS: {
    fullName: 'Certified Residential Specialist',
    issuingOrganization: 'Residential Real Estate Council',
    issuingOrgUrl: 'https://crs.com'
  },
  ABR: {
    fullName: 'Accredited Buyer\'s Representative',
    issuingOrganization: 'Real Estate Buyer\'s Agent Council (REBAC)',
    issuingOrgUrl: 'https://www.nar.realtor/education/designations-and-certifications/abr'
  },
  SRES: {
    fullName: 'Seniors Real Estate Specialist',
    issuingOrganization: 'SRES Council',
    issuingOrgUrl: 'https://sres.realtor'
  },
  GRI: {
    fullName: 'Graduate, REALTOR Institute',
    issuingOrganization: 'National Association of Realtors',
    issuingOrgUrl: 'https://www.nar.realtor/education/designations-and-certifications/gri'
  },
  CDPE: {
    fullName: 'Certified Distressed Property Expert',
    issuingOrganization: 'CDPE Institute',
    issuingOrgUrl: 'https://cdpe.com'
  },
  CLHMS: {
    fullName: 'Certified Luxury Home Marketing Specialist',
    issuingOrganization: 'Institute for Luxury Home Marketing',
    issuingOrgUrl: 'https://www.luxuryhomemarketing.com'
  },
  SFR: {
    fullName: 'Short Sales and Foreclosure Resource',
    issuingOrganization: 'National Association of Realtors',
    issuingOrgUrl: 'https://www.nar.realtor/education/designations-and-certifications/sfr'
  },
  RSPS: {
    fullName: 'Resort and Second-Home Property Specialist',
    issuingOrganization: 'National Association of Realtors',
    issuingOrgUrl: 'https://www.nar.realtor/education/designations-and-certifications/rsps'
  },
  MRP: {
    fullName: 'Military Relocation Professional',
    issuingOrganization: 'National Association of Realtors',
    issuingOrgUrl: 'https://www.nar.realtor/education/designations-and-certifications/mrp'
  },
  CIPS: {
    fullName: 'Certified International Property Specialist',
    issuingOrganization: 'National Association of Realtors',
    issuingOrgUrl: 'https://www.nar.realtor/education/designations-and-certifications/cips'
  }
};

/**
 * Get certification info by abbreviation
 */
export function getCertificationInfo(abbreviation: string) {
  return CERTIFICATION_INFO[abbreviation.toUpperCase()];
}
