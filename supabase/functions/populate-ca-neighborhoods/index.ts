import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Census ACS API (free, no key needed)
const CENSUS_ACS_BASE = "https://api.census.gov/data/2022/acs/acs5";

// v2 Safeguards - reduced batch size for reliability
const MAX_NEIGHBORHOODS_PER_CITY = 50;
const NEIGHBORHOODS_PER_BATCH = 3; // Reduced from 10 to prevent timeout
const CENSUS_RATE_LIMIT_MS = 150; // Reduced from 200
const CLAUDE_RATE_LIMIT_MS = 400; // Reduced from 600
const STALL_THRESHOLD_MINUTES = 20;

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

interface PipelineState {
  current_city_index: number;
  current_neighborhood_index: number;
  total_cities: number;
  cities_processed: number;
  neighborhoods_created: number;
  neighborhoods_skipped: number; // v2: track skipped neighborhoods
  errors: number;
  status: "running" | "completed" | "failed" | "stopped";
  last_city_processed: string | null;
  last_successful_neighborhood: string | null; // v2: track last successful
  current_city_name: string | null;
  current_city_neighborhoods: NeighborhoodDiscovery[] | null;
  started_at: string;
  last_update: string;
  error_message: string | null;
}

// ============================================================
// v2: DATABASE ALERT LOGGING (replaces unreliable SMTP)
// ============================================================

async function logAlert(
  severity: "info" | "warning" | "error" | "critical",
  title: string,
  message: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    const { error } = await supabase
      .from("pipeline_alerts")
      .insert({
        pipeline: "ca_neighborhood_population",
        severity,
        title,
        message,
        metadata
      });
    
    if (error) {
      console.error("Failed to log alert:", error);
    } else {
      console.log(`[ALERT ${severity.toUpperCase()}] ${title}`);
    }
  } catch (err) {
    console.error("Alert logging exception:", err);
  }
}

async function getRecentAlerts(limit: number = 10) {
  const { data, error } = await supabase
    .from("pipeline_alerts")
    .select("*")
    .eq("pipeline", "ca_neighborhood_population")
    .order("created_at", { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error("Failed to fetch alerts:", error);
    return [];
  }
  return data || [];
}

async function acknowledgeAlerts() {
  const { error } = await supabase
    .from("pipeline_alerts")
    .update({ acknowledged: true })
    .eq("pipeline", "ca_neighborhood_population")
    .eq("acknowledged", false);
  
  if (error) {
    console.error("Failed to acknowledge alerts:", error);
    return false;
  }
  return true;
}

// ============================================================
// SELF-TRIGGER: Schedule next batch
// ============================================================

async function triggerNextBatch() {
  try {
    const functionUrl = `${SUPABASE_URL}/functions/v1/populate-ca-neighborhoods`;
    
    // Fire and forget - don't await
    fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ action: "continue" })
    }).catch(err => console.error("Self-trigger fetch error:", err));
    
    console.log("Triggered next batch");
  } catch (error) {
    console.error("Failed to trigger next batch:", error);
    await logAlert("error", "Self-trigger failed", `Error: ${error}`, { error: String(error) });
  }
}

// ============================================================
// MODEL 1: GEMINI FLASH 2.5 - Neighborhood Discovery
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
        return parsed.slice(0, MAX_NEIGHBORHOODS_PER_CITY);
      }
    }
  } catch (error) {
    console.error(`Gemini discovery error for ${cityName}:`, error);
    await logAlert("error", `Gemini error for ${cityName}`, String(error), { city: cityName });
  }
  
  return [];
}

// ============================================================
// MODEL 2: CENSUS ACS API - Market Statistics
// ============================================================

