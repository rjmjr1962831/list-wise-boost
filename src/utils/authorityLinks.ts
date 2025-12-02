import { getLicenseLookupByStateAbbr } from '@/data/stateLicenseLookups';
import { Professional } from '@/types/professional';

export interface AuthorityLink {
  type: 'license' | 'zillow' | 'website' | 'brokerage';
  label: string;
  url: string;
  icon: 'shield' | 'star' | 'globe' | 'building';
}

/**
 * Get the license verification URL for a given state
 */
export function getLicenseVerificationUrl(stateAbbr: string, licenseNumber?: string): string | null {
  const baseUrl = getLicenseLookupByStateAbbr(stateAbbr);
  if (!baseUrl) return null;
  
  // Most state sites don't support direct license number lookup via URL params
  // Return base verification site URL
  return baseUrl;
}

/**
 * Build a Zillow profile search URL
 */
export function getZillowProfileUrl(agentName: string, city: string, state: string): string {
  const searchQuery = encodeURIComponent(`${agentName} ${city} ${state} real estate agent`);
  return `https://www.zillow.com/professionals/real-estate-agent-reviews/?q=${searchQuery}`;
}

/**
 * Normalize website URL to ensure it has protocol
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

/**
 * Get all authority/verification links for a professional
 */
export function getAgentAuthorityLinks(
  professional: Professional,
  location: { city: string; state: string; stateAbbr: string }
): AuthorityLink[] {
  const links: AuthorityLink[] = [];

  // License verification link
  if (professional.license_number) {
    const licenseUrl = getLicenseVerificationUrl(location.stateAbbr, professional.license_number);
    if (licenseUrl) {
      links.push({
        type: 'license',
        label: `Verify ${location.stateAbbr} License`,
        url: licenseUrl,
        icon: 'shield'
      });
    }
  }

  // Zillow profile link (constructed search URL)
  const zillowUrl = getZillowProfileUrl(professional.name, location.city, location.state);
  links.push({
    type: 'zillow',
    label: 'View on Zillow',
    url: zillowUrl,
    icon: 'star'
  });

  // Agent website
  if (professional.website) {
    links.push({
      type: 'website',
      label: 'Agent Website',
      url: normalizeUrl(professional.website),
      icon: 'globe'
    });
  }

  // Brokerage (if we have company name, create a search link)
  if (professional.company) {
    const brokerageSearch = encodeURIComponent(`${professional.company} ${location.city} ${location.state}`);
    links.push({
      type: 'brokerage',
      label: professional.company,
      url: `https://www.google.com/search?q=${brokerageSearch}`,
      icon: 'building'
    });
  }

  return links;
}

/**
 * Check if an agent has verifiable credentials
 */
export function hasVerifiableCredentials(professional: Professional): boolean {
  return !!(
    professional.license_number ||
    professional.license_verified_at ||
    professional.website
  );
}
