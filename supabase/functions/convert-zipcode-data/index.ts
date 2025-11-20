import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// State lookup map
const stateMap: Record<string, { state: string; abbreviation: string }> = {
  'phoenix': { state: 'Arizona', abbreviation: 'AZ' },
  'scottsdale': { state: 'Arizona', abbreviation: 'AZ' },
  'gilbert': { state: 'Arizona', abbreviation: 'AZ' },
  'los angeles': { state: 'California', abbreviation: 'CA' },
  'anaheim': { state: 'California', abbreviation: 'CA' },
  'dallas': { state: 'Texas', abbreviation: 'TX' },
  'abilene': { state: 'Texas', abbreviation: 'TX' },
  // Add more as needed
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read the JSONL file
    const jsonlText = await Deno.readTextFile('./all_cities_formatted.jsonl');
    const lines = jsonlText.split('\n').filter(l => l.trim());
    
    // Parse and group by city
    const cityMap = new Map<string, Map<string, string[]>>();
    
    for (const line of lines) {
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
    }

    // Convert to nested structure
    const newData: CityData[] = [];

    cityMap.forEach((suburbMap, cityName) => {
      const cityKey = cityName.toLowerCase();
      const stateInfo = stateMap[cityKey] || { state: 'Unknown', abbreviation: 'UK' };
      
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
        state: stateInfo.state,
        state_abbreviation: stateInfo.abbreviation,
        total_zipcodes: Array.from(suburbMap.values()).flat().length,
        suburb_count: suburbs.length,
        suburbs
      });
    });

    // Sort by city name
    newData.sort((a, b) => a.city.localeCompare(b.city));

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: newData,
        totalCities: newData.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Conversion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
