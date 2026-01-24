import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CENSUS_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_gaz_place_04.txt";
const ENRICHMENT_KEY = "t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CensusPlace {
  lat: number;
  lon: number;
}

interface City {
  id: string;
  name: string;
  slug: string;
  state: string;
  state_slug: string;
  lat?: number | null;
  lon?: number | null;
}

// Parse Census gazetteer file for Arizona (state code 04)
async function fetchCensusData(): Promise<Map<string, CensusPlace>> {
  console.log("Fetching Arizona Census data from:", CENSUS_URL);
  const response = await fetch(CENSUS_URL);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Census data: ${response.status}`);
  }
  
  const text = await response.text();
  const lines = text.split("\n").slice(1); // Skip header
  
  const places = new Map<string, CensusPlace>();
  
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 12) {
      const fullName = parts[3];
      const lat = parseFloat(parts[10]);
      const lon = parseFloat(parts[11]);
      
      if (isNaN(lat) || isNaN(lon)) continue;
      
      // Clean name - remove suffix (city, town, CDP)
      let name = fullName.replace(/ (city|town|CDP)$/i, "").trim();
      
      // Handle parenthetical names
      const match = name.match(/(.+?) \((.+?)\)/);
      if (match) {
        places.set(match[1].trim().toLowerCase(), { lat, lon });
        places.set(match[2].trim().toLowerCase(), { lat, lon });
      } else {
        places.set(name.toLowerCase(), { lat, lon });
      }
    }
  }
  
  console.log(`Parsed ${places.size} Arizona Census places`);
  return places;
}

// Fetch all AZ cities from database
async function fetchAZCities(): Promise<City[]> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ENRICHMENT_API_URL = `${SUPABASE_URL}/functions/v1/enrichment-api`;
  
  console.log("Fetching Arizona cities from database...");
  const allCities: City[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const response = await fetch(`${ENRICHMENT_API_URL}?action=query`, {
      method: "POST",
      headers: {
        "X-Enrichment-Key": ENRICHMENT_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        table: "cities",
        select: "id,name,slug,state,state_slug,lat,lon",
        filters: [
          { field: "state", operator: "eq", value: "Arizona" },
          { field: "active", operator: "eq", value: true }
        ],
        limit,
        offset
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch cities: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    if (!data.data || data.data.length === 0) break;
    
    allCities.push(...data.data);
    console.log(`Fetched ${allCities.length} Arizona cities so far...`);
    
    if (data.data.length < limit) break;
    offset += limit;
  }
  
  return allCities;
}

// Gemini fallback for unmatched cities
async function geocodeWithGemini(cityName: string): Promise<CensusPlace | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not configured");
    return null;
  }
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `What are the latitude and longitude coordinates for ${cityName}, Arizona?

Respond with ONLY a JSON object in this exact format, no other text:
{"lat": 33.4484, "lon": -112.0740}

If you cannot find coordinates, respond with:
{"lat": null, "lon": null}`
            }]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 100
          }
        })
      }
    );
    
    if (!response.ok) {
      console.error(`Gemini API error for ${cityName}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      console.error(`Could not parse Gemini response for ${cityName}: ${text}`);
      return null;
    }
    
    const coords = JSON.parse(jsonMatch[0]);
    if (coords.lat === null || coords.lon === null) {
      return null;
    }
    
    console.log(`Gemini resolved ${cityName}: ${coords.lat}, ${coords.lon}`);
    return { lat: coords.lat, lon: coords.lon };
  } catch (error) {
    console.error(`Gemini geocoding error for ${cityName}:`, error);
    return null;
  }
}

// Update cities via enrichment API
async function updateCities(cities: Array<{name: string; state: string; state_slug: string; slug: string; lat: number; lon: number}>): Promise<{success: number; failed: number}> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ENRICHMENT_API_URL = `${SUPABASE_URL}/functions/v1/enrichment-api`;
  
  let success = 0;
  let failed = 0;
  
  // Process in batches of 25
  for (let i = 0; i < cities.length; i += 25) {
    const batch = cities.slice(i, i + 25);
    
    try {
      const response = await fetch(`${ENRICHMENT_API_URL}?action=upsert-cities`, {
        method: "POST",
        headers: {
          "X-Enrichment-Key": ENRICHMENT_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ cities: batch })
      });
      
      if (response.ok) {
        const result = await response.json();
        success += result.upserted || batch.length;
        console.log(`Updated batch ${Math.floor(i/25) + 1}: ${batch.length} cities`);
      } else {
        const errorText = await response.text();
        console.error(`Failed to update batch: ${errorText}`);
        failed += batch.length;
      }
    } catch (error) {
      console.error(`Error updating batch:`, error);
      failed += batch.length;
    }
    
    // Small delay between batches
    if (i + 25 < cities.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  return { success, failed };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Arizona city geocoding...");
    
    // Fetch Census data and cities in parallel
    const [censusPlaces, cities] = await Promise.all([
      fetchCensusData(),
      fetchAZCities()
    ]);
    
    console.log(`Processing ${cities.length} Arizona cities...`);
    
    // Filter to cities without coordinates
    const needsGeocoding = cities.filter(c => c.lat === null || c.lon === null);
    console.log(`${needsGeocoding.length} cities need geocoding`);
    
    const toUpdate: Array<{name: string; state: string; state_slug: string; slug: string; lat: number; lon: number}> = [];
    const geminiNeeded: City[] = [];
    
    // First pass: match against Census data
    for (const city of needsGeocoding) {
      const normalizedName = city.name.toLowerCase();
      const censusData = censusPlaces.get(normalizedName);
      
      if (censusData) {
        toUpdate.push({
          name: city.name,
          state: city.state,
          state_slug: city.state_slug,
          slug: city.slug,
          lat: censusData.lat,
          lon: censusData.lon
        });
      } else {
        geminiNeeded.push(city);
      }
    }
    
    console.log(`Census matched: ${toUpdate.length}, Gemini needed: ${geminiNeeded.length}`);
    
    // Second pass: Gemini fallback for unmatched
    for (const city of geminiNeeded) {
      const coords = await geocodeWithGemini(city.name);
      if (coords) {
        toUpdate.push({
          name: city.name,
          state: city.state,
          state_slug: city.state_slug,
          slug: city.slug,
          lat: coords.lat,
          lon: coords.lon
        });
      }
      // Rate limit Gemini calls
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`Total to update: ${toUpdate.length}`);
    
    // Update database
    const updateResult = await updateCities(toUpdate);
    
    const result = {
      totalCities: cities.length,
      neededGeocoding: needsGeocoding.length,
      censusMatched: toUpdate.length - geminiNeeded.filter(c => toUpdate.some(u => u.name === c.name)).length,
      geminiResolved: geminiNeeded.filter(c => toUpdate.some(u => u.name === c.name)).length,
      updated: updateResult.success,
      failed: updateResult.failed
    };
    
    console.log("Arizona geocoding complete:", result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Arizona geocoding error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
