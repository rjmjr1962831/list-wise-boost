import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to normalize city names for comparison
function normalizeCity(city: string): string {
  return city.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cityName, cityId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyApiToken = Deno.env.get('APIFY_API_TOKEN');
    const proxyUsername = Deno.env.get('ROTATING_PROXY_USERNAME');
    const proxyPassword = Deno.env.get('ROTATING_PROXY_PASSWORD');
    
    if (!apifyApiToken) throw new Error('APIFY_API_TOKEN not configured');
    if (!proxyUsername || !proxyPassword) throw new Error('ProxyScrape credentials not configured');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get city details if cityId provided
    let searchLocation = cityName;
    let cityDbId = cityId;
    let searchCityName = ''; // Extracted city name for matching
    let searchState = '';    // Extracted state for matching
    
    if (cityId && !cityName) {
      const { data: cityData } = await supabase
        .from('cities')
        .select('name, state')
        .eq('id', cityId)
        .single();
      
      if (cityData) {
        searchLocation = `${cityData.name}, ${cityData.state}`;
        searchCityName = cityData.name;
        searchState = cityData.state;
      }
    } else if (cityName) {
      // Parse "City, State" format
      const parts = cityName.split(',').map((p: string) => p.trim());
      searchCityName = parts[0] || '';
      searchState = parts[1] || '';
    }

    if (!searchLocation) {
      throw new Error('Either cityName or cityId must be provided');
    }

    console.log(`Starting Zillow ranking capture for: ${searchLocation}`);
    console.log(`Will only update agents with business_address.city matching: ${searchCityName}`);

    // Configure ProxyScrape proxy (same as working architecture)
    const proxyUrl = `http://${proxyUsername}:${proxyPassword}@rp.scrapegw.com:6060`;
    
    // Prepare actor input matching working function
    const actorInput = {
      search_query: searchLocation,
      category: "real-estate-agents",
      locationText: searchLocation,
      name: "",
      language: "English",
      specialty: "",
      maxResults: 500,
      startPage: 1,
      proxy: {
        useApifyProxy: false,
        proxyUrls: [proxyUrl]
      }
    };
    
    console.log('Starting Apify actor with input:', JSON.stringify(actorInput, null, 2));
    
    // Start Apify actor (using getdataforme~zillow-real-state-agents-scraper)
    const actorStartResponse = await fetch(
      'https://api.apify.com/v2/acts/getdataforme~zillow-real-state-agents-scraper/runs',
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apifyApiToken}`
        },
        body: JSON.stringify(actorInput),
      }
    );

    if (!actorStartResponse.ok) {
      const errorText = await actorStartResponse.text();
      console.error('Apify actor start failed:', errorText);
      throw new Error(`Failed to start Apify actor: ${actorStartResponse.statusText}`);
    }

    const { data: runData } = await actorStartResponse.json();
    const runId = runData.id;
    console.log(`✅ Apify run started: ${runId}`);

    // Poll for completion (max 10 minutes)
    let runStatus = 'RUNNING';
    const maxAttempts = 120;
    let attempts = 0;

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${apifyApiToken}`
          }
        }
      );
      
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      attempts++;
      
      console.log(`📊 Poll attempt ${attempts}/${maxAttempts}: ${runStatus}`);
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Apify run failed or timed out. Status: ${runStatus}`);
    }

    // Fetch results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
      {
        headers: {
          'Authorization': `Bearer ${apifyApiToken}`
        }
      }
    );

    const agents = await resultsResponse.json();
    console.log(`✅ Retrieved ${agents.length} agents from Apify`);

    // Process and update rankings
    let updated = 0;
    let notFound = 0;
    let cityMismatch = 0;
    let alreadyCaptured = 0;
    const totalAgents = agents.length;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const position = i + 1;
      const page = Math.ceil(position / 20); // Zillow shows 20 agents per page
      
      const zillowUrl = agent.profile_url || agent.url || agent.profileUrl;
      if (!zillowUrl) {
        console.log(`Agent at position ${position} has no URL, skipping`);
        notFound++;
        continue;
      }

      // Find existing professional by zillow_profile_url - include business_address for city matching
      const { data: existingAgent } = await supabase
        .from('professionals')
        .select('id, name, zillow_rank_captured_at, business_address')
        .eq('zillow_profile_url', zillowUrl)
        .single();

      if (existingAgent) {
        // Skip if already captured within last 24 hours
        if (existingAgent.zillow_rank_captured_at) {
          const capturedAt = new Date(existingAgent.zillow_rank_captured_at);
          const hoursSinceCaptured = (Date.now() - capturedAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceCaptured < 24) {
            console.log(`⏭️ Skipping ${existingAgent.name} - already captured ${hoursSinceCaptured.toFixed(1)}h ago`);
            alreadyCaptured++;
            continue;
          }
        }

        // CRITICAL: Validate agent's business_address.city matches search city
        const businessAddress = existingAgent.business_address as { city?: string; state?: string } | null;
        const agentCity = businessAddress?.city || '';
        
        if (searchCityName && agentCity) {
          const normalizedSearchCity = normalizeCity(searchCityName);
          const normalizedAgentCity = normalizeCity(agentCity);
          
          if (normalizedSearchCity !== normalizedAgentCity) {
            console.log(`⚠️ City mismatch for ${existingAgent.name}: searched "${searchCityName}" but agent is in "${agentCity}" - SKIPPING`);
            cityMismatch++;
            continue;
          }
        }

        const { error: updateError } = await supabase
          .from('professionals')
          .update({
            zillow_search_page: page,
            zillow_search_position: position,
            zillow_search_total: totalAgents,
            zillow_rank_captured_at: new Date().toISOString(),
            zillow_search_city: searchLocation
          })
          .eq('id', existingAgent.id);

        if (updateError) {
          console.error(`Failed to update ${existingAgent.name}:`, updateError);
        } else {
          console.log(`✅ Updated ${existingAgent.name}: Page ${page}, Position ${position}`);
          updated++;
        }
      } else {
        console.log(`❌ Agent not found for URL: ${zillowUrl}`);
        notFound++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Ranking capture complete for ${searchLocation}`,
        stats: {
          totalFound: totalAgents,
          updated,
          notFound,
          cityMismatch,
          alreadyCaptured,
          city: searchLocation,
          cityId: cityDbId
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in capture-zillow-rankings:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
