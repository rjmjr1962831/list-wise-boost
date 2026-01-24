import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "robert@top10lists.us";

// SMTP Config
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL") || "hello@top10lists.us";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Census ACS API (free, no key needed)
const CENSUS_ACS_BASE = "https://api.census.gov/data/2022/acs/acs5";

// Safeguards
const MAX_NEIGHBORHOODS_PER_CITY = 50;
const NEIGHBORHOODS_PER_BATCH = 10; // Process 10 neighborhoods at a time
const CENSUS_RATE_LIMIT_MS = 200;
const CLAUDE_RATE_LIMIT_MS = 600;
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
  current_neighborhood_index: number; // Track within city
  total_cities: number;
  cities_processed: number;
  neighborhoods_created: number;
  errors: number;
  status: "running" | "completed" | "failed" | "stopped";
  last_city_processed: string | null;
  current_city_name: string | null;
  current_city_neighborhoods: NeighborhoodDiscovery[] | null; // Cache discovered neighborhoods
  started_at: string;
  last_update: string;
  error_message: string | null;
}

// ============================================================
// EMAIL ALERT FUNCTION
// ============================================================

async function sendAlertEmail(subject: string, body: string) {
  try {
    if (!SMTP_USERNAME || !SMTP_PASSWORD) {
      console.error("SMTP credentials not configured, cannot send alert email");
      return;
    }
    
    const client = new SMTPClient({
      connection: {
        hostname: "mx1.privateemail.com",
        port: 465,
        tls: true,
        auth: {
          username: SMTP_USERNAME,
          password: SMTP_PASSWORD,
        },
      },
    });

    await client.send({
      from: SMTP_FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: subject,
      content: body,
      html: body.replace(/\n/g, "<br>"),
    });

    await client.close();
    console.log("Alert email sent successfully");
  } catch (error) {
    console.error("Failed to send alert email:", error);
  }
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

async function saveNeighborhoods(neighborhoods: Partial<NeighborhoodData>[]): Promise<{success: number; failed: number}> {
  let success = 0;
  let failed = 0;
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
// PROCESS ONE BATCH OF NEIGHBORHOODS (up to 10)
// ============================================================

async function processNextBatch(): Promise<{done: boolean; message: string}> {
  const allCities = await fetchAllCACities();
  
  if (allCities.length === 0) {
    return { done: true, message: "No California cities found" };
  }
  
  let state = await getPipelineState();
  
  // Initialize if not exists or completed/failed
  if (!state || state.status === "completed" || state.status === "failed" || state.status === "stopped") {
    state = {
      current_city_index: 0,
      current_neighborhood_index: 0,
      total_cities: allCities.length,
      cities_processed: 0,
      neighborhoods_created: 0,
      errors: 0,
      status: "running",
      last_city_processed: null,
      current_city_name: null,
      current_city_neighborhoods: null,
      started_at: new Date().toISOString(),
      last_update: new Date().toISOString(),
      error_message: null
    };
    await updatePipelineState(state);
    console.log("Started new pipeline run");
  }
  
  // Update total_cities in case it changed
  if (state.total_cities !== allCities.length) {
    state.total_cities = allCities.length;
  }
  
  // Check if we're done
  if (state.current_city_index >= allCities.length) {
    state.status = "completed";
    state.last_update = new Date().toISOString();
    await updatePipelineState(state);
    
    await sendAlertEmail(
      `✅ CA Neighborhoods: Pipeline Complete`,
      `The California neighborhood population pipeline has completed successfully.\n\nSummary:\n- Cities processed: ${state.cities_processed}\n- Neighborhoods created: ${state.neighborhoods_created}\n- Errors: ${state.errors}\n- Started: ${state.started_at}\n- Completed: ${new Date().toISOString()}`
    );
    
    return { done: true, message: "Pipeline completed!" };
  }
  
  const city = allCities[state.current_city_index];
  console.log(`\n[${state.current_city_index + 1}/${allCities.length}] ${city.name}`);
  
  try {
    // Step 1: Discover neighborhoods if we haven't for this city
    let neighborhoods = state.current_city_neighborhoods;
    
    if (!neighborhoods || state.current_city_name !== city.name) {
      console.log("  Discovering neighborhoods with Gemini...");
      neighborhoods = await discoverNeighborhoods(city.name, city.lat, city.lon);
      state.current_city_name = city.name;
      state.current_city_neighborhoods = neighborhoods;
      state.current_neighborhood_index = 0;
      console.log(`  Found ${neighborhoods.length} neighborhoods`);
      
      // If no neighborhoods, move to next city
      if (neighborhoods.length === 0) {
        state.current_city_index++;
        state.cities_processed++;
        state.last_city_processed = city.name;
        state.current_city_neighborhoods = null;
        state.current_city_name = null;
        state.last_update = new Date().toISOString();
        await updatePipelineState(state);
        return { done: false, message: `${city.name}: No neighborhoods, moving to next city` };
      }
    }
    
    // Step 2: Process up to NEIGHBORHOODS_PER_BATCH neighborhoods
    const startIdx = state.current_neighborhood_index;
    const endIdx = Math.min(startIdx + NEIGHBORHOODS_PER_BATCH, neighborhoods.length);
    const batchNeighborhoods = neighborhoods.slice(startIdx, endIdx);
    
    console.log(`  Processing neighborhoods ${startIdx + 1}-${endIdx} of ${neighborhoods.length}`);
    
    // Collect unique ZIP codes for this batch
    const batchZips = new Set<string>();
    for (const n of batchNeighborhoods) {
      n.zipCodes.forEach(z => batchZips.add(z));
    }
    
    // Fetch Census data for batch ZIPs
    console.log(`  Fetching Census data for ${batchZips.size} ZIPs...`);
    const zipStats = new Map<string, {income: number | null, homeValue: number | null}>();
    for (const zip of batchZips) {
      const stats = await fetchCensusDataForZip(zip);
      zipStats.set(zip, stats);
      await new Promise(r => setTimeout(r, CENSUS_RATE_LIMIT_MS));
    }
    
    const allStats = Array.from(zipStats.values());
    const enrichedBatch: Partial<NeighborhoodData>[] = [];
    
    // Enrich each neighborhood in batch
    for (const n of batchNeighborhoods) {
      const primaryStats = zipStats.get(n.primaryZip) || { income: null, homeValue: null };
      const tierData = calculateTier(primaryStats.income, primaryStats.homeValue, allStats);
      
      const enriched: Partial<NeighborhoodData> = {
        state: "CA",
        city_area: city.name,
        city_area_slug: city.slug,
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
      };
      
      // Generate writeup
      console.log(`    Writing: ${n.name}`);
      enriched.writeup_html = await generateWriteup(enriched);
      enriched.writeup_generated_at = new Date().toISOString();
      await new Promise(r => setTimeout(r, CLAUDE_RATE_LIMIT_MS));
      
      // Calculate nearby (within batch only for now, will update later)
      enriched.nearby_neighborhoods = [];
      
      enrichedBatch.push(enriched);
    }
    
    // Save batch to database
    console.log(`  Saving ${enrichedBatch.length} neighborhoods...`);
    const saveResult = await saveNeighborhoods(enrichedBatch);
    
    // Update state
    state.current_neighborhood_index = endIdx;
    state.neighborhoods_created += saveResult.success;
    state.errors += saveResult.failed;
    state.last_update = new Date().toISOString();
    
    // Check if we finished this city
    if (endIdx >= neighborhoods.length) {
      state.current_city_index++;
      state.cities_processed++;
      state.last_city_processed = city.name;
      state.current_city_neighborhoods = null;
      state.current_city_name = null;
      state.current_neighborhood_index = 0;
      console.log(`  Completed ${city.name}!`);
    }
    
    await updatePipelineState(state);
    
    const progress = `${state.cities_processed}/${allCities.length} cities, ${state.neighborhoods_created} neighborhoods`;
    return { 
      done: false, 
      message: `Processed ${batchNeighborhoods.length} neighborhoods in ${city.name}. Progress: ${progress}` 
    };
    
  } catch (error) {
    console.error(`Error processing ${city.name}:`, error);
    
    state.errors++;
    state.error_message = `Error on ${city.name}: ${error instanceof Error ? error.message : String(error)}`;
    state.last_update = new Date().toISOString();
    
    // Skip to next city on error
    state.current_city_index++;
    state.current_city_neighborhoods = null;
    state.current_city_name = null;
    state.current_neighborhood_index = 0;
    
    await updatePipelineState(state);
    
    await sendAlertEmail(
      `⚠️ CA Neighborhoods: Error on ${city.name}`,
      `The pipeline encountered an error and will continue with the next city.\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nProgress: ${state.cities_processed}/${allCities.length} cities`
    );
    
    return { done: false, message: `Error on ${city.name}, moving to next` };
  }
}

// ============================================================
// WATCHDOG: Check for stalled pipeline
// ============================================================

async function checkForStall(): Promise<boolean> {
  const state = await getPipelineState();
  
  if (!state || state.status !== "running") {
    return false;
  }
  
  const lastUpdate = new Date(state.last_update);
  const now = new Date();
  const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  
  if (minutesSinceUpdate > STALL_THRESHOLD_MINUTES) {
    console.log(`Pipeline stalled! Last update ${minutesSinceUpdate.toFixed(1)} minutes ago`);
    
    state.status = "failed";
    state.error_message = `Pipeline stalled for ${minutesSinceUpdate.toFixed(0)} minutes`;
    state.last_update = new Date().toISOString();
    await updatePipelineState(state);
    
    await sendAlertEmail(
      `🚨 CA Neighborhoods: Pipeline STALLED`,
      `The California neighborhood population pipeline has stalled and been marked as failed.\n\nLast activity: ${minutesSinceUpdate.toFixed(0)} minutes ago\nLast city: ${state.last_city_processed || "Unknown"}\nProgress: ${state.cities_processed}/${state.total_cities} cities\nNeighborhoods created: ${state.neighborhoods_created}\n\nPlease restart the pipeline to continue.`
    );
    
    return true;
  }
  
  return false;
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
    const action = body.action || "start";
    
    // Status check
    if (action === "status") {
      const state = await getPipelineState();
      return new Response(JSON.stringify({
        success: true,
        state: state || { status: "not_started" }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Stop pipeline
    if (action === "stop") {
      const state = await getPipelineState();
      if (state) {
        state.status = "stopped";
        state.last_update = new Date().toISOString();
        await updatePipelineState(state);
      }
      return new Response(JSON.stringify({
        success: true,
        message: "Pipeline stopped"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Watchdog check
    if (action === "watchdog") {
      const stalled = await checkForStall();
      return new Response(JSON.stringify({
        success: true,
        stalled,
        message: stalled ? "Pipeline was stalled, marked as failed" : "Pipeline is healthy"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Reset pipeline (start fresh)
    if (action === "reset") {
      const state: PipelineState = {
        current_city_index: 0,
        current_neighborhood_index: 0,
        total_cities: 0,
        cities_processed: 0,
        neighborhoods_created: 0,
        errors: 0,
        status: "running",
        last_city_processed: null,
        current_city_name: null,
        current_city_neighborhoods: null,
        started_at: new Date().toISOString(),
        last_update: new Date().toISOString(),
        error_message: null
      };
      await updatePipelineState(state);
      
      // Continue with processing
      const result = await processNextBatch();
      
      if (!result.done) {
        triggerNextBatch();
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: "Pipeline reset and started",
        result
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Continue or start processing
    const result = await processNextBatch();
    
    if (!result.done) {
      // Trigger next batch
      triggerNextBatch();
    }
    
    return new Response(JSON.stringify({
      success: true,
      done: result.done,
      message: result.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error:", error);
    
    // Try to send alert on fatal error
    await sendAlertEmail(
      `🚨 CA Neighborhoods: Fatal Error`,
      `The pipeline encountered a fatal error.\n\nError: ${error instanceof Error ? error.message : String(error)}`
    );
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
