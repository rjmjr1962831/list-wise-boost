import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyAgentRequest {
  profileUrl?: string;
  zipcode?: string;
  agentName?: string;
  apifyApiKey?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl, zipcode, agentName, apifyApiKey }: ApifyAgentRequest = await req.json();

    // Need either zipcode or profileUrl
    if (!zipcode && !profileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Either zipcode or profileUrl is required' }),
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

    // Default zipcodes for Arizona cities (Gilbert area)
    const DEFAULT_ZIPCODES: { [key: string]: string } = {
      'gilbert': '85295',
      'phoenix': '85004',
      'scottsdale': '85251',
      'chandler': '85224',
      'mesa': '85201',
      'tempe': '85281',
      'peoria': '85382',
      'glendale': '85301',
    };

    let searchZipcode = zipcode;
    let agentSlug = '';
    let searchName = agentName;

    // If profileUrl provided, extract agent info
    if (profileUrl) {
      const urlParts = profileUrl.split('/');
      agentSlug = urlParts[urlParts.length - 1].toLowerCase();
      searchName = searchName || agentSlug.replace(/-/g, ' ');
      
      // If no zipcode provided, use default for Gilbert
      if (!searchZipcode) {
        searchZipcode = DEFAULT_ZIPCODES['gilbert'];
        console.log(`No zipcode provided, using default Gilbert zipcode: ${searchZipcode}`);
      }
    }

    console.log('Starting Apify zillow-agent-scraper with:', { 
      zipcode: searchZipcode, 
      agentName: searchName 
    });

    // CRITICAL: Require zipcode for accuracy
    if (!searchZipcode) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Zip code is required. Please add zip codes in the admin panel first.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Start the actor run - CRITICAL: Use zipcode parameter, not location!
    // IMPORTANT: Use tilde (~) not slash (/) in API calls
    const actorId = 'scraped~zillow-agent-scraper';
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipcode: searchZipcode  // MUST use zipcode, not location!
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

    // Find the matching agent by URL or name
    let matchingAgent;
    
    if (agentSlug) {
      // Search by profile URL slug
      matchingAgent = rawData.find((agent: any) => {
        const agentProfileUrl = agent['Profile Link'] || '';
        return agentProfileUrl.toLowerCase().includes(agentSlug);
      });
    } else if (searchName) {
      // Search by name
      matchingAgent = rawData.find((agent: any) => {
        const fullName = agent['Full Name'] || '';
        return fullName.toLowerCase().includes(searchName.toLowerCase());
      });
    } else {
      // Return all agents if no filter
      matchingAgent = rawData[0];
    }

    if (!matchingAgent) {
      console.log('No matching agent found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          stats: null, 
          message: 'Agent not found in results',
          totalAgentsFound: rawData.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found matching agent:', matchingAgent['Full Name']);
    
    // Extract zip code from location or address fields
    const extractZipCode = (location: string) => {
      if (!location) return null;
      // Match 5-digit zip code or 5+4 format
      const zipMatch = location.match(/\b(\d{5})(?:-\d{4})?\b/);
      return zipMatch ? zipMatch[1] : null;
    };
    
    const location = matchingAgent['Location'] || matchingAgent['Address'] || null;
    const zipCode = extractZipCode(location);
    
    console.log('Extracted location:', location);
    console.log('Extracted zip code:', zipCode);
    
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
        location: location,
        zipCode: zipCode,
        // Include all available fields for debugging
        city: matchingAgent['City'] || null,
        state: matchingAgent['State'] || null,
        address: matchingAgent['Address'] || null,
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
