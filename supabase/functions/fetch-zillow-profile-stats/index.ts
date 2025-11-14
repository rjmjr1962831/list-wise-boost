import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProfileStatsRequest {
  profileUrl: string;
  agentName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl, agentName }: ProfileStatsRequest = await req.json();
    
    console.log(`Fetching detailed stats for ${agentName} from ${profileUrl}`);

    const apiToken = Deno.env.get('APIFY_API_KEY')?.trim() || Deno.env.get('APIFY_API_TOKEN')?.trim();
    
    if (!apiToken) {
      throw new Error('Apify API key not configured');
    }

    // Construct full Zillow URL if relative
    const fullUrl = profileUrl.startsWith('http') 
      ? profileUrl 
      : `https://www.zillow.com${profileUrl}`;

    console.log(`Using Apify to fetch profile: ${fullUrl}`);

    // Use zillowscraper/zillow-agent-details-scraper
    const detailsActorId = 'zillowscraper~zillow-agent-details-scraper';
    
    const detailsInput = {
      agent_url: fullUrl,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      }
    };

    const detailsStartResp = await fetch(`https://api.apify.com/v2/acts/${detailsActorId}/runs?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detailsInput),
    });

    if (!detailsStartResp.ok) {
      const errorText = await detailsStartResp.text();
      console.error('Apify start error:', detailsStartResp.status, errorText);
      throw new Error(`Apify API request failed: ${detailsStartResp.status}`);
    }

    const detailsRun = await detailsStartResp.json();
    const detailsRunId = detailsRun.data.id;
    console.log('Apify run started:', detailsRunId);

    // Poll for completion (max 60s)
    let detailsStatus = detailsRun.data.status;
    let attempts = 0;
    const maxAttempts = 30;

    while (detailsStatus !== 'SUCCEEDED' && detailsStatus !== 'FAILED' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const statusResp = await fetch(`https://api.apify.com/v2/acts/${detailsActorId}/runs/${detailsRunId}?token=${apiToken}`);
      const statusData = await statusResp.json();
      detailsStatus = statusData.data.status;
      console.log(`Run status: ${detailsStatus} (attempt ${attempts})`);
    }

    if (detailsStatus !== 'SUCCEEDED') {
      throw new Error(`Apify run did not succeed: ${detailsStatus}`);
    }

    // Get results
    const datasetId = detailsRun.data.defaultDatasetId;
    const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`);
    const items = await itemsResp.json();

    console.log('Apify results:', items.length, 'items');

    if (items.length === 0) {
      throw new Error('No results from Apify scraper');
    }

    const profileData = items[0];
    console.log('Profile data keys:', Object.keys(profileData));

    // Extract stats from the actual Apify response structure
    const pastSalesTotal = profileData.pastSales?.total || 0;
    const currentListingsCount = profileData.currentListings?.total || 0;
    
    // Extract years of experience - check multiple possible locations
    let yearsExperience = 0;
    if (profileData.displayUser?.businessCard?.yearsOfExperience) {
      const yearsText = profileData.displayUser.businessCard.yearsOfExperience;
      const match = yearsText.match(/(\d+)/);
      yearsExperience = match ? parseInt(match[1]) : 0;
    }
    
    const stats = {
      forSale: currentListingsCount,
      sold: pastSalesTotal,
      forRent: 0,
      reviews: profileData.reviewCount || 0,
      currentListings: currentListingsCount,
      totalSales: pastSalesTotal,
      yearsExperience: yearsExperience,
      specialties: profileData.getToKnowMe?.specialties || [],
      phone: profileData.displayUser?.businessCard?.phone || null,
      email: profileData.displayUser?.businessCard?.email || null,
      brokerage: profileData.displayUser?.businessCard?.brokerageName || null,
    };

    console.log('Extracted stats:', JSON.stringify(stats, null, 2));

    return new Response(
      JSON.stringify({ success: true, stats }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in fetch-zillow-profile-stats:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stats: null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
