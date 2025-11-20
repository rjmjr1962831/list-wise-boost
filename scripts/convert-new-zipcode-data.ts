import { readFileSync, writeFileSync } from 'fs';

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

// Read the existing data to preserve state information
const existingDataPath = 'src/data/zipCodeData.json';
const existingData: CityData[] = JSON.parse(readFileSync(existingDataPath, 'utf-8'));
const existingCityMap = new Map(existingData.map(city => [city.city.toLowerCase(), city]));

// Read the new JSONL file
const jsonlPath = 'user-uploads://all_cities_formatted-2.jsonl';
const jsonlContent = readFileSync(jsonlPath, 'utf-8');
const lines = jsonlContent.trim().split('\n');

// Parse and group the data
const cityMap = new Map<string, Map<string, string[]>>();

for (const line of lines) {
  const record: FlatRecord = JSON.parse(line);
  
  if (!cityMap.has(record.city)) {
    cityMap.set(record.city, new Map());
  }
  
  const suburbMap = cityMap.get(record.city)!;
  if (!suburbMap.has(record.suburb)) {
    suburbMap.set(record.suburb, []);
  }
  
  suburbMap.get(record.suburb)!.push(record.zip_code);
}

// Convert to the new format
const newData: CityData[] = [];

for (const [cityName, suburbMap] of cityMap.entries()) {
  const existingCity = existingCityMap.get(cityName.toLowerCase());
  
  const suburbs: Suburb[] = [];
  let totalZipcodes = 0;
  
  for (const [suburbName, zipcodes] of suburbMap.entries()) {
    const zipCodeRecords: ZipCodeRecord[] = zipcodes.map(zip => ({
      zipcode: zip,
      population: "25000",
      median_income: "65000",
      agent_value: "3",
      notes: `${cityName} - ${suburbName}`
    }));
    
    suburbs.push({
      suburb_name: suburbName,
      zipcode_count: zipcodes.length,
      zipcodes: zipCodeRecords
    });
    
    totalZipcodes += zipcodes.length;
  }
  
  newData.push({
    city: cityName,
    state: existingCity?.state || "Unknown",
    state_abbreviation: existingCity?.state_abbreviation || "XX",
    total_zipcodes: totalZipcodes,
    suburb_count: suburbs.length,
    suburbs: suburbs
  });
}

// Sort by city name
newData.sort((a, b) => a.city.localeCompare(b.city));

// Write to both locations
const outputPath1 = 'src/data/zipCodeData.json';
const outputPath2 = 'supabase/functions/zipCodeData.json';

writeFileSync(outputPath1, JSON.stringify(newData, null, 2));
writeFileSync(outputPath2, JSON.stringify(newData, null, 2));

console.log(`Conversion complete! Processed ${newData.length} cities.`);
console.log(`Updated ${outputPath1} and ${outputPath2}`);
