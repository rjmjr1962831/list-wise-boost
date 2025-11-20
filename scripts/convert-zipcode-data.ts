import fs from 'fs';
import path from 'path';

// Read the JSONL file
const jsonlPath = 'user-uploads://all_cities_formatted.jsonl';
const outputPath = 'src/data/zipCodeData.json';

interface FlatRecord {
  city: string;
  suburb: string;
  zip_code: string;
}

interface ZipCodeRecord {
  zipcode: string;
  population: string;
  median_income: string;
  agent_value: string;
  notes: string;
}

interface Suburb {
  suburb_name: string;
  zipcode_count: number;
  zipcodes: ZipCodeRecord[];
}

interface CityData {
  city: string;
  state: string;
  state_abbreviation: string;
  total_zipcodes: number;
  suburb_count: number;
  suburbs: Suburb[];
}

// Load existing data to preserve state information
const existingData: CityData[] = JSON.parse(
  fs.readFileSync('src/data/zipCodeData.json', 'utf-8')
);

// Create a map of existing city data
const existingCityMap = new Map<string, CityData>();
existingData.forEach(city => {
  existingCityMap.set(city.city.toLowerCase(), city);
});

// Parse JSONL and group by city
const lines = fs.readFileSync(jsonlPath, 'utf-8').split('\n').filter(l => l.trim());
const cityMap = new Map<string, Map<string, string[]>>();

lines.forEach(line => {
  const record: FlatRecord = JSON.parse(line);
  const city = record.city;
  const suburb = record.suburb;
  const zipCode = record.zip_code;

  if (!cityMap.has(city)) {
    cityMap.set(city, new Map());
  }
  
  const suburbMap = cityMap.get(city)!;
  if (!suburbMap.has(suburb)) {
    suburbMap.set(suburb, []);
  }
  
  suburbMap.get(suburb)!.push(zipCode);
});

// Convert to nested structure
const newData: CityData[] = [];

cityMap.forEach((suburbMap, cityName) => {
  const existingCity = existingCityMap.get(cityName.toLowerCase());
  
  const suburbs: Suburb[] = [];
  suburbMap.forEach((zipCodes, suburbName) => {
    const zipcodes: ZipCodeRecord[] = zipCodes.map(zip => ({
      zipcode: zip,
      population: "30000",
      median_income: "65000",
      agent_value: "3",
      notes: `${suburbName} area`
    }));
    
    suburbs.push({
      suburb_name: suburbName,
      zipcode_count: zipcodes.length,
      zipcodes
    });
  });
  
  newData.push({
    city: cityName,
    state: existingCity?.state || "Unknown",
    state_abbreviation: existingCity?.state_abbreviation || "UK",
    total_zipcodes: Array.from(suburbMap.values()).flat().length,
    suburb_count: suburbs.length,
    suburbs
  });
});

// Sort by city name
newData.sort((a, b) => a.city.localeCompare(b.city));

// Write to both locations
fs.writeFileSync(outputPath, JSON.stringify(newData, null, 2));
fs.writeFileSync('supabase/functions/zipCodeData.json', JSON.stringify(newData, null, 2));

console.log(`Converted ${newData.length} cities to ${outputPath}`);
