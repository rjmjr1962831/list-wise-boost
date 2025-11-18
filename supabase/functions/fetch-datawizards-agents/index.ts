import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchQuery, cityId, categoryId, itemLimit = 50 } = await req.json();
    
    if (!searchQuery || !cityId || !categoryId) {
      throw new Error('searchQuery, cityId, and categoryId are required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    console.log(`Starting DataWizards scraper for: ${searchQuery}, limit: ${itemLimit}`);

    // Start the Apify actor
    const actorInput = {
      itemLimit,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
        apifyProxyCountry: "US"
      },
      search_query: searchQuery
    };

    const startResponse = await fetch(
      'https://api.apify.com/v2/acts/hello.datawizards~Real-Estate-Agents-Scraper/runs',
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
      throw new Error(`Failed to start actor: ${startResponse.status} - ${errorText}`);
    }

    const { data: runData } = await startResponse.json();
    const runId = runData.id;
    console.log(`Actor started with run ID: ${runId}`);

    // Poll for completion
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${APIFY_API_TOKEN}`,
          },
        }
      );

      const { data: statusData } = await statusResponse.json();
      status = statusData.status;
      attempts++;
      
      console.log(`Run status: ${status}, attempt ${attempts}/${maxAttempts}`);
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Actor run did not succeed. Final status: ${status}`);
    }

    // Get results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
      {
        headers: {
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
      }
    );

    const agents = await resultsResponse.json();
    console.log(`Retrieved ${agents.length} agents`);

    // Get next rank using REST API
    const existingProsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/professionals?city_id=eq.${cityId}&category_id=eq.${categoryId}&select=rank&order=rank.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    const existingPros = await existingProsResponse.json();
    let nextRank = existingPros && existingPros.length > 0 ? existingPros[0].rank + 1 : 1;

    // Insert agents into database
    const insertedAgents = [];
    
    for (const agent of agents) {
      // Parse review count
      const reviewCount = agent.REVIEW_COUNT 
        ? parseInt(agent.REVIEW_COUNT.replace(/[()]/g, '')) 
        : 0;

      // Parse sales numbers
      const salesLast12Months = agent.TEAM_SALES_LAST_12_MONTHS 
        ? parseInt(agent.TEAM_SALES_LAST_12_MONTHS.replace(/,/g, ''))
        : 0;
      
      const salesInLocation = agent.TEAM_SALES_IN_LOCATION 
        ? parseInt(agent.TEAM_SALES_IN_LOCATION.replace(/,/g, ''))
        : 0;

      // Determine type based on tags
      const isTeam = agent.TAGS && agent.TAGS.includes('TEAM');

      const professionalData = {
        name: agent.NAME,
        company: agent.AGENCY_NAME || null,
        zillow_profile_url: agent.PROFILE_LINK || null,
        image_url: agent.IMAGE_URL || null,
        city_id: cityId,
        category_id: categoryId,
        rank: nextRank++,
        type: isTeam ? 'team' : 'individual',
        current_listings: salesLast12Months,
        total_sales: salesInLocation,
        active: true,
        badges: agent.IS_TOP_AGENT ? ['Top Agent'] : null,
      };

      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/professionals`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(professionalData),
        }
      );

      if (insertResponse.ok) {
        const [inserted] = await insertResponse.json();
        insertedAgents.push(inserted);
        console.log(`Inserted: ${agent.NAME}`);
      } else {
        const error = await insertResponse.text();
        console.error(`Error inserting agent ${agent.NAME}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedAgents.length,
        total: agents.length,
        agents: insertedAgents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in fetch-datawizards-agents:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
