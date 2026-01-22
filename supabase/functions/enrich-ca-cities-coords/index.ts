import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CENSUS_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_gaz_place_06.txt";
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

// Parse Census gazetteer file
async function fetchCensusData(): Promise<Map<string, CensusPlace>> {
  console.log("Fetching Census data from:", CENSUS_URL);
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
      
      // Handle parenthetical names like "San Buenaventura (Ventura)"
      const match = name.match(/(.+?) \((.+?)\)/);
      if (match) {
        places.set(match[1].trim().toLowerCase(), { lat, lon });
        places.set(match[2].trim().toLowerCase(), { lat, lon });
      } else {
        places.set(name.toLowerCase(), { lat, lon });
      }
    }
  }
  
  console.log(`Parsed ${places.size} Census places`);
  return places;
}

// Fetch all CA cities from database
async function fetchCACities(): Promise<City[]> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ENRICHMENT_API_URL = `${SUPABASE_URL}/functions/v1/enrichment-api`;
  
  console.log("Fetching California cities from database...");
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
          { field: "state", operator: "eq", value: "California" },
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
    console.log(`Fetched ${allCities.length} cities so far...`);
    
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
              text: `What are the latitude and longitude coordinates for ${cityName}, California?

Respond with ONLY a JSON object in this exact format, no other text:
{"lat": 34.0522, "lon": -118.2437}

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
      console.error(`Gemini API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.lat && parsed.lon) {
          return { lat: parsed.lat, lon: parsed.lon };
        }
      }
    }
  } catch (error) {
    console.error(`Gemini error for ${cityName}:`, error);
  }
  
  return null;
}

// Batch update cities
async function updateCities(cities: Array<{name: string; state: string; state_slug: string; slug: string; lat: number; lon: number}>): Promise<{success: number; failed: number}> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ENRICHMENT_API_URL = `${SUPABASE_URL}/functions/v1/enrichment-api`;
  const batchSize = 25;
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize).map(c => ({
      name: c.name,
      state: c.state,
      state_slug: c.state_slug,
      slug: c.slug,
      active: true,
      lat: c.lat,
      lon: c.lon
    }));
    
    try {
      const response = await fetch(`${ENRICHMENT_API_URL}?action=upsert-cities`, {
        method: "POST",
        headers: {
          "X-Enrichment-Key": ENRICHMENT_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ cities: batch })
      });
      
      if (!response.ok) {
        console.error(`Batch ${Math.floor(i/batchSize) + 1} failed: ${response.status}`);
        failed += batch.length;
      } else {
        const result = await response.json();
        console.log(`Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cities.length/batchSize)}: ${result.updated || 0} updated, ${result.inserted || 0} inserted`);
        success += (result.updated || 0) + (result.inserted || 0);
        failed += result.failed || 0;
      }
    } catch (error) {
      console.error(`Batch ${Math.floor(i/batchSize) + 1} error:`, error);
      failed += batch.length;
    }
    
    // Rate limit - 500ms between batches
    await new Promise(r => setTimeout(r, 500));
  }
  
  return { success, failed };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== California Cities Lat/Lon Enrichment Started ===");
    
    // 1. Fetch Census data
    const censusPlaces = await fetchCensusData();
    
    // 2. Fetch CA cities
    const cities = await fetchCACities();
    console.log(`Total CA cities: ${cities.length}`);
    
    // 3. Filter to cities needing coordinates
    const needsCoords = cities.filter(c => c.lat === null || c.lon === null || c.lat === undefined || c.lon === undefined);
    console.log(`Cities needing coordinates: ${needsCoords.length}`);
    
    if (needsCoords.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "All California cities already have coordinates",
        summary: {
          totalCities: cities.length,
          needingCoords: 0,
          matchedFromCensus: 0,
          resolvedByGemini: 0,
          failed: 0
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // 4. Match against Census data
    const matched: Array<{name: string; state: string; state_slug: string; slug: string; lat: number; lon: number}> = [];
    const unmatched: City[] = [];
    
    for (const city of needsCoords) {
      const censusMatch = censusPlaces.get(city.name.toLowerCase());
      if (censusMatch) {
        matched.push({
          name: city.name,
          state: city.state,
          state_slug: city.state_slug,
          slug: city.slug,
          lat: censusMatch.lat,
          lon: censusMatch.lon
        });
      } else {
        unmatched.push(city);
      }
    }
    
    console.log(`Matched from Census: ${matched.length}`);
    console.log(`Unmatched (need Gemini): ${unmatched.length}`);
    
    // 5. Gemini fallback for unmatched
    const geminiResolved: typeof matched = [];
    const failedCities: string[] = [];
    
    for (const city of unmatched) {
      console.log(`Gemini lookup: ${city.name}`);
      const coords = await geocodeWithGemini(city.name);
      
      if (coords) {
        geminiResolved.push({
          name: city.name,
          state: city.state,
          state_slug: city.state_slug,
          slug: city.slug,
          lat: coords.lat,
          lon: coords.lon
        });
        console.log(`  ✓ Found: ${coords.lat}, ${coords.lon}`);
      } else {
        failedCities.push(city.name);
        console.log(`  ✗ Failed to geocode`);
      }
      
      // Rate limit Gemini calls - 500ms between calls
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`Gemini resolved: ${geminiResolved.length}`);
    console.log(`Failed: ${failedCities.length}`);
    
    // 6. Update database
    const allToUpdate = [...matched, ...geminiResolved];
    console.log(`Updating ${allToUpdate.length} cities...`);
    
    const updateResults = await updateCities(allToUpdate);
    
    // 7. Return summary
    console.log("=== Enrichment Complete ===");
    
    return new Response(JSON.stringify({
      success: true,
      summary: {
        totalCities: cities.length,
        needingCoords: needsCoords.length,
        matchedFromCensus: matched.length,
        resolvedByGemini: geminiResolved.length,
        updatedSuccessfully: updateResults.success,
        updatesFailed: updateResults.failed,
        geocodingFailed: failedCities.length,
        failedCities: failedCities
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
