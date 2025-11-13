import zipCodeData from './zipCodeData.json';

export interface ZipCodeRecord {
  city: string;
  state: string;
  stateAbbreviation: string;
  zipCode: string;
  population: number;
  medianIncome: number;
  agentValue: number;
  notes: string;
}

// Type the imported data
const typedZipCodeData: ZipCodeRecord[] = zipCodeData as ZipCodeRecord[];

/**
 * Find city and state information by zip code
 * @param zipCode - The 5-digit zip code to search for
 * @returns City and state information or null if not found
 */
export function findCityByZip(zipCode: string): { city: string; state: string } | null {
  const found = typedZipCodeData.find(record => record.zipCode === zipCode);
  if (found) {
    return { city: found.city, state: found.state };
  }
  return null;
}

/**
 * Get detailed zip code information including market data
 * @param zipCode - The 5-digit zip code to search for
 * @returns Complete zip code record or null if not found
 */
export function getZipCodeDetails(zipCode: string): ZipCodeRecord | null {
  return typedZipCodeData.find(record => record.zipCode === zipCode) || null;
}

/**
 * Get all zip codes for a given city
 * @param city - The city name
 * @param state - The state name (optional, for disambiguation)
 * @returns Array of zip code records for the city
 */
export function getZipCodesByCity(city: string, state?: string): ZipCodeRecord[] {
  return typedZipCodeData.filter(record => {
    const cityMatch = record.city.toLowerCase() === city.toLowerCase();
    if (state) {
      return cityMatch && (
        record.state.toLowerCase() === state.toLowerCase() ||
        record.stateAbbreviation.toLowerCase() === state.toLowerCase()
      );
    }
    return cityMatch;
  });
}

/**
 * Get high-value zip codes (agent value >= threshold)
 * @param minAgentValue - Minimum agent value threshold (1-5)
 * @returns Array of high-value zip code records
 */
export function getHighValueZipCodes(minAgentValue: number = 4): ZipCodeRecord[] {
  return typedZipCodeData.filter(record => record.agentValue >= minAgentValue);
}

/**
 * Search zip codes by market characteristics
 * @param filters - Search filters
 * @returns Filtered zip code records
 */
export function searchZipCodes(filters: {
  minPopulation?: number;
  maxPopulation?: number;
  minIncome?: number;
  maxIncome?: number;
  minAgentValue?: number;
  state?: string;
  city?: string;
}): ZipCodeRecord[] {
  return typedZipCodeData.filter(record => {
    if (filters.minPopulation && record.population < filters.minPopulation) return false;
    if (filters.maxPopulation && record.population > filters.maxPopulation) return false;
    if (filters.minIncome && record.medianIncome < filters.minIncome) return false;
    if (filters.maxIncome && record.medianIncome > filters.maxIncome) return false;
    if (filters.minAgentValue && record.agentValue < filters.minAgentValue) return false;
    if (filters.state && 
        record.state.toLowerCase() !== filters.state.toLowerCase() &&
        record.stateAbbreviation.toLowerCase() !== filters.state.toLowerCase()) return false;
    if (filters.city && record.city.toLowerCase() !== filters.city.toLowerCase()) return false;
    return true;
  });
}

/**
 * Get default zip code for a city (highest agent value)
 * @param city - The city name
 * @param state - The state name (optional)
 * @returns The best zip code for the city or null if not found
 */
export function getDefaultZipForCity(city: string, state?: string): string | null {
  const cityZips = getZipCodesByCity(city, state);
  if (cityZips.length === 0) return null;
  
  // Return the zip code with highest agent value, then highest median income
  const best = cityZips.sort((a, b) => {
    if (b.agentValue !== a.agentValue) {
      return b.agentValue - a.agentValue;
    }
    return b.medianIncome - a.medianIncome;
  })[0];
  
  return best.zipCode;
}

export { typedZipCodeData as zipCodeData };
