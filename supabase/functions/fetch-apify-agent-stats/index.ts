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

    // Call Apify actor - configurable via secret
    const actorId = Deno.env.get('APIFY_ACTOR_ID')?.trim() || 'jupri~zillow-agents';
    
    // Start the actor run with correct input format
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: [profileUrl],
          limit: 1,
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
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&clean=true&limit=200`
      );
      if (dsResp.ok) {
        results = await dsResp.json();
      } else {
        console.error('Dataset fetch failed:', await dsResp.text());
      }
    }

    if (!results.length) {
      const fallbackResp = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}/dataset/items?token=${apiKey}&clean=true&limit=200`
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

    // Prefer items that actually contain stats; skip error-only records
    const isStatsItem = (r: any) => r && !r.error && (
      r.agentSalesStats || r.forSaleListings || r.pastSales ||
      r.salesCount != null || r.totalSales != null ||
      (Array.isArray(r.for_sale_listings) && r.for_sale_listings.length)
    );

    const byExactUrlWithStats = results.find((r: any) =>
      typeof r.url === 'string' && r.url.toLowerCase() === profileUrl.toLowerCase() && isStatsItem(r)
    );

    const byScreenNameWithStats = !byExactUrlWithStats && screenName
      ? results.find((r: any) => typeof r.url === 'string' && r.url.toLowerCase().endsWith(`/profile/${screenName}`) && isStatsItem(r))
      : null;

    const anyStatsItem = results.find(isStatsItem);
    const firstNonError = results.find((r: any) => r && !r.error);

    const agentData = (byExactUrlWithStats || anyStatsItem || byScreenNameWithStats || firstNonError || results[0]) ?? {};
    console.log('Selected Apify item. Keys:', Object.keys(agentData));

    // Helper to safely parse various date formats
    const parseDate = (val: string | undefined) => {
      if (!val) return undefined;
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
      const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const mm = parseInt(m[1], 10) - 1;
        const dd = parseInt(m[2], 10);
        const yyyy = parseInt(m[3], 10);
        return new Date(yyyy, mm, dd);
      }
      return undefined;
    };

    // Derive fields robustly; preserve 0 values
    const totalSales = agentData.pastSales?.total
      ?? agentData.agentSalesStats?.countAllTime
      ?? agentData.totalSales
      ?? agentData.salesCount
      ?? 0;

    const currentListings = agentData.forSaleListings?.listing_count
      ?? (Array.isArray(agentData.forSaleListings?.listings) ? agentData.forSaleListings.listings.length : undefined)
      ?? agentData.activeListings
      ?? agentData.currentListings
      ?? 0;

    let salesLast12Months = agentData.agentSalesStats?.countLastYear
      ?? agentData.salesLast12Months
      ?? agentData.sales_last_12_months;

    if (salesLast12Months == null && Array.isArray(agentData.pastSales?.past_sales)) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      salesLast12Months = agentData.pastSales.past_sales.reduce((acc: number, s: any) => {
        const dt = parseDate(s?.sold_date);
        return acc + (dt && dt > oneYearAgo ? 1 : 0);
      }, 0);
    }

    // Extract specialties if available
    const specialties: string[] = [];
    if (agentData.specialties && Array.isArray(agentData.specialties)) {
      specialties.push(...agentData.specialties);
    } else if (agentData.areasOfFocus && Array.isArray(agentData.areasOfFocus)) {
      specialties.push(...agentData.areasOfFocus);
    } else if (agentData.areas_of_focus && Array.isArray(agentData.areas_of_focus)) {
      specialties.push(...agentData.areas_of_focus);
    } else if (typeof agentData.specialties === 'string') {
      // Sometimes specialties come as comma-separated string
      specialties.push(...agentData.specialties.split(',').map((s: string) => s.trim()).filter(Boolean));
    }

    const stats = {
      totalSales,
      salesLast12Months: salesLast12Months ?? 0,
      currentListings,
      avgSalePrice: agentData.agentSalesStats?.averageValueThreeYear ?? agentData.avgSalePrice ?? 0,
      priceRangeMin: agentData.agentSalesStats?.priceRangeThreeYearMin ?? 0,
      priceRangeMax: agentData.agentSalesStats?.priceRangeThreeYearMax ?? 0,
      yearsExperience: agentData.yearsExperience ?? agentData.years_experience ?? null,
      includesTeam: agentData.agentSalesStats?.stats_include_team ?? false,
      specialties: specialties.length > 0 ? specialties : undefined,
    };

    console.log('Mapped stats from Apify:', stats);

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
