import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// State abbreviations
const stateAbbreviations: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
};

// Zillow Agent Schema for Firecrawl
const ZILLOW_AGENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    photoUrl: { type: "string" },
    zillowRating: { type: "number" },
    reviewCount: { type: "number" },
    totalSales: { type: "number" },
    salesLast12Months: { type: "number" },
    currentListings: { type: "number" },
    yearsExperience: { type: "number" },
    licenseNumber: { type: "string" },
    brokerageName: { type: "string" },
    brokerageAddress: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    website: { type: "string" },
    serviceAreas: { type: "array", items: { type: "string" } },
    specialties: { type: "array", items: { type: "string" } },
    avgListPrice: { type: "string" },
    priceRange: { type: "string" },
  },
  required: ["name"]
};

interface AgentToProcess {
  id: string;
  name: string;
  profileUrl: string;
  rating: number;
  isNew: boolean;
}

interface ProcessingResult {
  id: string;
  name: string;
  profileUrl: string;
  firecrawl: 'success' | 'failed' | 'skipped';
  search: 'success' | 'failed' | 'skipped';
  synthesis: 'success' | 'failed' | 'skipped';
  error?: string;
}

// Process a single agent through Firecrawl + Search + Synthesis
async function processAgent(
  agent: AgentToProcess,
  supabaseUrl: string,
  supabaseKey: string,
  firecrawlApiKey: string,
  cityName: string,
  stateName: string
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    id: agent.id,
    name: agent.name,
    profileUrl: agent.profileUrl,
    firecrawl: 'skipped',
    search: 'skipped',
    synthesis: 'skipped'
  };

  try {
    // Run Firecrawl and Search in PARALLEL
    const [firecrawlResult, searchResult] = await Promise.allSettled([
      // Firecrawl enrichment
      fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: agent.profileUrl,
          formats: ['extract'],
          extract: { schema: ZILLOW_AGENT_SCHEMA },
          onlyMainContent: true,
          timeout: 30000,
        }),
      }),
      // Web search for press mentions
      fetch(`${supabaseUrl}/functions/v1/search-agent-press-gemini`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentName: agent.name,
          city: cityName,
          state: stateName,
          zillowUrl: agent.profileUrl,
          professionalId: agent.id,
          dryRun: false
        }),
      })
    ]);

    // Handle Firecrawl result
    let firecrawlData: any = null;
    if (firecrawlResult.status === 'fulfilled' && firecrawlResult.value.ok) {
      const fcData = await firecrawlResult.value.json();
      firecrawlData = fcData.data?.extract || fcData.extract || fcData.data;
      result.firecrawl = 'success';
    } else {
      result.firecrawl = 'failed';
      console.error(`Firecrawl failed for ${agent.name}`);
    }

    // Handle Search result
    if (searchResult.status === 'fulfilled' && searchResult.value.ok) {
      result.search = 'success';
    } else {
      result.search = 'failed';
      console.error(`Search failed for ${agent.name}`);
    }

    // Update database with Firecrawl data
    if (firecrawlData) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const updateData: Record<string, any> = {
        zillow_data_fetched_at: new Date().toISOString(),
      };

      if (firecrawlData.zillowRating) updateData.review_stars_rating = firecrawlData.zillowRating;
      if (firecrawlData.reviewCount) updateData.num_total_reviews = firecrawlData.reviewCount;
      if (firecrawlData.totalSales) updateData.total_sales = firecrawlData.totalSales;
      if (firecrawlData.currentListings) updateData.current_listings = firecrawlData.currentListings;
      if (firecrawlData.yearsExperience) updateData.years_experience = firecrawlData.yearsExperience;
      if (firecrawlData.licenseNumber) updateData.license_number = firecrawlData.licenseNumber;
      if (firecrawlData.brokerageName) updateData.company = firecrawlData.brokerageName;
      if (firecrawlData.phone) updateData.phone = firecrawlData.phone;
      if (firecrawlData.email) updateData.email = firecrawlData.email;
      if (firecrawlData.website) updateData.website = firecrawlData.website;
      if (firecrawlData.photoUrl) updateData.image_url = firecrawlData.photoUrl;
      if (firecrawlData.specialties) updateData.specialty = firecrawlData.specialties;
      if (firecrawlData.serviceAreas) updateData.service_areas = firecrawlData.serviceAreas;

      updateData.agent_sales_stats = {
        source: 'firecrawl',
        fetchedAt: new Date().toISOString(),
        countAllTime: firecrawlData.totalSales,
        countLast12Months: firecrawlData.salesLast12Months,
        currentListings: firecrawlData.currentListings,
        avgListPrice: firecrawlData.avgListPrice,
        priceRange: firecrawlData.priceRange,
      };

      if (firecrawlData.brokerageName || firecrawlData.brokerageAddress) {
        updateData.business_address = {
          name: firecrawlData.brokerageName,
          address: firecrawlData.brokerageAddress,
        };
      }

      await supabase.from('professionals').update(updateData).eq('id', agent.id);
    }

    // Run synthesis (after search is done since it uses press mentions)
    try {
      const synthesisResponse = await fetch(`${supabaseUrl}/functions/v1/synthesize-agent-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          professionalId: agent.id,
          skipIfNoPress: false
        }),
      });

      if (synthesisResponse.ok) {
        result.synthesis = 'success';
      } else {
        result.synthesis = 'failed';
      }
    } catch (err) {
      result.synthesis = 'failed';
      console.error(`Synthesis failed for ${agent.name}:`, err);
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Processing failed for ${agent.name}:`, error);
  }

  return result;
}

