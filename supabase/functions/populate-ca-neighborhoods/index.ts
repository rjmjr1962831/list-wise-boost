import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Census ACS API (free, no key needed)
const CENSUS_ACS_BASE = "https://api.census.gov/data/2022/acs/acs5";

// Safeguards
const MAX_NEIGHBORHOODS_PER_CITY = 50; // Prevent LA from creating 100+ neighborhoods
const CENSUS_RATE_LIMIT_MS = 200; // Be conservative with Census API
const CLAUDE_RATE_LIMIT_MS = 600; // Rate limit Claude calls

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

interface NeighborhoodDiscovery {
  name: string;
  slug: string;
  description: string;
  zipCodes: string[];
  primaryZip: string;
  lat: number;
  lon: number;
  features: string[];
  housingTypes: string[];
  vibe: string;
}

interface NeighborhoodData {
  state: string;
  city_area: string;
  city_area_slug: string;
  neighborhood: string;
  neighborhood_slug: string;
  zips: string[];
  primary_zip: string;
  lat: number;
  lon: number;
  median_income: number | null;
  median_home_value: number | null;
  tier: string;
  income_pct: number | null;
  value_pct: number | null;
  score: number | null;
  is_verified: boolean;
  is_active: boolean;
  writeup_html: string;
  writeup_research: string;
  writeup_generated_at: string;
  nearby_neighborhoods: string[];
}

// ============================================================
// MODEL 1: GEMINI FLASH 2.0 - Neighborhood Discovery
// ============================================================