async function fetchCensusDataForZip(zipCode: string): Promise<{income: number | null, homeValue: number | null}> {
  try {
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
  
  const pcts = [income_pct, value_pct].filter((p): p is number => p !== null);
  const score = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  
  let tier = "Main";
  if (score !== null) {
    if (score >= 80) tier = "Luxury";
    else if (score >= 50) tier = "Prime";
  }
  
  return { tier, income_pct, value_pct, score };
}

// ============================================================
// MODEL 3: CLAUDE SONNET - Content Writing (Arcadia-quality)
// ============================================================

async function generateWriteup(neighborhood: Partial<NeighborhoodData>): Promise<string> {
  const research = neighborhood.writeup_research ? JSON.parse(neighborhood.writeup_research) : {};
  
  const prompt = `Write a comprehensive 800-1000 word neighborhood profile for ${neighborhood.neighborhood} in ${neighborhood.city_area}, California.

CONTEXT:
- Description: ${research.description || "N/A"}
- Vibe: ${research.vibe || "N/A"}
- Features: ${(research.features || []).join(", ") || "N/A"}
- Housing types: ${(research.housingTypes || []).join(", ") || "N/A"}
- Median household income: ${neighborhood.median_income ? "$" + neighborhood.median_income.toLocaleString() : "N/A"}
- Median home value: ${neighborhood.median_home_value ? "$" + neighborhood.median_home_value.toLocaleString() : "N/A"}
- Market tier: ${neighborhood.tier || "N/A"}

FORMAT REQUIREMENTS (match Arcadia reference style):

1. OPENING: Start with a compelling intro about the neighborhood's character and location. Do NOT use "Nestled" or cliches.

2. SECTION: "Lifestyle & Amenities" with H2 tag
   - 2-3 paragraphs about recreation, dining, entertainment, nearby attractions
   - Include a bulleted list (5-6 items) of key amenities and features

3. SECTION: "Real Estate Market" with H2 tag
   - 2-3 paragraphs about housing stock, market conditions, property types
   - Reference median home value naturally
   - Discuss what makes properties here distinctive

4. SECTION: "Schools & Education" with H2 tag
   - 1-2 paragraphs about local schools and educational options
   - Mention specific school districts if known

5. SECTION: "Transportation & Connectivity" with H2 tag
   - 1 paragraph about major roads, transit options, airport access

6. SECTION: "Why Choose [Neighborhood Name]" with H2 tag
   - 2 paragraphs summarizing the appeal
   - Reference median income naturally
   - End with invitation to explore

WRITING RULES:
- Be factual and authoritative, no marketing fluff
- DO NOT use em dashes anywhere
- Use proper HTML: <h2>, <p>, <ul>, <li> tags
- Write in present tense
- Include specific details where known
- Reference actual landmarks, streets, nearby areas when possible

Respond with ONLY the HTML content, no markdown code blocks:`;

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
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    
    if (text.includes("<h2>") || text.includes("<p>")) {
      return text.trim();
    }
    
    return `<p>${text.trim()}</p>`;
  } catch (error) {
    console.error(`Claude writeup error for ${neighborhood.neighborhood}:`, error);
    await logAlert("warning", `Claude error for ${neighborhood.neighborhood}`, String(error), { 
      city: neighborhood.city_area,
      neighborhood: neighborhood.neighborhood 
    });
    return `<p>${neighborhood.neighborhood} is a neighborhood in ${neighborhood.city_area}, California.</p>`;
  }
}

// ============================================================
// NEARBY NEIGHBORHOODS CALCULATION
// ============================================================

function calculateNearbyNeighborhoods(
  current: Partial<NeighborhoodData>,
  allNeighborhoods: Partial<NeighborhoodData>[],
  maxDistance: number = 5
): string[] {
  if (!current.lat || !current.lon) return [];
  
  const nearby: Array<{slug: string; distance: number}> = [];
  
  for (const n of allNeighborhoods) {
    if (n.neighborhood_slug === current.neighborhood_slug) continue;
    if (!n.lat || !n.lon) continue;
    
    const R = 3959;
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
  
  return nearby
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10)
    .map(n => n.slug);
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

async function fetchAllCACities(): Promise<Array<{name: string; slug: string; lat: number; lon: number}>> {
  const allCities: Array<{name: string; slug: string; lat: number; lon: number}> = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from("cities")
      .select("name, slug, lat, lon")
      .eq("state", "California")
      .eq("active", true)
      .not("lat", "is", null)
      .not("lon", "is", null)
      .order("name")
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error("Error fetching cities:", error);
      break;
    }
    
    if (data && data.length > 0) {
      allCities.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`Fetched ${allCities.length} California cities (paginated)`);
  return allCities;
}

async function getPipelineState(): Promise<PipelineState | null> {
  const { data, error } = await supabase
    .from("cron_state")
    .select("*")
    .eq("job_name", "ca_neighborhood_population")
    .single();
  
  if (error || !data) return null;
  
  try {
    return JSON.parse(data.message || "{}") as PipelineState;
  } catch {
    return null;
  }
}

