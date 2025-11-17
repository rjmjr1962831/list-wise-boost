import zipCodeData from './zipCodeData.json';

export interface ZipCodeRecord {
  zipcode: string;
  population: string;
  median_income: string;
  agent_value: string;
  notes: string;
}

export interface Suburb {
  suburb_name: string;
  zipcode_count: number;
  zipcodes: ZipCodeRecord[];
}

export interface CityData {
  city: string;
  state: string;
  state_abbreviation: string;
  total_zipcodes: number;
  suburb_count: number;
  suburbs: Suburb[];
}

// Type the imported data
const typedZipCodeData: CityData[] = zipCodeData as CityData[];

/**
 * Find city and state information by zip code
 * @param zipCode - The 5-digit zip code to search for
 * @returns City and state information or null if not found
 */
export function findCityByZip(zipCode: string): { city: string; state: string } | null {
  for (const cityData of typedZipCodeData) {
    for (const suburb of cityData.suburbs) {
      const found = suburb.zipcodes.find(z => z.zipcode === zipCode);
      if (found) {
        return { city: cityData.city, state: cityData.state };
      }
    }
  }
  return null;
}

/**
 * Get detailed zip code information including market data
 * @param zipCode - The 5-digit zip code to search for
 * @returns Complete zip code record or null if not found
 */
export function getZipCodeDetails(zipCode: string): (ZipCodeRecord & { city: string; state: string; suburb: string }) | null {
  for (const cityData of typedZipCodeData) {
    for (const suburb of cityData.suburbs) {
      const found = suburb.zipcodes.find(z => z.zipcode === zipCode);
      if (found) {
        return {
          ...found,
          city: cityData.city,
          state: cityData.state,
          suburb: suburb.suburb_name
        };
      }
    }
  }
  return null;
}

/**
 * Get all zip codes for a given city
 * @param city - The city name
 * @param state - The state name (optional, for disambiguation)
 * @returns Array of zip code records for the city
 */
export function getZipCodesByCity(city: string, state?: string): (ZipCodeRecord & { suburb: string })[] {
  const cityData = typedZipCodeData.find(c => {
    const cityMatch = c.city.toLowerCase() === city.toLowerCase();
    if (state) {
      return cityMatch && (
        c.state.toLowerCase() === state.toLowerCase() ||
        c.state_abbreviation.toLowerCase() === state.toLowerCase()
      );
    }
    return cityMatch;
  });

  if (!cityData) return [];

  const allZips: (ZipCodeRecord & { suburb: string })[] = [];
  for (const suburb of cityData.suburbs) {
    for (const zipcode of suburb.zipcodes) {
      allZips.push({
        ...zipcode,
        suburb: suburb.suburb_name
      });
    }
  }
  return allZips;
}

/**
 * Get high-value zip codes (agent value >= threshold)
 * @param minAgentValue - Minimum agent value threshold (1-5)
 * @returns Array of high-value zip code records
 */
export function getHighValueZipCodes(minAgentValue: number = 4): (ZipCodeRecord & { city: string; state: string; suburb: string })[] {
  const highValue: (ZipCodeRecord & { city: string; state: string; suburb: string })[] = [];
  
  for (const cityData of typedZipCodeData) {
    for (const suburb of cityData.suburbs) {
      for (const zipcode of suburb.zipcodes) {
        if (parseInt(zipcode.agent_value) >= minAgentValue) {
          highValue.push({
            ...zipcode,
            city: cityData.city,
            state: cityData.state,
            suburb: suburb.suburb_name
          });
        }
      }
    }
  }
  
  return highValue;
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
}): (ZipCodeRecord & { city: string; state: string; suburb: string })[] {
  const results: (ZipCodeRecord & { city: string; state: string; suburb: string })[] = [];
  
  for (const cityData of typedZipCodeData) {
    // Filter by state/city at city level
    if (filters.state && 
        cityData.state.toLowerCase() !== filters.state.toLowerCase() &&
        cityData.state_abbreviation.toLowerCase() !== filters.state.toLowerCase()) continue;
    if (filters.city && cityData.city.toLowerCase() !== filters.city.toLowerCase()) continue;
    
    for (const suburb of cityData.suburbs) {
      for (const zipcode of suburb.zipcodes) {
        const population = parseInt(zipcode.population);
        const income = parseInt(zipcode.median_income);
        const agentValue = parseInt(zipcode.agent_value);
        
        if (filters.minPopulation && population < filters.minPopulation) continue;
        if (filters.maxPopulation && population > filters.maxPopulation) continue;
        if (filters.minIncome && income < filters.minIncome) continue;
        if (filters.maxIncome && income > filters.maxIncome) continue;
        if (filters.minAgentValue && agentValue < filters.minAgentValue) continue;
        
        results.push({
          ...zipcode,
          city: cityData.city,
          state: cityData.state,
          suburb: suburb.suburb_name
        });
      }
    }
  }
  
  return results;
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
    const aValue = parseInt(a.agent_value);
    const bValue = parseInt(b.agent_value);
    if (bValue !== aValue) {
      return bValue - aValue;
    }
    return parseInt(b.median_income) - parseInt(a.median_income);
  })[0];
  
  return best.zipcode;
}

/**
 * Get city data by name
 * @param city - The city name
 * @param state - The state name (optional)
 * @returns Complete city data or null if not found
 */
export function getCityData(city: string, state?: string): CityData | null {
  return typedZipCodeData.find(c => {
    const cityMatch = c.city.toLowerCase() === city.toLowerCase();
    if (state) {
      return cityMatch && (
        c.state.toLowerCase() === state.toLowerCase() ||
        c.state_abbreviation.toLowerCase() === state.toLowerCase()
      );
    }
    return cityMatch;
  }) || null;
}

export { typedZipCodeData as zipCodeData };
