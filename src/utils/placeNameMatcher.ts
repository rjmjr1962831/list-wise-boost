// =============================================================================
// Place Name Matcher for Top10Lists.us
// =============================================================================
// 
// This module handles common variations in how places are named:
// - "Victory at Verrado" matches "Victory"
// - "San Buenaventura (Ventura)" matches "Ventura"
// - "East Los Angeles" matches "Los Angeles" and "East LA"
// - "Mount Shasta" matches "Mt. Shasta"
// - "Los Angeles" matches "LA"
//
// INTEGRATION OPTIONS:
//
// Option A: Add to Lovable as a utility file
//   1. Create file: src/utils/placeNameMatcher.ts
//   2. Paste this entire file
//   3. Import where needed: import { matchCityToDb, namesMatch } from '@/utils/placeNameMatcher'
//
// Option B: Add to existing Supabase Edge Function
//   1. Add these functions to your enrichment-api or create new edge function
//   2. Expose via new action: ?action=match-city
//
// =============================================================================

// Abbreviation mappings (full form -> abbreviated forms)
const ABBREV_MAP: Record<string, string[]> = {
  'los angeles': ['la'],
  'san francisco': ['sf'],
  'san diego': ['sd'],
  'san jose': ['sj'],
  'saint': ['st', 'st.'],
  'mount': ['mt', 'mt.'],
  'fort': ['ft', 'ft.'],
  'port': ['pt', 'pt.'],
  'heights': ['hts', 'hgts'],
  'beach': ['bch'],
  'springs': ['spgs', 'sprgs'],
  'valley': ['vly', 'vlly'],
  'village': ['vlg', 'vil'],
  'center': ['ctr', 'centre'],
  'centre': ['ctr', 'center'],
  'park': ['pk'],
  'point': ['pt', 'pointe'],
  'pointe': ['pt', 'point'],
  'ranch': ['rch', 'rancho'],
  'rancho': ['rch', 'ranch'],
  'lake': ['lk'],
  'lakes': ['lks'],
  'mountain': ['mtn', 'mt'],
  'creek': ['crk', 'ck'],
};

/**
 * Generate all reasonable variations of a place name for matching.
 * Returns a Set of lowercase variations.
 */
export function normalizePlaceName(name: string): Set<string> {
  if (!name) return new Set();
  
  const nameLower = name.toLowerCase().trim();
  const variations = new Set<string>([nameLower]);
  
  // 1. Handle parentheticals: "San Buenaventura (Ventura)" -> "Ventura", "San Buenaventura"
  const parenMatch = nameLower.match(/^(.+?)\s*\((.+?)\)$/);
  if (parenMatch) {
    variations.add(parenMatch[1].trim());
    variations.add(parenMatch[2].trim());
  }
  
  // 2. Handle "at" pattern: "Victory at Verrado" -> "Victory"
  const atMatch = nameLower.match(/^(.+?)\s+at\s+.+$/);
  if (atMatch && atMatch[1].length > 2) {
    variations.add(atMatch[1].trim());
  }
  
  // 3. Handle "of" pattern: "City of Industry" -> "Industry"
  const ofMatch = nameLower.match(/^(?:city|town|village|county)\s+of\s+(.+)$/);
  if (ofMatch) {
    variations.add(ofMatch[1].trim());
  }
  
  // 4. Handle directional prefixes: "East Los Angeles" -> "Los Angeles"
  const dirMatch = nameLower.match(/^(north|south|east|west|northeast|northwest|southeast|southwest|upper|lower|old|new)\s+(.+)$/);
  if (dirMatch && dirMatch[2].length > 2) {
    variations.add(dirMatch[2].trim());
  }
  
  // 5. Apply abbreviation mappings (bidirectional)
  const currentVariations = Array.from(variations);
  for (const variant of currentVariations) {
    for (const [full, abbrevs] of Object.entries(ABBREV_MAP)) {
      // Full -> abbreviated
      if (variant.includes(full)) {
        for (const abbr of abbrevs) {
          variations.add(variant.replace(full, abbr));
        }
      }
      // Abbreviated -> full (match whole words only)
      const words = variant.split(' ');
      for (let i = 0; i < words.length; i++) {
        for (const abbr of abbrevs) {
          if (words[i] === abbr || words[i] === abbr.replace('.', '')) {
            const newWords = [...words];
            newWords[i] = full;
            variations.add(newWords.join(' '));
          }
        }
      }
    }
  }
  
  // 6. Handle hyphens: "Rancho-Santa-Margarita" <-> "Rancho Santa Margarita"
  const hyphenVariations = Array.from(variations);
  for (const variant of hyphenVariations) {
    if (variant.includes('-')) {
      variations.add(variant.replace(/-/g, ' '));
    }
  }
  
  // 7. Handle "The" prefix: "The Sea Ranch" -> "Sea Ranch"
  const theVariations = Array.from(variations);
  for (const variant of theVariations) {
    const theMatch = variant.match(/^the\s+(.+)$/);
    if (theMatch) {
      variations.add(theMatch[1].trim());
    }
  }
  
  // 8. Handle CDP/city/town suffixes
  const suffixVariations = Array.from(variations);
  for (const variant of suffixVariations) {
    for (const suffix of [' cdp', ' city', ' town', ' village', ' township']) {
      if (variant.endsWith(suffix)) {
        variations.add(variant.slice(0, -suffix.length).trim());
      }
    }
  }
  
  // 9. Handle possessives: "King's Beach" <-> "Kings Beach"
  const possessiveVariations = Array.from(variations);
  for (const variant of possessiveVariations) {
    if (variant.includes("'s ")) {
      variations.add(variant.replace("'s ", "s "));
    }
  }
  
  // Clean up: remove empty strings and single characters
  return new Set(Array.from(variations).filter(v => v && v.length > 1));
}