async function updatePipelineState(state: PipelineState) {
  state.last_update = new Date().toISOString();
  
  const { error } = await supabase
    .from("cron_state")
    .upsert({
      job_name: "ca_neighborhood_population",
      is_running: state.status === "running",
      status: state.status,
      message: JSON.stringify(state),
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "job_name" });
  
  if (error) {
    console.error("Error updating pipeline state:", error);
  }
}

async function saveNeighborhood(neighborhood: Partial<NeighborhoodData>): Promise<boolean> {
  const { error } = await supabase
    .from("neighborhood_catalog")
    .upsert(neighborhood, { 
      onConflict: "state,city_area_slug,neighborhood_slug",
      ignoreDuplicates: false
    });
  
  if (error) {
    console.error(`Insert error for ${neighborhood.neighborhood}:`, error);
    return false;
  }
  return true;
}

// ============================================================
// v2: PROCESS SINGLE NEIGHBORHOOD (with per-neighborhood error handling)
// ============================================================

async function processSingleNeighborhood(
  discovery: NeighborhoodDiscovery,
  cityName: string,
  citySlug: string,
  allStats: Array<{income: number | null, homeValue: number | null}>
): Promise<{ success: boolean; neighborhood: Partial<NeighborhoodData> | null; error?: string }> {
  try {
    // Fetch census data
    const censusData = await fetchCensusDataForZip(discovery.primaryZip);
    await new Promise(r => setTimeout(r, CENSUS_RATE_LIMIT_MS));
    
    // Calculate tier
    const tierData = calculateTier(censusData.income, censusData.homeValue, allStats);
    
    // Build partial neighborhood
    const partial: Partial<NeighborhoodData> = {
      state: "California",
      city_area: cityName,
      city_area_slug: citySlug,
      neighborhood: discovery.name,
      neighborhood_slug: discovery.slug,
      zips: discovery.zipCodes,
      primary_zip: discovery.primaryZip,
      lat: discovery.lat,
      lon: discovery.lon,
      median_income: censusData.income,
      median_home_value: censusData.homeValue,
      tier: tierData.tier,
      income_pct: tierData.income_pct,
      value_pct: tierData.value_pct,
      score: tierData.score,
      is_verified: false,
      is_active: true,
      writeup_research: JSON.stringify({
        description: discovery.description,
        features: discovery.features,
        housingTypes: discovery.housingTypes,
        vibe: discovery.vibe
      }),
      nearby_neighborhoods: []
    };
    
    // Generate writeup
    const writeup = await generateWriteup(partial);
    await new Promise(r => setTimeout(r, CLAUDE_RATE_LIMIT_MS));
    
    partial.writeup_html = writeup;
    partial.writeup_generated_at = new Date().toISOString();
    
    // Save to database
    const saved = await saveNeighborhood(partial);
    
    if (!saved) {
      return { success: false, neighborhood: null, error: "Database save failed" };
    }
    
    return { success: true, neighborhood: partial };
  } catch (error) {
    return { success: false, neighborhood: null, error: String(error) };
  }
}

// ============================================================
// MAIN BATCH PROCESSING
// ============================================================