// Process a batch of agents in parallel
async function processBatch(
  agents: AgentToProcess[],
  supabaseUrl: string,
  supabaseKey: string,
  firecrawlApiKey: string,
  cityName: string,
  stateName: string
): Promise<ProcessingResult[]> {
  const promises = agents.map(agent => 
    processAgent(agent, supabaseUrl, supabaseKey, firecrawlApiKey, cityName, stateName)
  );
  return Promise.all(promises);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      cityId, 
      categoryId, 
      locationText,
      maxResults = 200,
      minRating = 4.9,
      batchSize = 10,
      dryRun = false 
    } = await req.json();

    if (!categoryId || !cityId) {
      throw new Error('cityId and categoryId are required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const PROXY_USERNAME = Deno.env.get('ROTATING_PROXY_USERNAME');
    const PROXY_PASSWORD = Deno.env.get('ROTATING_PROXY_PASSWORD');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!APIFY_API_TOKEN) throw new Error('APIFY_API_TOKEN not configured');
    if (!FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not configured');
    if (!PROXY_USERNAME || !PROXY_PASSWORD) throw new Error('Proxy credentials not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // === STEP 1: Get city info ===
    const { data: cityData, error: cityError } = await supabase
      .from('cities')
      .select('name, state')
      .eq('id', cityId)
      .single();

    if (cityError || !cityData) throw new Error(`City not found: ${cityId}`);

    const cityName = cityData.name;
    const stateName = cityData.state;
    const stateAbbrev = stateName.length === 2 ? stateName : stateAbbreviations[stateName];
    if (!stateAbbrev) throw new Error(`Unknown state: ${stateName}`);

    const searchLocation = locationText || `${cityName} ${stateAbbrev}`;

    console.log(`🚀 FULL PIPELINE START: ${searchLocation}`);
    console.log(`   Min rating: ${minRating}, Batch size: ${batchSize}, Max results: ${maxResults}`);

    // === STEP 2: Run agenscrape ===
    console.log(`📡 PHASE 1: agenscrape for ${searchLocation}...`);

    const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@rp.scrapegw.com:6060`;

    // Use the exact same actor input as fetch-agenscrape-agents
    const actorInput = {
      search_query: searchLocation,
      category: "real-estate-agents",
      locationText: searchLocation,
      name: "",
      language: "English",
      specialty: "",
      maxResults: maxResults,
      startPage: 1,
      proxy: {
        useApifyProxy: false,
        proxyUrls: [proxyUrl]
      }
    };

    console.log(`   Actor input:`, JSON.stringify(actorInput));

    const startResponse = await fetch(
      'https://api.apify.com/v2/acts/getdataforme~zillow-real-state-agents-scraper/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
        body: JSON.stringify(actorInput),
      }
    );

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(`agenscrape failed to start: ${errorText}`);
    }

    const { data: runData } = await startResponse.json();
    const runId = runData.id;
    console.log(`   Actor started: ${runId}`);

    // Poll for completion (up to 10 minutes)
    let status = 'RUNNING';
    let attempts = 0;
    while (status === 'RUNNING' && attempts < 120) {
      await new Promise(r => setTimeout(r, 5000));
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        { headers: { 'Authorization': `Bearer ${APIFY_API_TOKEN}` } }
      );
      const { data: statusData } = await statusResponse.json();
      status = statusData.status;
      attempts++;
      if (attempts % 6 === 0) console.log(`   Polling: ${status} (${attempts * 5}s)`);
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`agenscrape failed: ${status}`);
    }

    // Get results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
      { headers: { 'Authorization': `Bearer ${APIFY_API_TOKEN}` } }
    );
    const rawAgents = await resultsResponse.json();
    console.log(`   ✅ agenscrape returned ${rawAgents.length} agents`);

    // === STEP 3: Filter by rating ===
    console.log(`🔍 PHASE 2: Filtering for ${minRating}+ rating...`);

    const qualifiedAgents = rawAgents.filter((agent: any) => {
      if (agent.category && agent.category !== 'real-estate-agents') return false;
      const rating = parseFloat(agent.rating) || 0;
      return rating >= minRating;
    });

    console.log(`   ✅ ${qualifiedAgents.length} qualified (${rawAgents.length - qualifiedAgents.length} filtered)`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          location: searchLocation,
          agenscrapeTotal: rawAgents.length,
          qualifiedCount: qualifiedAgents.length,
          estimatedCredits: {
            firecrawl: qualifiedAgents.length,
            searchQueries: qualifiedAgents.length * 10 // ~10 queries per agent
          },
          qualifiedAgents: qualifiedAgents.slice(0, 20).map((a: any) => ({
            name: a.name || a.screenName,
            rating: parseFloat(a.rating) || 0,
            profileUrl: a.profile_url
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === STEP 4: Get next rank ===
    const { data: cityRanks } = await supabase
      .from('professional_cities')
      .select('rank')
      .eq('city_id', cityId)
      .order('rank', { ascending: false })
      .limit(1);

    let nextRank = cityRanks && cityRanks.length > 0 ? cityRanks[0].rank + 1 : 1;

    // === STEP 5: Create/link agents and prepare for processing ===
    console.log(`💾 PHASE 3: Creating agent records...`);

    const agentsToProcess: AgentToProcess[] = [];

    for (const agent of qualifiedAgents) {
      const profileUrl = agent.profile_url;
      const agentName = agent.name || agent.screenName || 'Unknown';
      const rating = parseFloat(agent.rating) || 0;

      if (!profileUrl) continue;

      // Check if exists
      const { data: existing } = await supabase
        .from('professionals')
        .select('id')
        .eq('zillow_profile_url', profileUrl)
        .limit(1);

      if (existing && existing.length > 0) {
        const existingId = existing[0].id;

        // Check city link
        const { data: cityLinks } = await supabase
          .from('professional_cities')
          .select('id')
          .eq('professional_id', existingId)
          .eq('city_id', cityId);

        if (!cityLinks || cityLinks.length === 0) {
          await supabase.from('professional_cities').insert({
            professional_id: existingId,
            city_id: cityId,
            rank: nextRank++,
            active: true
          });
        }

        // Add to processing queue
        agentsToProcess.push({
          id: existingId,
          name: agentName,
          profileUrl,
          rating,
          isNew: false
        });
      } else {
        // Create new
        const { data: inserted, error: insertError } = await supabase
          .from('professionals')
          .insert({
            name: agentName,
            zillow_profile_url: profileUrl,
            image_url: agent.image_url || null,
            review_stars_rating: rating,
            num_total_reviews: agent.reviews_count || 0,
            city_id: cityId,
            category_id: categoryId,
            rank: nextRank,
            type: 'individual',
            active: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Insert failed for ${agentName}:`, insertError.message);
          continue;
        }

        // Link to city
        await supabase.from('professional_cities').insert({
          professional_id: inserted.id,
          city_id: cityId,
          rank: nextRank++,
          active: true
        });

        agentsToProcess.push({
          id: inserted.id,
          name: agentName,
          profileUrl,
          rating,
          isNew: true
        });
      }
    }

    console.log(`   ✅ ${agentsToProcess.length} agents ready for enrichment`);

    // === STEP 6: Process in batches ===
    console.log(`🔥 PHASE 4: Enrichment (Firecrawl + Search + Synthesis) in batches of ${batchSize}...`);

    const allResults: ProcessingResult[] = [];
    const totalBatches = Math.ceil(agentsToProcess.length / batchSize);

    for (let i = 0; i < agentsToProcess.length; i += batchSize) {
      const batch = agentsToProcess.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      console.log(`   📦 Batch ${batchNum}/${totalBatches}: ${batch.map(a => a.name).join(', ')}`);
      
      const batchResults = await processBatch(
        batch,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        FIRECRAWL_API_KEY,
        cityName,
        stateName
      );
      
      allResults.push(...batchResults);
      
      // Summary for this batch
      const fcSuccess = batchResults.filter(r => r.firecrawl === 'success').length;
      const searchSuccess = batchResults.filter(r => r.search === 'success').length;
      const synthSuccess = batchResults.filter(r => r.synthesis === 'success').length;
      console.log(`   ✅ Batch ${batchNum} complete: FC ${fcSuccess}/${batch.length}, Search ${searchSuccess}/${batch.length}, Synth ${synthSuccess}/${batch.length}`);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < agentsToProcess.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // === SUMMARY ===
    const summary = {
      agenscrapeTotal: rawAgents.length,
      qualifiedCount: qualifiedAgents.length,
      processedCount: allResults.length,
      firecrawlSuccess: allResults.filter(r => r.firecrawl === 'success').length,
      searchSuccess: allResults.filter(r => r.search === 'success').length,
      synthesisSuccess: allResults.filter(r => r.synthesis === 'success').length,
      errors: allResults.filter(r => r.error).length
    };

    console.log(`🎉 PIPELINE COMPLETE`);
    console.log(`   Total processed: ${summary.processedCount}`);
    console.log(`   Firecrawl: ${summary.firecrawlSuccess}/${summary.processedCount}`);
    console.log(`   Search: ${summary.searchSuccess}/${summary.processedCount}`);
    console.log(`   Synthesis: ${summary.synthesisSuccess}/${summary.processedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        location: searchLocation,
        summary,
        results: allResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pipeline error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
