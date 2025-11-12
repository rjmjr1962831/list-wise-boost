import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyAgentRequest {
  profileUrl: string;
  apifyApiKey?: string; // Optional override, otherwise uses secret
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl, apifyApiKey }: ApifyAgentRequest = await req.json();
    
    // Use provided key or fall back to stored secret
    const apiKey = apifyApiKey || Deno.env.get('APIFY_API_KEY');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Apify API key not configured. Please add it in Settings or provide it in the request.' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Fetching detailed stats from Apify for: ${profileUrl}`);

    // Call Apify actor (jupri/zillow-agents)
    const actorId = 'jupri/zillow-agents';
    
    // Start the actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: [{ url: profileUrl }],
          maxConcurrency: 1,
          proxyConfiguration: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
          }
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Apify run start failed:', runResponse.status, errorText);
      throw new Error(`Failed to start Apify actor: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    
    console.log(`Apify run started: ${runId}, waiting for completion...`);

    // Poll for completion (max 60 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    let runStatus = 'RUNNING';
    
    while (attempts < maxAttempts && runStatus === 'RUNNING') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apiKey}`
      );
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        runStatus = statusData.data.status;
        console.log(`Run status: ${runStatus}`);
      }
      
      attempts++;
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Apify run did not complete successfully: ${runStatus}`);
    }

    // Get the results from default dataset
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs/${runId}/dataset/items?token=${apiKey}`
    );

    if (!resultsResponse.ok) {
      throw new Error('Failed to fetch Apify results');
    }

    const results = await resultsResponse.json();
    
    if (!results || results.length === 0) {
      throw new Error('No data returned from Apify');
    }

    const agentData = results[0];
    console.log('Successfully fetched agent data from Apify');

    // Extract the stats we need
    const stats = {
      totalSales: agentData.agentSalesStats?.countAllTime || 0,
      salesLast12Months: agentData.agentSalesStats?.countLastYear || 0,
      currentListings: agentData.forSaleListings?.listing_count || 0,
      avgSalePrice: agentData.agentSalesStats?.averageValueThreeYear || 0,
      priceRangeMin: agentData.agentSalesStats?.priceRangeThreeYearMin || 0,
      priceRangeMax: agentData.agentSalesStats?.priceRangeThreeYearMax || 0,
      yearsExperience: null, // Not provided by this API
      includesTeam: agentData.agentSalesStats?.stats_include_team || false
    };

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        source: 'apify',
        rawData: agentData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in fetch-apify-agent-stats:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