async function processBatch(state: PipelineState, cities: Array<{name: string; slug: string; lat: number; lon: number}>): Promise<{done: boolean; message: string}> {
  let neighborhoodsProcessedThisBatch = 0;
  
  // v2: Validate API keys at startup
  if (!GEMINI_API_KEY) {
    await logAlert("critical", "Missing GEMINI_API_KEY", "Cannot discover neighborhoods without Gemini API key");
    state.status = "failed";
    state.error_message = "Missing GEMINI_API_KEY";
    await updatePipelineState(state);
    return { done: true, message: "Missing GEMINI_API_KEY" };
  }
  
  if (!ANTHROPIC_API_KEY) {
    await logAlert("critical", "Missing ANTHROPIC_API_KEY", "Cannot generate writeups without Anthropic API key");
    state.status = "failed";
    state.error_message = "Missing ANTHROPIC_API_KEY";
    await updatePipelineState(state);
    return { done: true, message: "Missing ANTHROPIC_API_KEY" };
  }
  
  while (state.current_city_index < cities.length) {
    const city = cities[state.current_city_index];
    
    // If we don't have neighborhoods for this city, discover them
    if (!state.current_city_neighborhoods) {
      console.log(`Discovering neighborhoods for ${city.name}...`);
      const discoveries = await discoverNeighborhoods(city.name, city.lat!, city.lon!);
      
      if (discoveries.length === 0) {
        console.log(`No neighborhoods found for ${city.name}, moving to next city`);
        state.neighborhoods_skipped = (state.neighborhoods_skipped || 0) + 1;
        state.last_city_processed = city.name;
        state.current_city_index++;
        state.current_neighborhood_index = 0;
        state.current_city_neighborhoods = null;
        state.current_city_name = null;
        state.cities_processed++;
        await updatePipelineState(state);
        continue;
      }
      
      state.current_city_neighborhoods = discoveries;
      state.current_city_name = city.name;
      state.current_neighborhood_index = 0;
      await updatePipelineState(state);
      console.log(`Found ${discoveries.length} neighborhoods for ${city.name}`);
    }
    
    // Process neighborhoods in this city
    const neighborhoods = state.current_city_neighborhoods!;
    
    // Collect census stats for tier calculation (do once per city)
    const allStats: Array<{income: number | null, homeValue: number | null}> = [];
    for (const n of neighborhoods) {
      const stats = await fetchCensusDataForZip(n.primaryZip);
      allStats.push(stats);
      await new Promise(r => setTimeout(r, CENSUS_RATE_LIMIT_MS));
    }
    
    while (state.current_neighborhood_index < neighborhoods.length) {
      if (neighborhoodsProcessedThisBatch >= NEIGHBORHOODS_PER_BATCH) {
        // Time to yield and self-trigger
        console.log(`Batch complete: ${neighborhoodsProcessedThisBatch} neighborhoods. Triggering next batch...`);
        await updatePipelineState(state);
        await triggerNextBatch();
        return { 
          done: false, 
          message: `Processed ${neighborhoodsProcessedThisBatch} neighborhoods in ${city.name}. Progress: ${state.current_city_index}/${state.total_cities} cities, ${state.neighborhoods_created} neighborhoods` 
        };
      }
      
      const discovery = neighborhoods[state.current_neighborhood_index];
      console.log(`Processing ${discovery.name} (${state.current_neighborhood_index + 1}/${neighborhoods.length}) in ${city.name}`);
      
      // v2: Per-neighborhood try/catch
      const result = await processSingleNeighborhood(discovery, city.name, city.slug, allStats);
      
      if (result.success) {
        state.neighborhoods_created++;
        state.last_successful_neighborhood = `${discovery.name}, ${city.name}`;
        console.log(`✓ Created ${discovery.name}`);
      } else {
        state.errors++;
        await logAlert("error", `Failed: ${discovery.name}`, result.error || "Unknown error", {
          city: city.name,
          neighborhood: discovery.name,
          index: state.current_neighborhood_index
        });
        console.error(`✗ Failed ${discovery.name}: ${result.error}`);
      }
      
      state.current_neighborhood_index++;
      neighborhoodsProcessedThisBatch++;
      
      // v2: Save state after EACH neighborhood (crash recovery)
      await updatePipelineState(state);
    }
    
    // City complete
    state.last_city_processed = city.name;
    state.cities_processed++;
    state.current_city_index++;
    state.current_neighborhood_index = 0;
    state.current_city_neighborhoods = null;
    state.current_city_name = null;
    await updatePipelineState(state);
    
    // Log progress every 10 cities
    if (state.cities_processed % 10 === 0) {
      await logAlert("info", `Progress: ${state.cities_processed}/${state.total_cities} cities`, 
        `Created ${state.neighborhoods_created}, skipped ${state.neighborhoods_skipped || 0}, errors: ${state.errors}`,
        { cities_processed: state.cities_processed, neighborhoods_created: state.neighborhoods_created }
      );
    }
  }
  
  // All cities complete
  state.status = "completed";
  await updatePipelineState(state);
  await logAlert("info", "Pipeline complete", 
    `Processed ${state.cities_processed} cities, created ${state.neighborhoods_created} neighborhoods, ${state.errors} errors`,
    { final_stats: state }
  );
  
  return { 
    done: true, 
    message: `Complete! ${state.cities_processed} cities, ${state.neighborhoods_created} neighborhoods, ${state.errors} errors` 
  };
}

// ============================================================
// REQUEST HANDLERS
// ============================================================

