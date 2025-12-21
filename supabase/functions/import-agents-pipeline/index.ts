import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// State name to abbreviation mapper
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

// Zillow Agent Profile Schema for Firecrawl JSON extraction
const ZILLOW_AGENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    profileUrl: { type: "string" },
    photoUrl: { type: "string" },
    zillowRating: { type: "number" },
    reviewCount: { type: "number" },
    totalSales: { type: "number" },
    salesLast12Months: { type: "number" },
    currentListings: { type: "number" },
    listingsForSale: { type: "number" },
    yearsExperience: { type: "number" },
    licenseNumber: { type: "string" },
    licenseState: { type: "string" },
    brokerageName: { type: "string" },
    brokerageAddress: { type: "string" },
    brokeragePhone: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    website: { type: "string" },
    serviceAreas: { type: "array", items: { type: "string" } },
    primaryCity: { type: "string" },
    primaryState: { type: "string" },
    specialties: { type: "array", items: { type: "string" } },
    avgListPrice: { type: "string" },
    avgSalePrice: { type: "string" },
    priceRange: { type: "string" },
  },
  required: ["name"]
};

interface AgentResult {
  id?: string;
  name: string;
  profileUrl: string;
  rating?: number;
  step: 'agenscrape' | 'firecrawl' | 'saved';
  error?: string;
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
      skipFirecrawl = false,
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
    if (!FIRECRAWL_API_KEY && !skipFirecrawl) throw new Error('FIRECRAWL_API_KEY not configured');
    if (!PROXY_USERNAME || !PROXY_PASSWORD) throw new Error('Proxy credentials not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // === STEP 1: Determine search location ===
    let searchLocation = locationText;
    if (!searchLocation) {
      const { data: cityData, error: cityError } = await supabase
        .from('cities')
        .select('name, state')
        .eq('id', cityId)
        .single();

      if (cityError || !cityData) throw new Error(`City not found: ${cityId}`);

      const stateAbbrev = cityData.state.length === 2 
        ? cityData.state 
        : stateAbbreviations[cityData.state];
      if (!stateAbbrev) throw new Error(`Unknown state: ${cityData.state}`);
      
      searchLocation = `${cityData.name} ${stateAbbrev}`;
    }

    console.log(`🚀 PIPELINE START: ${searchLocation}`);
    console.log(`   Min rating: ${minRating}, Max results: ${maxResults}`);
    console.log(`   Skip Firecrawl: ${skipFirecrawl}, Dry run: ${dryRun}`);

    // === STEP 2: Run agenscrape to get profile URLs ===
    console.log(`📡 STEP 1: Running agenscrape for ${searchLocation}...`);

    const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@rp.scrapegw.com:6060`;

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
      throw new Error(`Failed to start agenscrape: ${startResponse.status} - ${errorText}`);
    }

    const { data: runData } = await startResponse.json();
    const runId = runData.id;
    console.log(`   Actor started: ${runId}`);

    // Poll for completion
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 120;

    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        { headers: { 'Authorization': `Bearer ${APIFY_API_TOKEN}` } }
      );

      const { data: statusData } = await statusResponse.json();
      status = statusData.status;
      attempts++;
      
      if (attempts % 6 === 0) {
        console.log(`   Polling: ${status} (${attempts * 5}s elapsed)`);
      }
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Agenscrape failed: ${status} after ${attempts * 5}s`);
    }

    // Get agenscrape results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
      { headers: { 'Authorization': `Bearer ${APIFY_API_TOKEN}` } }
    );

    const rawAgents = await resultsResponse.json();
    console.log(`   ✅ agenscrape returned ${rawAgents.length} agents`);

    // === STEP 3: Filter by rating ===
    console.log(`🔍 STEP 2: Filtering for ${minRating}+ rating...`);

    const qualifiedAgents = rawAgents.filter((agent: any) => {
      if (agent.category && agent.category !== 'real-estate-agents') return false;
      const rating = parseFloat(agent.rating) || 0;
      return rating >= minRating;
    });

    console.log(`   ✅ ${qualifiedAgents.length} agents qualify (${rawAgents.length - qualifiedAgents.length} filtered out)`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          location: searchLocation,
          agenscrapeTotal: rawAgents.length,
          qualifiedCount: qualifiedAgents.length,
          filteredOut: rawAgents.length - qualifiedAgents.length,
          estimatedFirecrawlCredits: qualifiedAgents.length,
          qualifiedAgents: qualifiedAgents.map((a: any) => ({
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

    // === STEP 5: Process each qualified agent ===
    console.log(`💾 STEP 3: Processing ${qualifiedAgents.length} qualified agents...`);

    const results: AgentResult[] = [];
    let savedCount = 0;
    let skippedCount = 0;
    let firecrawlCreditsUsed = 0;

    for (const agent of qualifiedAgents) {
      const profileUrl = agent.profile_url;
      const agentName = agent.name || agent.screenName || 'Unknown';
      const rating = parseFloat(agent.rating) || 0;

      if (!profileUrl) {
        console.log(`   ⏭️ Skipping ${agentName} - no profile URL`);
        continue;
      }

      // Check if agent already exists
      const { data: existingAgents } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('zillow_profile_url', profileUrl)
        .limit(1);

      if (existingAgents && existingAgents.length > 0) {
        const existingId = existingAgents[0].id;

        // Check if already linked to this city
        const { data: cityLinks } = await supabase
          .from('professional_cities')
          .select('id')
          .eq('professional_id', existingId)
          .eq('city_id', cityId);

        if (!cityLinks || cityLinks.length === 0) {
          // Link existing agent to this city
          await supabase.from('professional_cities').insert({
            professional_id: existingId,
            city_id: cityId,
            rank: nextRank++,
            active: true
          });
          console.log(`   🔗 Linked existing ${agentName} to city`);
        } else {
          skippedCount++;
        }
        continue;
      }

      // === STEP 6: Enrich with Firecrawl ===
      let firecrawlData: any = null;

      if (!skipFirecrawl) {
        try {
          console.log(`   🔥 Firecrawl enriching: ${agentName}`);

          const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: profileUrl,
              formats: ['extract'],
              extract: { schema: ZILLOW_AGENT_SCHEMA },
              onlyMainContent: true,
              timeout: 30000,
            }),
          });

          if (fcResponse.ok) {
            const fcData = await fcResponse.json();
            firecrawlData = fcData.data?.extract || fcData.extract || fcData.data;
            firecrawlCreditsUsed++;
            console.log(`   ✅ Firecrawl data received for ${agentName}`);
          } else {
            console.error(`   ❌ Firecrawl failed for ${agentName}: ${fcResponse.status}`);
          }
        } catch (err) {
          console.error(`   ❌ Firecrawl error for ${agentName}:`, err);
        }
      }

      // === STEP 7: Create professional record ===
      const professionalData: Record<string, any> = {
        name: firecrawlData?.name || agentName,
        zillow_profile_url: profileUrl,
        image_url: firecrawlData?.photoUrl || agent.image_url || null,
        phone: firecrawlData?.phone || agent.phoneNumber || null,
        email: firecrawlData?.email || agent.email || null,
        website: firecrawlData?.website || null,
        company: firecrawlData?.brokerageName || agent.businessName || null,
        review_stars_rating: firecrawlData?.zillowRating || rating,
        num_total_reviews: firecrawlData?.reviewCount || agent.reviews_count || 0,
        total_sales: firecrawlData?.totalSales || agent.team_sales_last_12_months || 0,
        current_listings: firecrawlData?.currentListings || agent.for_sale_count || 0,
        years_experience: firecrawlData?.yearsExperience || null,
        specialty: firecrawlData?.specialties || null,
        service_areas: firecrawlData?.serviceAreas || null,
        city_id: cityId,
        category_id: categoryId,
        rank: nextRank,
        type: 'individual',
        active: true,
      };

      // Add sales stats from Firecrawl
      if (firecrawlData) {
        professionalData.agent_sales_stats = {
          source: 'firecrawl',
          fetchedAt: new Date().toISOString(),
          countAllTime: firecrawlData.totalSales,
          countLast12Months: firecrawlData.salesLast12Months,
          currentListings: firecrawlData.currentListings,
          avgListPrice: firecrawlData.avgListPrice,
          avgSalePrice: firecrawlData.avgSalePrice,
          priceRange: firecrawlData.priceRange,
        };

        if (firecrawlData.brokerageName || firecrawlData.brokerageAddress) {
          professionalData.business_address = {
            name: firecrawlData.brokerageName,
            address: firecrawlData.brokerageAddress,
            phone: firecrawlData.brokeragePhone,
          };
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from('professionals')
        .insert(professionalData)
        .select()
        .single();

      if (insertError) {
        console.error(`   ❌ Insert failed for ${agentName}:`, insertError.message);
        results.push({ name: agentName, profileUrl, rating, step: 'saved', error: insertError.message });
        continue;
      }

      // Link to city
      await supabase.from('professional_cities').insert({
        professional_id: inserted.id,
        city_id: cityId,
        rank: nextRank++,
        active: true
      });

      savedCount++;
      results.push({ id: inserted.id, name: agentName, profileUrl, rating, step: 'saved' });
      console.log(`   ✅ Saved: ${agentName} (${rating}★)`);
    }

    console.log(`🎉 PIPELINE COMPLETE`);
    console.log(`   Saved: ${savedCount}, Skipped: ${skippedCount}`);
    console.log(`   Firecrawl credits used: ${firecrawlCreditsUsed}`);

    return new Response(
      JSON.stringify({
        success: true,
        location: searchLocation,
        summary: {
          agenscrapeTotal: rawAgents.length,
          qualifiedCount: qualifiedAgents.length,
          savedCount,
          skippedCount,
          firecrawlCreditsUsed
        },
        results
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
