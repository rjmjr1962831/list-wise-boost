/**
 * Universal State Slug Mapping
 * Maps between state abbreviations and full state name slugs for all 50 US states + DC
 * Used for URL normalization, 301 redirects, and backward compatibility
 */

// Full mapping of state abbreviations to full name slugs
export const STATE_ABBR_TO_FULL: Record<string, string> = {
  'al': 'alabama',
  'ak': 'alaska',
  'az': 'arizona',
  'ar': 'arkansas',
  'ca': 'california',
  'co': 'colorado',
  'ct': 'connecticut',
  'de': 'delaware',
  'dc': 'district-of-columbia',
  'fl': 'florida',
  'ga': 'georgia',
  'hi': 'hawaii',
  'id': 'idaho',
  'il': 'illinois',
  'in': 'indiana',
  'ia': 'iowa',
  'ks': 'kansas',
  'ky': 'kentucky',
  'la': 'louisiana',
  'me': 'maine',
  'md': 'maryland',
  'ma': 'massachusetts',
  'mi': 'michigan',
  'mn': 'minnesota',
  'ms': 'mississippi',
  'mo': 'missouri',
  'mt': 'montana',
  'ne': 'nebraska',
  'nv': 'nevada',
  'nh': 'new-hampshire',
  'nj': 'new-jersey',
  'nm': 'new-mexico',
  'ny': 'new-york',
  'nc': 'north-carolina',
  'nd': 'north-dakota',
  'oh': 'ohio',
  'ok': 'oklahoma',
  'or': 'oregon',
  'pa': 'pennsylvania',
  'ri': 'rhode-island',
  'sc': 'south-carolina',
  'sd': 'south-dakota',
  'tn': 'tennessee',
  'tx': 'texas',
  'ut': 'utah',
  'vt': 'vermont',
  'va': 'virginia',
  'wa': 'washington',
  'wv': 'west-virginia',
  'wi': 'wisconsin',
  'wy': 'wyoming'
};

// Reverse mapping: full name slug to abbreviation
export const STATE_FULL_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBR_TO_FULL).map(([abbr, full]) => [full, abbr])
);

// Set of all valid full state slugs for quick lookup
export const VALID_STATE_SLUGS = new Set(Object.values(STATE_ABBR_TO_FULL));

// Set of all state abbreviations for quick lookup
export const STATE_ABBREVIATIONS = new Set(Object.keys(STATE_ABBR_TO_FULL));

/**
 * Normalizes a state slug to the canonical full name format
 * Returns whether a redirect is needed (if input was an abbreviation)
 */
export function normalizeStateSlug(slug: string): { 
  normalized: string; 
  needsRedirect: boolean;
  isValid: boolean;
} {
  const lower = slug.toLowerCase();
  
  // Check if it's an abbreviation that needs conversion
  if (STATE_ABBR_TO_FULL[lower]) {
    return { 
      normalized: STATE_ABBR_TO_FULL[lower], 
      needsRedirect: true,
      isValid: true
    };
  }
  
  // Check if it's already a valid full state slug
  if (VALID_STATE_SLUGS.has(lower)) {
    return { 
      normalized: lower, 
      needsRedirect: false,
      isValid: true
    };
  }
  
  // Unknown state slug - return as-is but mark as potentially invalid
  return { 
    normalized: lower, 
    needsRedirect: false,
    isValid: false
  };
}

/**
 * Converts a full state name to its URL slug format
 * e.g., "New Mexico" -> "new-mexico"
 */
export function stateNameToSlug(stateName: string): string {
  return stateName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Gets the state abbreviation from a full state slug
 * e.g., "new-mexico" -> "nm"
 */
export function getStateAbbreviation(stateSlug: string): string | null {
  return STATE_FULL_TO_ABBR[stateSlug.toLowerCase()] || null;
}

/**
 * Checks if a slug matches a state (either abbreviation or full name)
 */
export function matchesState(slug: string, stateSlug: string): boolean {
  const normalizedSlug = slug.toLowerCase();
  const normalizedState = stateSlug.toLowerCase();
  
  // Direct match
  if (normalizedSlug === normalizedState) return true;
  
  // Abbreviation matches full name
  if (STATE_ABBR_TO_FULL[normalizedSlug] === normalizedState) return true;
  
  // Full name matches abbreviation
  if (STATE_FULL_TO_ABBR[normalizedSlug] === normalizedState) return true;
  
  return false;
}
