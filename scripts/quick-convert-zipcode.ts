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

// Function to determine state from zip code prefix
function getStateFromZip(zipCode: string): { state: string; abbreviation: string } {
  const firstTwo = zipCode.substring(0, 2);
  
  if (firstTwo >= '35' && firstTwo <= '36') return { state: 'Alabama', abbreviation: 'AL' };
  if (firstTwo === '99') return { state: 'Alaska', abbreviation: 'AK' };
  if (firstTwo >= '85' && firstTwo <= '86') return { state: 'Arizona', abbreviation: 'AZ' };
  if (firstTwo >= '71' && firstTwo <= '72') return { state: 'Arkansas', abbreviation: 'AR' };
  if (firstTwo >= '90' && firstTwo <= '96') return { state: 'California', abbreviation: 'CA' };
  if (firstTwo >= '80' && firstTwo <= '81') return { state: 'Colorado', abbreviation: 'CO' };
  if (firstTwo === '06') return { state: 'Connecticut', abbreviation: 'CT' };
  if (firstTwo === '19') return { state: 'Delaware', abbreviation: 'DE' };
  if (firstTwo >= '32' && firstTwo <= '34') return { state: 'Florida', abbreviation: 'FL' };
  if (firstTwo >= '30' && firstTwo <= '31') return { state: 'Georgia', abbreviation: 'GA' };
  if (firstTwo === '96') return { state: 'Hawaii', abbreviation: 'HI' };
  if (firstTwo >= '83' && firstTwo <= '83') return { state: 'Idaho', abbreviation: 'ID' };
  if (firstTwo >= '60' && firstTwo <= '62') return { state: 'Illinois', abbreviation: 'IL' };
  if (firstTwo >= '46' && firstTwo <= '47') return { state: 'Indiana', abbreviation: 'IN' };
  if (firstTwo >= '50' && firstTwo <= '52') return { state: 'Iowa', abbreviation: 'IA' };
  if (firstTwo >= '66' && firstTwo <= '67') return { state: 'Kansas', abbreviation: 'KS' };
  if (firstTwo >= '40' && firstTwo <= '42') return { state: 'Kentucky', abbreviation: 'KY' };
  if (firstTwo >= '70' && firstTwo <= '71') return { state: 'Louisiana', abbreviation: 'LA' };
  if (firstTwo === '03' || firstTwo === '04') return { state: 'Maine', abbreviation: 'ME' };
  if (firstTwo >= '20' && firstTwo <= '21') return { state: 'Maryland', abbreviation: 'MD' };
  if (firstTwo >= '01' && firstTwo <= '02') return { state: 'Massachusetts', abbreviation: 'MA' };
  if (firstTwo >= '48' && firstTwo <= '49') return { state: 'Michigan', abbreviation: 'MI' };
  if (firstTwo >= '55' && firstTwo <= '56') return { state: 'Minnesota', abbreviation: 'MN' };
  if (firstTwo >= '38' && firstTwo <= '39') return { state: 'Mississippi', abbreviation: 'MS' };
  if (firstTwo >= '63' && firstTwo <= '65') return { state: 'Missouri', abbreviation: 'MO' };
  if (firstTwo === '59') return { state: 'Montana', abbreviation: 'MT' };
  if (firstTwo >= '68' && firstTwo <= '69') return { state: 'Nebraska', abbreviation: 'NE' };
  if (firstTwo >= '88' && firstTwo <= '89') return { state: 'Nevada', abbreviation: 'NV' };
  if (firstTwo === '03') return { state: 'New Hampshire', abbreviation: 'NH' };
  if (firstTwo >= '07' && firstTwo <= '08') return { state: 'New Jersey', abbreviation: 'NJ' };
  if (firstTwo >= '87' && firstTwo <= '88') return { state: 'New Mexico', abbreviation: 'NM' };
  if (firstTwo >= '10' && firstTwo <= '14') return { state: 'New York', abbreviation: 'NY' };
  if (firstTwo >= '27' && firstTwo <= '28') return { state: 'North Carolina', abbreviation: 'NC' };
  if (firstTwo === '58') return { state: 'North Dakota', abbreviation: 'ND' };
  if (firstTwo >= '43' && firstTwo <= '45') return { state: 'Ohio', abbreviation: 'OH' };
  if (firstTwo >= '73' && firstTwo <= '74') return { state: 'Oklahoma', abbreviation: 'OK' };
  if (firstTwo >= '97' && firstTwo <= '97') return { state: 'Oregon', abbreviation: 'OR' };
  if (firstTwo >= '15' && firstTwo <= '19') return { state: 'Pennsylvania', abbreviation: 'PA' };
  if (firstTwo === '02') return { state: 'Rhode Island', abbreviation: 'RI' };
  if (firstTwo === '29') return { state: 'South Carolina', abbreviation: 'SC' };
  if (firstTwo === '57') return { state: 'South Dakota', abbreviation: 'SD' };
  if (firstTwo >= '37' && firstTwo <= '38') return { state: 'Tennessee', abbreviation: 'TN' };
  if (firstTwo >= '75' && firstTwo <= '79') return { state: 'Texas', abbreviation: 'TX' };
  if (firstTwo === '84') return { state: 'Utah', abbreviation: 'UT' };
  if (firstTwo === '05') return { state: 'Vermont', abbreviation: 'VT' };
  if (firstTwo >= '22' && firstTwo <= '24') return { state: 'Virginia', abbreviation: 'VA' };
  if (firstTwo >= '98' && firstTwo <= '99') return { state: 'Washington', abbreviation: 'WA' };
  if (firstTwo >= '24' && firstTwo <= '26') return { state: 'West Virginia', abbreviation: 'WV' };
  if (firstTwo >= '53' && firstTwo <= '54') return { state: 'Wisconsin', abbreviation: 'WI' };
  if (firstTwo >= '82' && firstTwo <= '83') return { state: 'Wyoming', abbreviation: 'WY' };
  
  return { state: 'Unknown', abbreviation: 'XX' };
}