/**
 * Check if two place names refer to the same location.
 */
export function namesMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  
  const vars1 = normalizePlaceName(name1);
  const vars2 = normalizePlaceName(name2);
  
  // Check for intersection
  for (const v of vars1) {
    if (vars2.has(v)) return true;
  }
  return false;
}

/**
 * Find all candidates that match the query name.
 */
export function findMatches(query: string, candidates: string[]): string[] {
  if (!query) return [];
  
  const queryVars = normalizePlaceName(query);
  const matches: string[] = [];
  
  for (const candidate of candidates) {
    if (!candidate) continue;
    const candVars = normalizePlaceName(candidate);
    
    for (const v of queryVars) {
      if (candVars.has(v)) {
        matches.push(candidate);
        break;
      }
    }
  }
  
  return matches;
}

/**
 * Create a URL-friendly slug from a place name.
 */
export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// =============================================================================
// Database Integration Types
// =============================================================================

export interface MatchResult {
  matched: boolean;
  query: string;
  dbName?: string;
  dbSlug?: string;
  dbId?: string;
  matchType: 'exact' | 'variation' | 'none';
  confidence: number;
}

export interface CityRecord {
  id: string;
  name: string;
  slug: string;
  state: string;
  active: boolean;
}

// =============================================================================
// Database Matching Functions
// =============================================================================

/**
 * Match a query string to a database city.
 * 
 * @param query - The city name to match
 * @param cities - Array of city records from database
 * @returns MatchResult with match details
 */
export function matchToDbCities(query: string, cities: CityRecord[]): MatchResult {
  if (!query || !query.trim()) {
    return { matched: false, query: query || '', matchType: 'none', confidence: 0 };
  }
  
  const queryClean = query.trim();
  const queryLower = queryClean.toLowerCase();
  
  // Build lookup
  const cityLookup = new Map<string, CityRecord>();
  const cityNames: string[] = [];
  
  for (const city of cities) {
    cityLookup.set(city.name.toLowerCase().trim(), city);
    cityNames.push(city.name);
  }
  
  // 1. Try exact match first
  if (cityLookup.has(queryLower)) {
    const city = cityLookup.get(queryLower)!;
    return {
      matched: true,
      query: queryClean,
      dbName: city.name,
      dbSlug: city.slug,
      dbId: city.id,
      matchType: 'exact',
      confidence: 1.0
    };
  }
  
  // 2. Try variation matching
  const matches = findMatches(queryClean, cityNames);
  
  if (matches.length > 0) {
    // Prefer shorter matches (more canonical)
    const bestMatch = matches.reduce((a, b) => a.length <= b.length ? a : b);
    const city = cityLookup.get(bestMatch.toLowerCase());
    
    // Calculate confidence
    const queryVars = normalizePlaceName(queryClean);
    const matchVars = normalizePlaceName(bestMatch);
    let commonCount = 0;
    for (const v of queryVars) {
      if (matchVars.has(v)) commonCount++;
    }
    const confidence = commonCount / Math.max(queryVars.size, matchVars.size);
    
    return {
      matched: true,
      query: queryClean,
      dbName: bestMatch,
      dbSlug: city?.slug || createSlug(bestMatch),
      dbId: city?.id,
      matchType: 'variation',
      confidence
    };
  }
  
  // 3. No match
  return {
    matched: false,
    query: queryClean,
    matchType: 'none',
    confidence: 0
  };
}

// =============================================================================
// Supabase Integration Helper
// =============================================================================

/**
 * Fetch cities from Supabase and match a query.
 * Use this in a React component or hook.
 * 
 * Example usage in Lovable:
 * 
 * ```typescript
 * import { supabase } from '@/integrations/supabase/client';
 * import { matchCityToDb } from '@/utils/placeNameMatcher';
 * 
 * const result = await matchCityToDb('Ventura', 'California', supabase);
 * console.log(result); // { matched: true, dbName: 'Ventura', ... }
 * ```
 */
export async function matchCityToDb(
  query: string,
  state: string,
  supabaseClient: any // SupabaseClient type
): Promise<MatchResult> {
  try {
    // Fetch active cities for the state
    const { data: cities, error } = await supabaseClient
      .from('cities')
      .select('id, name, slug, state, active')
      .eq('state', state)
      .eq('active', true);
    
    if (error) {
      console.error('Error fetching cities:', error);
      return { matched: false, query, matchType: 'none', confidence: 0 };
    }
    
    return matchToDbCities(query, cities || []);
  } catch (err) {
    console.error('Error in matchCityToDb:', err);
    return { matched: false, query, matchType: 'none', confidence: 0 };
  }
}

/**
 * Match multiple city queries at once.
 */
export async function matchMultipleCities(
  queries: string[],
  state: string,
  supabaseClient: any
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>();
  
  try {
    // Fetch cities once
    const { data: cities, error } = await supabaseClient
      .from('cities')
      .select('id, name, slug, state, active')
      .eq('state', state)
      .eq('active', true);
    
    if (error || !cities) {
      for (const q of queries) {
        results.set(q, { matched: false, query: q, matchType: 'none', confidence: 0 });
      }
      return results;
    }
    
    // Match each query
    for (const query of queries) {
      results.set(query, matchToDbCities(query, cities));
    }
  } catch (err) {
    console.error('Error in matchMultipleCities:', err);
  }
  
  return results;
}

// =============================================================================
// Exports for different use cases
// =============================================================================

export default {
  normalizePlaceName,
  namesMatch,
  findMatches,
  createSlug,
  matchToDbCities,
  matchCityToDb,
  matchMultipleCities
};
