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
    const { city, state, cityId, categoryId, maxAgents = 10 } = await req.json();
    
    if (!city || !state || !cityId || !categoryId) {
      throw new Error('city, state, cityId, and categoryId are required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    console.log(`Starting two-step Zillow scraper for ${city}, ${state}`);

    // STEP 1: Get agent URLs from getdataforme scraper
    console.log('STEP 1: Getting agent list...');
    const step1Input = {
      search_query: `${city}, ${state}`,
      max_items: maxAgents
    };

    const step1Response = await fetch(
      'https://api.apify.com/v2/acts/getdataforme~zillow-real-state-agents-scraper/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
        body: JSON.stringify(step1Input),
      }
    );

    if (!step1Response.ok) {
      const errorText = await step1Response.text();
      throw new Error(`Step 1 failed to start: ${step1Response.status} - ${errorText}`);
    }

    const { data: step1RunData } = await step1Response.json();
    const step1RunId = step1RunData.id;
    console.log(`Step 1 actor started with run ID: ${step1RunId}`);

    // Poll for Step 1 completion
    let step1Status = 'RUNNING';
    let step1Attempts = 0;
    const maxAttempts = 120;

    while (step1Status === 'RUNNING' && step1Attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${step1RunId}`,
        {
          headers: {
            'Authorization': `Bearer ${APIFY_API_TOKEN}`,
          },
        }
      );

      const statusResult = await statusResponse.json();
      step1Status = statusResult.data.status;
      step1Attempts++;
      
      console.log(`Step 1 status: ${step1Status}, attempt ${step1Attempts}/${maxAttempts}`);
    }

    if (step1Status !== 'SUCCEEDED') {
      throw new Error(`Step 1 did not complete successfully. Final status: ${step1Status}`);
    }

    // Get Step 1 results
    const step1ResultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${step1RunId}/dataset/items`,
      {
        headers: {
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
      }
    );

    const step1Agents = await step1ResultsResponse.json();
    console.log(`Step 1 retrieved ${step1Agents.length} agents`);

    if (!step1Agents || step1Agents.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No agents found in step 1',
          imported: 0
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // STEP 2: Get detailed data from memo23 scraper
    console.log('STEP 2: Getting detailed agent data...');
    const profileUrls = step1Agents
      .filter((a: any) => a.agent_url)
      .map((a: any) => ({
        url: `https://www.zillow.com${a.agent_url}`
      }));

    console.log(`Fetching details for ${profileUrls.length} agents`);

    const step2Input = {
      startUrls: profileUrls,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      }
    };

    const step2Response = await fetch(
      'https://api.apify.com/v2/acts/memo23~apify-zillow-agents-cheerio/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
        body: JSON.stringify(step2Input),
      }
    );

    if (!step2Response.ok) {
      const errorText = await step2Response.text();
      throw new Error(`Step 2 failed to start: ${step2Response.status} - ${errorText}`);
    }

    const { data: step2RunData } = await step2Response.json();
    const step2RunId = step2RunData.id;
    console.log(`Step 2 actor started with run ID: ${step2RunId}`);

    // Poll for Step 2 completion
    let step2Status = 'RUNNING';
    let step2Attempts = 0;

    while (step2Status === 'RUNNING' && step2Attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${step2RunId}`,
        {
          headers: {
            'Authorization': `Bearer ${APIFY_API_TOKEN}`,
          },
        }
      );

      const statusResult = await statusResponse.json();
      step2Status = statusResult.data.status;
      step2Attempts++;
      
      console.log(`Step 2 status: ${step2Status}, attempt ${step2Attempts}/${maxAttempts}`);
    }

    if (step2Status !== 'SUCCEEDED') {
      throw new Error(`Step 2 did not complete successfully. Final status: ${step2Status}`);
    }

    // Get Step 2 results
    const step2ResultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${step2RunId}/dataset/items`,
      {
        headers: {
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
      }
    );

    const detailedAgents = await step2ResultsResponse.json();
    console.log(`Step 2 retrieved ${detailedAgents.length} detailed agent profiles`);

    // STEP 3: Save to database
    let imported = 0;
    const errors: string[] = [];

    for (const agent of detailedAgents) {
      try {
        const badges: string[] = [];
        
        if (agent.ratings?.average >= 4.5) {
          badges.push('5-Star Rated');
        }
        if (agent.agentSalesStats?.countAllTime >= 100) {
          badges.push('100+ Sales');
        }
        if (agent.isTopAgent) {
          badges.push('Top Agent');
        }

        // Build full address
        const address = agent.businessAddress 
          ? [
              agent.businessAddress.address1,
              agent.businessAddress.address2,
              agent.businessAddress.city,
              agent.businessAddress.state,
              agent.businessAddress.postalCode
            ].filter(Boolean).join(', ')
          : null;

        const professionalData = {
          city_id: cityId,
          category_id: categoryId,
          name: agent.name || agent.screenName || 'Unknown Agent',
          company: agent.businessName || null,
          phone: agent.phoneNumbers?.cell || agent.phoneNumbers?.business || null,
          email: agent.email || null,
          website: agent.url || null,
          zillow_profile_url: agent.url || null,
          image_url: agent.profilePhotoSrc || null,
          description: null,
          specialty: null,
          type: 'individual',
          rank: imported + 1,
          active: true,
          total_sales: agent.agentSalesStats?.countAllTime || agent.pastSales?.total || null,
          current_listings: agent.forSaleListings?.listing_count || null,
          years_experience: null,
          badges,
          address,
          zip_code: agent.businessAddress?.postalCode || null,
          zuid: agent.encodedZuid || null,
        };

        const insertResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/professionals`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY!,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(professionalData)
          }
        );

        if (insertResponse.ok) {
          imported++;
          console.log(`✅ Imported ${professionalData.name}`);
        } else {
          const errorText = await insertResponse.text();
          errors.push(`Failed to import ${professionalData.name}: ${errorText}`);
          console.error(`❌ Failed to import ${professionalData.name}:`, errorText);
        }
      } catch (error: any) {
        errors.push(`Error processing ${agent.name || 'unknown'}: ${error.message}`);
        console.error(`Error processing agent:`, error);
      }
    }

    console.log(`Import complete: ${imported}/${detailedAgents.length} agents imported`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total: detailedAgents.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in fetch-zillow-agents-twostep:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
