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
    const { locationText, cityId, categoryId } = await req.json();
    
    if (!locationText || !cityId || !categoryId) {
      throw new Error('locationText, cityId, and categoryId are required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    console.log(`Starting agenscrape scraper for location: ${locationText}`);

    // Start the Apify actor
    const actorInput = {
      locationText: locationText,
      category: "real-estate-agents",
      maxResults: 50,
      startPage: 1
    };

    const startResponse = await fetch(
      'https://api.apify.com/v2/acts/agenscrape~zillow-agents-finder/runs',
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
    const maxAttempts = 60; // 5 minutes max (5 sec intervals)

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
    console.log(`Retrieved ${agents.length} agent profile URLs`);

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

    // Insert agents into database (just profile URLs for now)
    const insertedAgents = [];
    
    for (const agent of agents) {
      // Extract agent info from Apify response
      const profileUrl = agent.profileLink;
      
      if (!profileUrl) {
        console.log('Skipping agent without profile URL');
        continue;
      }

      const professionalData = {
        name: agent.fullName || 'Agent ' + nextRank,
        zillow_profile_url: profileUrl,
        phone: agent.phoneNumber || null,
        company: agent.businessName || null,
        city_id: cityId,
        category_id: categoryId,
        rank: nextRank++,
        type: 'individual',
        active: true,
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
        console.log(`Inserted agent with profile: ${profileUrl}`);
      } else {
        const error = await insertResponse.text();
        console.error(`Error inserting agent:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedAgents.length,
        total: agents.length,
        agents: insertedAgents.map(a => ({
          id: a.id,
          name: a.name,
          profileUrl: a.zillow_profile_url
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in fetch-agenscrape-agents:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