// Read the JSONL file
const jsonlContent = readFileSync('public/all_cities_formatted-2.jsonl', 'utf-8');
const lines = jsonlContent.trim().split('\n');

// Parse and group by city, tracking first zip for state lookup
const cityMap = new Map<string, { suburbs: Map<string, string[]>, firstZip: string }>();

for (const line of lines) {
  const record: FlatRecord = JSON.parse(line);
  const city = record.city;
  const suburb = record.suburb;
  const zipCode = record.zip_code;

  if (!cityMap.has(city)) {
    cityMap.set(city, { suburbs: new Map(), firstZip: zipCode });
  }
  
  const cityData = cityMap.get(city)!;
  if (!cityData.suburbs.has(suburb)) {
    cityData.suburbs.set(suburb, []);
  }
  
  cityData.suburbs.get(suburb)!.push(zipCode);
}

// Convert to nested structure
const newData: CityData[] = [];

cityMap.forEach((cityData, cityName) => {
  // Use first zip code to determine state
  const stateInfo = getStateFromZip(cityData.firstZip);
  
  const suburbs: Suburb[] = [];
  cityData.suburbs.forEach((zipCodes, suburbName) => {
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
    state: stateInfo.state,
    state_abbreviation: stateInfo.abbreviation,
    total_zipcodes: Array.from(cityData.suburbs.values()).flat().length,
    suburb_count: suburbs.length,
    suburbs
  });
});

// Sort by city name
newData.sort((a, b) => a.city.localeCompare(b.city));

// Write to both locations
writeFileSync('src/data/zipCodeData.json', JSON.stringify(newData, null, 2));
writeFileSync('supabase/functions/zipCodeData.json', JSON.stringify(newData, null, 2));

console.log(`✅ Conversion complete! Processed ${newData.length} cities.`);
console.log(`✅ Updated src/data/zipCodeData.json`);
console.log(`✅ Updated supabase/functions/zipCodeData.json`);