async function handleStatus(): Promise<Response> {
  const state = await getPipelineState();
  const alerts = await getRecentAlerts(10);
  
  return new Response(JSON.stringify({
    success: true,
    state: state || { status: "not_started" },
    recent_alerts: alerts
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleReset(): Promise<Response> {
  const cities = await fetchAllCACities();
  
  const newState: PipelineState = {
    current_city_index: 0,
    current_neighborhood_index: 0,
    total_cities: cities.length,
    cities_processed: 0,
    neighborhoods_created: 0,
    neighborhoods_skipped: 0,
    errors: 0,
    status: "running",
    last_city_processed: null,
    last_successful_neighborhood: null,
    current_city_name: null,
    current_city_neighborhoods: null,
    started_at: new Date().toISOString(),
    last_update: new Date().toISOString(),
    error_message: null
  };
  
  await updatePipelineState(newState);
  await logAlert("info", "Pipeline reset and started", `Starting fresh with ${cities.length} cities`);
  
  // Start processing
  const result = await processBatch(newState, cities);
  
  return new Response(JSON.stringify({
    success: true,
    message: "Pipeline reset and started",
    result
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleStop(): Promise<Response> {
  const state = await getPipelineState();
  if (state) {
    state.status = "stopped";
    state.error_message = "Manually stopped";
    await updatePipelineState(state);
    await logAlert("warning", "Pipeline stopped", "Manually stopped by user");
  }
  
  return new Response(JSON.stringify({
    success: true,
    message: "Pipeline stopped"
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleContinue(): Promise<Response> {
  const state = await getPipelineState();
  
  if (!state) {
    return new Response(JSON.stringify({
      success: false,
      message: "No pipeline state found. Use 'reset' to start fresh."
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  if (state.status === "completed") {
    return new Response(JSON.stringify({
      success: true,
      message: "Pipeline already completed",
      state
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  if (state.status === "stopped" || state.status === "failed") {
    state.status = "running";
    await updatePipelineState(state);
  }
  
  const cities = await fetchAllCACities();
  // Update total_cities in case it changed
  state.total_cities = cities.length;
  
  const result = await processBatch(state, cities);
  
  return new Response(JSON.stringify({
    success: true,
    result
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleWatchdog(): Promise<Response> {
  const state = await getPipelineState();
  
  if (!state) {
    return new Response(JSON.stringify({
      success: true,
      stalled: false,
      message: "No pipeline running"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  if (state.status !== "running") {
    return new Response(JSON.stringify({
      success: true,
      stalled: false,
      message: `Pipeline status: ${state.status}`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  const lastUpdate = new Date(state.last_update).getTime();
  const now = Date.now();
  const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);
  
  if (minutesSinceUpdate > STALL_THRESHOLD_MINUTES) {
    await logAlert("critical", "Pipeline stalled", 
      `No update for ${Math.round(minutesSinceUpdate)} minutes. Last city: ${state.current_city_name || "unknown"}`,
      { minutes_since_update: minutesSinceUpdate, last_state: state }
    );
    
    state.status = "failed";
    state.error_message = `Stalled for ${Math.round(minutesSinceUpdate)} minutes`;
    await updatePipelineState(state);
    
    return new Response(JSON.stringify({
      success: true,
      stalled: true,
      message: `Pipeline stalled for ${Math.round(minutesSinceUpdate)} minutes. Marked as failed.`,
      state
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    stalled: false,
    message: `Pipeline running. Last update ${Math.round(minutesSinceUpdate)} minutes ago.`,
    state
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleAlerts(): Promise<Response> {
  const { data, error } = await supabase
    .from("pipeline_alerts")
    .select("*")
    .eq("pipeline", "ca_neighborhood_population")
    .eq("acknowledged", false)
    .order("created_at", { ascending: false });
  
  return new Response(JSON.stringify({
    success: !error,
    alerts: data || [],
    error: error?.message
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleAcknowledgeAlerts(): Promise<Response> {
  const success = await acknowledgeAlerts();
  
  return new Response(JSON.stringify({
    success,
    message: success ? "All alerts acknowledged" : "Failed to acknowledge alerts"
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "continue";

    console.log(`CA Neighborhoods v2 - Action: ${action}`);

    switch (action) {
      case "status":
        return await handleStatus();
      case "reset":
        return await handleReset();
      case "stop":
        return await handleStop();
      case "continue":
        return await handleContinue();
      case "watchdog":
        return await handleWatchdog();
      case "alerts":
        return await handleAlerts();
      case "acknowledge-alerts":
        return await handleAcknowledgeAlerts();
      default:
        return new Response(JSON.stringify({
          success: false,
          message: `Unknown action: ${action}. Valid actions: status, reset, stop, continue, watchdog, alerts, acknowledge-alerts`
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
  } catch (error) {
    console.error("Handler error:", error);
    await logAlert("critical", "Handler exception", String(error));
    
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
