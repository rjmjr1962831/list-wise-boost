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

    // Call Apify actor (laelin/zillow-agent-scraper)
    const actorId = 'laelin~zillow-agent-scraper';
    
    // Start the actor run with correct input format
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: [{ url: profileUrl }],
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

    // Fetch dataset ID to retrieve results reliably
    const runDetailResp = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apiKey}`
    );
    let datasetId: string | undefined;
    if (runDetailResp.ok) {
      const runDetail = await runDetailResp.json();
      datasetId = runDetail?.data?.defaultDatasetId;
      console.log(`Using dataset: ${datasetId ?? 'unknown'}`);
    }

    // Try dataset endpoint first, then fall back to runs dataset route
    let results: any[] = [];
    if (datasetId) {
      const dsResp = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&clean=true&limit=1`
      );
      if (dsResp.ok) {
        results = await dsResp.json();
      } else {
        console.error('Dataset fetch failed:', await dsResp.text());
      }
    }

    if (!results.length) {
      const fallbackResp = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}/dataset/items?token=${apiKey}&clean=true&limit=1`
      );
      if (!fallbackResp.ok) {
        const errTxt = await fallbackResp.text();
        throw new Error(`Failed to fetch Apify results: ${errTxt}`);
      }
      results = await fallbackResp.json();
    }

    if (!results || results.length === 0) {
      throw new Error('No data returned from Apify');
    }

    // Choose the most relevant result: exact URL match, then summary with sales stats, else first
    const screenName = (profileUrl.match(/profile\/([^\/?#]+)/i)?.[1] || '').toLowerCase();
    const byExactUrl = results.find((r: any) => typeof r.url === 'string' && r.url.toLowerCase() === profileUrl.toLowerCase());
    const byScreenName = !byExactUrl && screenName
      ? results.find((r: any) => typeof r.url === 'string' && r.url.toLowerCase().endsWith(`/profile/${screenName}`))
      : null;
    const bySalesStats = results.find((r: any) => r && (r.agentSalesStats || r.forSaleListings));

    const agentData = (byExactUrl || byScreenName || bySalesStats || results[0]) ?? {};
    console.log('Selected Apify item. Keys:', Object.keys(agentData));

    // Extract the stats (defensive mapping; preserve zero values)
    const stats = {
      totalSales: agentData.agentSalesStats?.countAllTime ?? agentData.totalSales ?? agentData.salesCount ?? 0,
      salesLast12Months: agentData.agentSalesStats?.countLastYear ?? agentData.salesLast12Months ?? agentData.sales_last_12_months ?? 0,
      currentListings: agentData.forSaleListings?.listing_count ?? agentData.activeListings ?? agentData.currentListings ?? 0,
      avgSalePrice: agentData.agentSalesStats?.averageValueThreeYear ?? agentData.avgSalePrice ?? 0,
      priceRangeMin: agentData.agentSalesStats?.priceRangeThreeYearMin ?? 0,
      priceRangeMax: agentData.agentSalesStats?.priceRangeThreeYearMax ?? 0,
      yearsExperience: agentData.yearsExperience ?? agentData.years_experience ?? null,
      includesTeam: agentData.agentSalesStats?.stats_include_team ?? false,
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
