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
    const { zipCodes, cityId, categoryId, detailedProfiles = true } = await req.json();
    
    if (!zipCodes || zipCodes.length === 0 || !cityId || !categoryId) {
      throw new Error('zipCodes, cityId, and categoryId are required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    console.log(`Starting rigelbytes scraper for zip codes: ${zipCodes.join(', ')}`);

    // Start the Apify actor
    const actorInput = {
      arabic: false,
      bengali: false,
      buying: false,
      cantonese: false,
      detailed_profiles: detailedProfiles,
      farsi: false,
      first_time_home_buyers: false,
      foreclosure: false,
      french: false,
      german: false,
      greek: false,
      hebrew: false,
      hindi: false,
      hungarian: false,
      investment_properties: false,
      italian: false,
      japanese: false,
      korean: false,
      lot_land: false,
      luxury_homes: false,
      mandarin: false,
      military_veterans: false,
      new_construction: false,
      polish: false,
      portuguese: false,
      property_management: false,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      },
      relocation: false,
      rentals: false,
      russian: false,
      search_keywords: zipCodes,
      selling: false,
      senior_communities: false,
      spanish: false,
      tagalog: false,
      thai: false,
      top_agent: false,
      turkish: false,
      vacation_short_term_rentals: false,
      vietnamese: false
    };

    const startResponse = await fetch(
      'https://api.apify.com/v2/acts/rigelbytes~zillow-agents/runs',
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

    // Poll for completion with timeout handling
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes max (5 sec intervals) to avoid edge function timeout

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

    // If still running after max attempts, return partial success
    if (status === 'RUNNING') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Scraper is still running. This usually takes 5-10 minutes. Please check back later or try with fewer zip codes.',
          runId: runId,
          status: 'RUNNING'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      // Determine type based on agent data
      const isTeam = agent.is_team || false;

      const professionalData = {
        name: agent.name || agent.agent_name,
        company: agent.company || agent.brokerage_name || null,
        zillow_profile_url: agent.profile_url || agent.zillow_url || null,
        image_url: agent.photo_url || agent.image_url || null,
        phone: agent.phone || null,
        city_id: cityId,
        category_id: categoryId,
        rank: nextRank++,
        type: isTeam ? 'team' : 'individual',
        current_listings: agent.current_listings || agent.for_sale_count || 0,
        total_sales: agent.total_sales || agent.sold_count || 0,
        years_experience: agent.years_experience || null,
        active: true,
        zuid: agent.zuid || null,
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
        console.log(`Inserted: ${agent.name || agent.agent_name}`);
      } else {
        const error = await insertResponse.text();
        console.error(`Error inserting agent ${agent.name || agent.agent_name}:`, error);
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
    console.error('Error in fetch-rigelbytes-agents:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
