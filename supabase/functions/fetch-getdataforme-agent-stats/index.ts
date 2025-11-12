import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetDataForMeRequest {
  profileUrl: string;
  apifyApiKey?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl, apifyApiKey }: GetDataForMeRequest = await req.json();

    if (!profileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = apifyApiKey || Deno.env.get('APIFY_API_TOKEN');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apify API token not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting Apify zillow-agent-scraper for:', profileUrl);

    // Extract agent name from URL for search
    const urlParts = profileUrl.split('/');
    const agentSlug = urlParts[urlParts.length - 1];
    const searchName = agentSlug.replace(/-/g, ' ');
    
    console.log('Searching for agent:', searchName);

    // Start the actor run - this scraper searches by location
    const actorId = 'scraped/zillow-agent-scraper';
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'Arizona', // Search broadly, then filter by URL
          maxPages: 3 // Search more pages to find the agent
        })
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start actor:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to start scraper: ${runResponse.statusText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    console.log(`Run started: ${runId}`);

    // Poll for completion (max 5 minutes)
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 60;

    while ((status === 'RUNNING' || status === 'READY') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apiKey}`
      );
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        status = statusData.data.status;
        attempts++;
        console.log(`Status: ${status} (attempt ${attempts}/${maxAttempts})`);
      } else {
        attempts++;
      }
    }

    if (status !== 'SUCCEEDED') {
      console.error(`Run did not complete successfully: ${status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Scraper run failed: ${status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`
    );

    if (!resultsResponse.ok) {
      console.error('Failed to fetch results');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawData = await resultsResponse.json();
    console.log(`Got ${rawData.length} agents from dataset`);

    if (!rawData || rawData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, stats: null, message: 'No data found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the matching agent by URL
    const matchingAgent = rawData.find((agent: any) => {
      const agentProfileUrl = agent['Profile Link'] || '';
      return agentProfileUrl.toLowerCase().includes(agentSlug.toLowerCase());
    });

    if (!matchingAgent) {
      console.log('No matching agent found for URL:', profileUrl);
      return new Response(
        JSON.stringify({ success: true, stats: null, message: 'Agent not found in results' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found matching agent:', matchingAgent['Full Name']);
    
    // Format the data using the scraped/zillow-agent-scraper field names
    const formattedData = {
      success: true,
      stats: {
        fullName: matchingAgent['Full Name'] || null,
        brokerage: matchingAgent['Business Name'] || null,
        starRating: parseFloat(matchingAgent['Review Stars Rating']) || null,
        totalReviews: parseInt(matchingAgent['Total Reviews']) || null,
        phoneNumber: matchingAgent['Phone Number'] || null,
        currentListings: null, // Not provided by this scraper
        totalSales: parseInt(matchingAgent['Sale Count All Time']) || null,
        salesLastYear: parseInt(matchingAgent['Sale Count Last Year']) || null,
        yearsExperience: null, // Not provided by this scraper
        priceRangeMin: parseInt(matchingAgent['Sale Price Range (Min)']) || null,
        priceRangeMax: parseInt(matchingAgent['Sale Price Range (Max)']) || null,
        isTopAgent: matchingAgent['Is Top Agent'] === 'TRUE' || matchingAgent['Is Top Agent'] === true,
        isTeamLead: matchingAgent['Is Team Lead'] === 'TRUE' || matchingAgent['Is Team Lead'] === true,
        profileUrl: matchingAgent['Profile Link'] || null,
        location: matchingAgent['Location'] || null,
      },
      rawDataSample: matchingAgent // For debugging
    };

    console.log('Successfully formatted agent data for:', formattedData.stats.fullName);

    return new Response(
      JSON.stringify(formattedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-getdataforme-agent-stats:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