async function discoverNeighborhoods(cityName: string, cityLat: number, cityLon: number): Promise<NeighborhoodDiscovery[]> {
  const prompt = `You are a California real estate expert. List the distinct neighborhoods in ${cityName}, California.

IMPORTANT RULES:
- Only include REAL neighborhoods that locals recognize
- Do NOT include ZIP codes, census tracts, or arbitrary divisions
- Do NOT include the city name itself as a neighborhood
- For small cities with no distinct neighborhoods, return an empty array []
- Include unincorporated areas and CDPs that are commonly associated with this city
- MAXIMUM ${MAX_NEIGHBORHOODS_PER_CITY} neighborhoods - prioritize the most important/well-known ones

For each neighborhood, provide:
1. name: Official or commonly used neighborhood name
2. slug: lowercase-hyphenated version (e.g., "north-park")
3. description: 1-2 sentences about the area
4. zipCodes: Array of ZIP codes that cover this neighborhood
5. primaryZip: The main ZIP code for this neighborhood
6. lat: Approximate latitude of neighborhood center (use ${cityLat} as reference)
7. lon: Approximate longitude of neighborhood center (use ${cityLon} as reference)
8. features: Array of notable features (schools, parks, landmarks)
9. housingTypes: Array like ["single-family", "condos", "apartments"]
10. vibe: One phrase describing the neighborhood character

Respond with ONLY a valid JSON array, no other text:
[
  {
    "name": "Example Heights",
    "slug": "example-heights",
    "description": "A family-friendly area known for...",
    "zipCodes": ["90210", "90211"],
    "primaryZip": "90210",
    "lat": 34.0901,
    "lon": -118.4065,
    "features": ["Central Park", "Lincoln Elementary"],
    "housingTypes": ["single-family", "townhomes"],
    "vibe": "Quiet suburban with excellent schools"
  }
]

If ${cityName} has no distinct neighborhoods (common for small cities), respond with:
[]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192
          }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        // Apply safeguard: limit neighborhoods per city
        return parsed.slice(0, MAX_NEIGHBORHOODS_PER_CITY);
      }
    }
  } catch (error) {
    console.error(`Gemini discovery error for ${cityName}:`, error);
  }
  
  return [];
}

// ============================================================
// MODEL 2: CENSUS ACS API - Market Statistics
// ============================================================

async function fetchCensusDataForZip(zipCode: string): Promise<{income: number | null, homeValue: number | null}> {
  try {
    // Census ACS 5-year estimates by ZCTA
    // B19013_001E = Median household income
    // B25077_001E = Median home value
    const url = `${CENSUS_ACS_BASE}?get=B19013_001E,B25077_001E&for=zip%20code%20tabulation%20area:${zipCode}`;
    
    const response = await fetch(url);
    if (!response.ok) return { income: null, homeValue: null };
    
    const data = await response.json();
    if (data.length < 2) return { income: null, homeValue: null };
    
    const income = parseInt(data[1][0]) || null;
    const homeValue = parseInt(data[1][1]) || null;
    
    return { income, homeValue };
  } catch (error) {
    console.error(`Census fetch error for ZIP ${zipCode}:`, error);
    return { income: null, homeValue: null };
  }
}

function calculateTier(income: number | null, homeValue: number | null, allStats: Array<{income: number | null, homeValue: number | null}>): {
  tier: string;
  income_pct: number | null;
  value_pct: number | null;
  score: number | null;
} {
  if (!income && !homeValue) {
    return { tier: "Main", income_pct: null, value_pct: null, score: null };
  }

  // Calculate percentiles
  const validIncomes = allStats.map(s => s.income).filter((i): i is number => i !== null).sort((a, b) => a - b);
  const validValues = allStats.map(s => s.homeValue).filter((v): v is number => v !== null).sort((a, b) => a - b);
  
  let income_pct: number | null = null;
  let value_pct: number | null = null;
  
  if (income && validIncomes.length > 0) {
    const incomeRank = validIncomes.filter(i => i <= income).length;
    income_pct = (incomeRank / validIncomes.length) * 100;
  }
  
  if (homeValue && validValues.length > 0) {
    const valueRank = validValues.filter(v => v <= homeValue).length;
    value_pct = (valueRank / validValues.length) * 100;
  }
  
  // Combined score (average of percentiles)
  const pcts = [income_pct, value_pct].filter((p): p is number => p !== null);
  const score = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  
  // Tier assignment: Luxury (top 20%), Prime (50-80%), Main (below 50%)
  let tier = "Main";
  if (score !== null) {
    if (score >= 80) tier = "Luxury";
    else if (score >= 50) tier = "Prime";
  }
  
  return { tier, income_pct, value_pct, score };
}

async function enrichWithStats(
  neighborhoods: NeighborhoodDiscovery[],
  cityName: string,
  citySlug: string
): Promise<Partial<NeighborhoodData>[]> {
  // First, fetch Census data for all ZIP codes
  const allZips = new Set<string>();
  for (const n of neighborhoods) {
    n.zipCodes.forEach(z => allZips.add(z));
  }
  
  console.log(`  Fetching Census data for ${allZips.size} ZIP codes...`);
  
  const zipStats = new Map<string, {income: number | null, homeValue: number | null}>();
  let censusErrors = 0;
  
  for (const zip of allZips) {
    const stats = await fetchCensusDataForZip(zip);
    zipStats.set(zip, stats);
    if (stats.income === null && stats.homeValue === null) {
      censusErrors++;
    }
    await new Promise(r => setTimeout(r, CENSUS_RATE_LIMIT_MS)); // Rate limit Census API
  }
  
  console.log(`  Census data: ${allZips.size - censusErrors} success, ${censusErrors} no data`);
  
  // Collect all stats for percentile calculation
  const allStats = Array.from(zipStats.values());
  
  // Enrich each neighborhood
  const enriched: Partial<NeighborhoodData>[] = [];
  
  for (const n of neighborhoods) {
    // Use primary ZIP for stats, fallback to first available
    const primaryStats = zipStats.get(n.primaryZip) || { income: null, homeValue: null };
    const tierData = calculateTier(primaryStats.income, primaryStats.homeValue, allStats);
    
    enriched.push({
      state: "CA",
      city_area: cityName,
      city_area_slug: citySlug,
      neighborhood: n.name,
      neighborhood_slug: n.slug,
      zips: n.zipCodes,
      primary_zip: n.primaryZip,
      lat: n.lat,
      lon: n.lon,
      median_income: primaryStats.income,
      median_home_value: primaryStats.homeValue,
      tier: tierData.tier,
      income_pct: tierData.income_pct,
      value_pct: tierData.value_pct,
      score: tierData.score,
      is_verified: false,
      is_active: true,
      writeup_research: JSON.stringify({
        description: n.description,
        features: n.features,
        housingTypes: n.housingTypes,
        vibe: n.vibe
      })
    });
  }
  
  return enriched;
}

// ============================================================
// MODEL 3: CLAUDE SONNET - Content Writing
// ============================================================

async function generateWriteup(neighborhood: Partial<NeighborhoodData>): Promise<string> {
  const research = neighborhood.writeup_research ? JSON.parse(neighborhood.writeup_research) : {};
  
  const prompt = `Write a 2-3 paragraph neighborhood description for ${neighborhood.neighborhood} in ${neighborhood.city_area}, California.

CONTEXT:
- Description: ${research.description || "N/A"}
- Vibe: ${research.vibe || "N/A"}
- Features: ${(research.features || []).join(", ") || "N/A"}
- Housing types: ${(research.housingTypes || []).join(", ") || "N/A"}
- Median household income: ${neighborhood.median_income ? "$" + neighborhood.median_income.toLocaleString() : "N/A"}
- Median home value: ${neighborhood.median_home_value ? "$" + neighborhood.median_home_value.toLocaleString() : "N/A"}
- Market tier: ${neighborhood.tier || "N/A"}

WRITING RULES:
1. Be factual and informative, no marketing fluff
2. Include neighborhood character, housing stock, lifestyle
3. Mention nearby amenities if known
4. Reference market context (pricing tier) naturally
5. DO NOT use em dashes anywhere. Use proper sentence structure instead.
6. DO NOT start with "Nestled" or similar cliches
7. Write in a professional, authoritative tone

Respond with ONLY the HTML paragraphs, no other text:
<p>First paragraph about the neighborhood character and location...</p>
<p>Second paragraph about housing and lifestyle...</p>
<p>Optional third paragraph about market context...</p>`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    
    // Ensure we got HTML paragraphs
    if (text.includes("<p>")) {
      return text.trim();
    }
    
    // Wrap in paragraph tags if plain text
    return `<p>${text.trim()}</p>`;
  } catch (error) {
    console.error(`Claude writeup error for ${neighborhood.neighborhood}:`, error);
    return `<p>${neighborhood.neighborhood} is a neighborhood in ${neighborhood.city_area}, California.</p>`;
  }
}

// ============================================================
// NEARBY NEIGHBORHOODS CALCULATION
// ============================================================

function calculateNearbyNeighborhoods(
  current: Partial<NeighborhoodData>,
  allNeighborhoods: Partial<NeighborhoodData>[],
  maxDistance: number = 5 // miles
): string[] {
  if (!current.lat || !current.lon) return [];
  
  const nearby: Array<{slug: string; distance: number}> = [];
  
  for (const n of allNeighborhoods) {
    if (n.neighborhood_slug === current.neighborhood_slug) continue;
    if (!n.lat || !n.lon) continue;
    
    // Haversine distance calculation
    const R = 3959; // Earth's radius in miles
    const dLat = (n.lat - current.lat) * Math.PI / 180;
    const dLon = (n.lon - current.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(current.lat * Math.PI / 180) * Math.cos(n.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    if (distance <= maxDistance) {
      nearby.push({ slug: n.neighborhood_slug!, distance });
    }
  }
  
  // Sort by distance and return top 10
  return nearby
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10)
    .map(n => n.slug);
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

async function fetchCACities(limit: number = 10, offset: number = 0): Promise<Array<{name: string; slug: string; lat: number; lon: number}>> {
  const { data, error } = await supabase
    .from("cities")
    .select("name, slug, lat, lon")
    .eq("state", "California")
    .eq("active", true)
    .not("lat", "is", null)
    .not("lon", "is", null)
    .order("name")
    .range(offset, offset + limit - 1);
  
  if (error) {
    console.error("Error fetching cities:", error);
    return [];
  }
  
  return data || [];
}

async function fetchPriorityCities(cityNames: string[]): Promise<Array<{name: string; slug: string; lat: number; lon: number}>> {
  // Fetch priority cities one by one to avoid the "in" operator issue
  const cities: Array<{name: string; slug: string; lat: number; lon: number}> = [];
  
  for (const cityName of cityNames) {
    const { data, error } = await supabase
      .from("cities")
      .select("name, slug, lat, lon")
      .eq("state", "California")
      .eq("active", true)
      .eq("name", cityName)
      .not("lat", "is", null)
      .not("lon", "is", null)
      .single();
    
    if (error) {
      console.error(`Error fetching city ${cityName}:`, error);
      continue;
    }
    
    if (data) {
      cities.push(data);
    }
  }
  
  return cities;
}

async function saveNeighborhoods(neighborhoods: Partial<NeighborhoodData>[]): Promise<{success: number; failed: number}> {
  let success = 0;
  let failed = 0;
  
  // Batch insert using Supabase client directly
  const batchSize = 25;
  
  for (let i = 0; i < neighborhoods.length; i += batchSize) {
    const batch = neighborhoods.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from("neighborhood_catalog")
      .upsert(batch, { 
        onConflict: "state,city_area_slug,neighborhood_slug",
        ignoreDuplicates: false
      });
    
    if (error) {
      console.error(`Batch insert error:`, error);
      failed += batch.length;
    } else {
      success += batch.length;
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  return { success, failed };
}

// ============================================================
// MAIN PROCESSING FUNCTION (runs in background)
// ============================================================

async function processNeighborhoods(
  cities: Array<{name: string; slug: string; lat: number; lon: number}>,
  startCity: number,
  priorityCities: string[] | null
) {
  let totalNeighborhoods = 0;
  let totalSaved = 0;
  let totalFailed = 0;
  const allNeighborhoods: Partial<NeighborhoodData>[] = [];
  
  for (const city of cities) {
    console.log(`\n========================================`);
    console.log(`Processing: ${city.name}`);
    console.log(`========================================`);
    
    // Step 1: Discover neighborhoods with Gemini
    console.log("Step 1: Discovering neighborhoods with Gemini...");
    const discovered = await discoverNeighborhoods(city.name, city.lat, city.lon);
    console.log(`  Found ${discovered.length} neighborhoods (max ${MAX_NEIGHBORHOODS_PER_CITY})`);
    
    if (discovered.length === 0) {
      console.log("  Skipping - no neighborhoods found");
      continue;
    }
    
    // Step 2: Enrich with Census stats
    console.log("Step 2: Enriching with Census ACS data...");
    const enriched = await enrichWithStats(discovered, city.name, city.slug);
    console.log(`  Enriched ${enriched.length} neighborhoods with market data`);
    
    // Step 3: Generate writeups with Claude
    console.log("Step 3: Generating writeups with Claude Sonnet...");
    for (let i = 0; i < enriched.length; i++) {
      const n = enriched[i];
      console.log(`  Writing ${i + 1}/${enriched.length}: ${n.neighborhood}`);
      n.writeup_html = await generateWriteup(n);
      n.writeup_generated_at = new Date().toISOString();
      await new Promise(r => setTimeout(r, CLAUDE_RATE_LIMIT_MS)); // Rate limit Claude
    }
    
    allNeighborhoods.push(...enriched);
    totalNeighborhoods += enriched.length;
  }
  
  if (allNeighborhoods.length === 0) {
    console.log("No neighborhoods found for these cities");
    return;
  }
  
  // Step 4: Calculate nearby neighborhoods
  console.log("\n========================================");
  console.log("Step 4: Calculating nearby neighborhoods...");
  console.log("========================================");
  for (const n of allNeighborhoods) {
    n.nearby_neighborhoods = calculateNearbyNeighborhoods(n, allNeighborhoods);
  }
  
  // Step 5: Save to database
  console.log("\n========================================");
  console.log("Step 5: Saving to database...");
  console.log("========================================");
  const saveResult = await saveNeighborhoods(allNeighborhoods);
  totalSaved = saveResult.success;
  totalFailed = saveResult.failed;
  
  console.log("\n========================================");
  console.log("COMPLETE");
  console.log("========================================");
  console.log(`Cities processed: ${cities.length}`);
  console.log(`Neighborhoods created: ${totalNeighborhoods}`);
  console.log(`Saved: ${totalSaved}, Failed: ${totalFailed}`);
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Parse request body for pagination
  let startCity = 0;
  let batchSize = 5; // Process 5 cities per invocation to avoid timeout
  let priorityCities: string[] | null = null;
  
  try {
    const body = await req.json();
    startCity = body.startCity || 0;
    batchSize = body.batchSize || 5;
    priorityCities = body.priorityCities || null;
  } catch {
    // Use defaults
  }
  
  try {
    let cities: Array<{name: string; slug: string; lat: number; lon: number}>;
    
    if (priorityCities && priorityCities.length > 0) {
      // Fetch specific cities by name (one at a time to avoid "in" operator issues)
      console.log(`Processing priority cities: ${priorityCities.join(", ")}`);
      cities = await fetchPriorityCities(priorityCities);
    } else {
      console.log(`Processing California cities ${startCity} to ${startCity + batchSize - 1}...`);
      cities = await fetchCACities(batchSize, startCity);
    }
    
    if (cities.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No cities found to process",
        processed: 0,
        nextStartCity: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const nextStartCity = priorityCities ? null : startCity + batchSize;
    
    // Use EdgeRuntime.waitUntil for background processing
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(processNeighborhoods(cities, startCity, priorityCities));
      
      return new Response(JSON.stringify({
        success: true,
        message: `Started processing ${cities.length} cities: ${cities.map(c => c.name).join(", ")}`,
        citiesQueued: cities.length,
        cities: cities.map(c => c.name),
        nextStartCity,
        note: "Processing in background. Check logs for progress."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Fallback: run synchronously (may timeout for large batches)
    await processNeighborhoods(cities, startCity, priorityCities);
    
    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${cities.length} cities`,
      citiesProcessed: cities.length,
      cities: cities.map(c => c.name),
      nextStartCity
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      startCity
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
