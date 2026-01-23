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
const CENSUS_RATE_LIMIT_MS = 200;
const CLAUDE_RATE_LIMIT_MS = 600;

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
  total_cities: number;
  cities_processed: number;
  neighborhoods_created: number;
  errors: number;
  status: "running" | "completed" | "failed" | "stopped";
  last_city_processed: string | null;
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

async function enrichWithStats(
  neighborhoods: NeighborhoodDiscovery[],
  cityName: string,
  citySlug: string
): Promise<Partial<NeighborhoodData>[]> {
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
    await new Promise(r => setTimeout(r, CENSUS_RATE_LIMIT_MS));
  }
  
  console.log(`  Census data: ${allZips.size - censusErrors} success, ${censusErrors} no data`);
  
  const allStats = Array.from(zipStats.values());
  const enriched: Partial<NeighborhoodData>[] = [];
  
  for (const n of neighborhoods) {
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
// MAIN PROCESSING FUNCTION (background)
// ============================================================

async function processAllCities() {
  let state: PipelineState;
  
  try {
    // Get all California cities
    const allCities = await fetchAllCACities();
    
    if (allCities.length === 0) {
      console.log("No California cities found");
      return;
    }
    
    // Check for existing pipeline state
    const existingState = await getPipelineState();
    
    if (existingState && existingState.status === "running") {
      // Resume from where we left off
      state = existingState;
      console.log(`Resuming from city index ${state.current_city_index}`);
    } else {
      // Start fresh
      state = {
        current_city_index: 0,
        total_cities: allCities.length,
        cities_processed: 0,
        neighborhoods_created: 0,
        errors: 0,
        status: "running",
        last_city_processed: null,
        started_at: new Date().toISOString(),
        last_update: new Date().toISOString(),
        error_message: null
      };
      await updatePipelineState(state);
    }
    
    console.log(`\n========================================`);
    console.log(`CA NEIGHBORHOOD POPULATION PIPELINE`);
    console.log(`Total cities: ${allCities.length}`);
    console.log(`Starting from: ${state.current_city_index}`);
    console.log(`========================================\n`);
    
    // Process cities one at a time
    for (let i = state.current_city_index; i < allCities.length; i++) {
      const city = allCities[i];
      
      try {
        console.log(`\n[${i + 1}/${allCities.length}] Processing: ${city.name}`);
        console.log("----------------------------------------");
        
        // Step 1: Discover neighborhoods
        console.log("Step 1: Gemini discovery...");
        const discovered = await discoverNeighborhoods(city.name, city.lat, city.lon);
        console.log(`  Found ${discovered.length} neighborhoods`);
        
        if (discovered.length === 0) {
          console.log("  Skipping - no neighborhoods");
          state.current_city_index = i + 1;
          state.cities_processed++;
          state.last_city_processed = city.name;
          state.last_update = new Date().toISOString();
          await updatePipelineState(state);
          continue;
        }
        
        // Step 2: Enrich with Census data
        console.log("Step 2: Census enrichment...");
        const enriched = await enrichWithStats(discovered, city.name, city.slug);
        
        // Step 3: Generate writeups with Claude
        console.log("Step 3: Claude writeups...");
        for (let j = 0; j < enriched.length; j++) {
          const n = enriched[j];
          console.log(`  [${j + 1}/${enriched.length}] ${n.neighborhood}`);
          n.writeup_html = await generateWriteup(n);
          n.writeup_generated_at = new Date().toISOString();
          await new Promise(r => setTimeout(r, CLAUDE_RATE_LIMIT_MS));
        }
        
        // Step 4: Calculate nearby neighborhoods (within this city)
        for (const n of enriched) {
          n.nearby_neighborhoods = calculateNearbyNeighborhoods(n, enriched);
        }
        
        // Step 5: Save to database
        console.log("Step 4: Saving to database...");
        const saveResult = await saveNeighborhoods(enriched);
        console.log(`  Saved: ${saveResult.success}, Failed: ${saveResult.failed}`);
        
        // Update state
        state.current_city_index = i + 1;
        state.cities_processed++;
        state.neighborhoods_created += saveResult.success;
        state.errors += saveResult.failed;
        state.last_city_processed = city.name;
        state.last_update = new Date().toISOString();
        await updatePipelineState(state);
        
        // Brief pause between cities
        await new Promise(r => setTimeout(r, 1000));
        
      } catch (cityError) {
        console.error(`Error processing ${city.name}:`, cityError);
        state.errors++;
        state.error_message = `Error on ${city.name}: ${cityError instanceof Error ? cityError.message : String(cityError)}`;
        state.last_update = new Date().toISOString();
        await updatePipelineState(state);
        
        // Send alert but continue
        await sendAlertEmail(
          `⚠️ CA Neighborhoods: Error on ${city.name}`,
          `The California neighborhood population pipeline encountered an error on ${city.name}.\n\nError: ${cityError instanceof Error ? cityError.message : String(cityError)}\n\nThe pipeline will continue with the next city.\n\nProgress: ${state.cities_processed}/${allCities.length} cities processed\nNeighborhoods created: ${state.neighborhoods_created}`
        );
        
        // Continue to next city
        state.current_city_index = i + 1;
        await updatePipelineState(state);
        continue;
      }
    }
    
    // Pipeline complete
    state.status = "completed";
    state.last_update = new Date().toISOString();
    await updatePipelineState(state);
    
    console.log(`\n========================================`);
    console.log(`PIPELINE COMPLETE`);
    console.log(`Cities processed: ${state.cities_processed}`);
    console.log(`Neighborhoods created: ${state.neighborhoods_created}`);
    console.log(`Errors: ${state.errors}`);
    console.log(`========================================\n`);
    
    // Send completion email
    await sendAlertEmail(
      `✅ CA Neighborhoods: Pipeline Complete`,
      `The California neighborhood population pipeline has completed successfully.\n\nSummary:\n- Cities processed: ${state.cities_processed}\n- Neighborhoods created: ${state.neighborhoods_created}\n- Errors: ${state.errors}\n- Started: ${state.started_at}\n- Completed: ${new Date().toISOString()}`
    );
    
  } catch (error) {
    console.error("Fatal pipeline error:", error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update state to failed
    const currentState = await getPipelineState();
    if (currentState) {
      currentState.status = "failed";
      currentState.error_message = errorMessage;
      currentState.last_update = new Date().toISOString();
      await updatePipelineState(currentState);
    }
    
    // Send failure alert
    await sendAlertEmail(
      `🚨 CA Neighborhoods: Pipeline FAILED`,
      `The California neighborhood population pipeline has STOPPED due to a fatal error.\n\nError: ${errorMessage}\n\nLast state:\n${currentState ? JSON.stringify(currentState, null, 2) : "Unknown"}\n\nPlease investigate and restart if needed.`
    );
  }
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
    
    if (action === "status") {
      // Return current pipeline status
      const state = await getPipelineState();
      return new Response(JSON.stringify({
        success: true,
        state: state || { status: "not_started" }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    if (action === "stop") {
      // Stop the pipeline
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
    
    // Default: start/resume pipeline
    const allCities = await fetchAllCACities();
    const existingState = await getPipelineState();
    
    // Use EdgeRuntime.waitUntil for background processing
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(processAllCities());
      
      return new Response(JSON.stringify({
        success: true,
        message: existingState?.status === "running" 
          ? `Resuming pipeline from city ${existingState.current_city_index + 1}`
          : `Starting pipeline for ${allCities.length} California cities`,
        totalCities: allCities.length,
        currentIndex: existingState?.current_city_index || 0,
        note: "Processing in background. Check logs for progress. Email alert on completion or failure."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Fallback: run synchronously (will likely timeout)
    await processAllCities();
    
    return new Response(JSON.stringify({
      success: true,
      message: "Pipeline completed"
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
