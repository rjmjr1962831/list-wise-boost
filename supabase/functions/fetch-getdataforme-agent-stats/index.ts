import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyAgentRequest {
  profileUrl?: string;
  zipcode?: string;
  location?: string;
  agentName?: string;
  apifyApiKey?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl, zipcode, location: inputLocation, agentName, apifyApiKey }: ApifyAgentRequest = await req.json();

    // Need either zipcode or profileUrl
    if (!zipcode && !profileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Either zipcode or profileUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = apifyApiKey || Deno.env.get('APIFY_API_KEY') || Deno.env.get('APIFY_API_TOKEN');
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

    let searchZipcode = zipcode || inputLocation || null;
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
    // Determine actor to use (sanitize misconfigured secrets)
    const rawActor = Deno.env.get('APIFY_ACTOR_ID') || '';
    const actorId = (rawActor && !rawActor.startsWith('apify_api_') && rawActor.includes('~'))
      ? rawActor
      : 'agenscrape~zillow-agents-finder';
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify((() => {
          const isZillowAgentsFinder = actorId.includes('zillow-agents');
          if (isZillowAgentsFinder) {
            return {
              query: [profileUrl || `${agentName || ''} ${searchZipcode || ''}`.trim()].filter(Boolean),
              limit: 10,
              'filters.location': `${searchZipcode}`,
              'filters.agent_info': true,
            };
          }
          // Default for other actors
          return { location: searchZipcode };
        })())
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start actor:', runResponse.status, runResponse.statusText, errorText);
      let detail: any = undefined;
      try { detail = JSON.parse(errorText); } catch {}
      const errMsg = detail?.error?.message || errorText || runResponse.statusText;
      const statusCode = runResponse.status || 500;
      // Do not bubble up a non-2xx to the client; return 200 with success=false so UI can handle gracefully
      return new Response(
        JSON.stringify({ success: false, error: `Failed to start scraper: ${errMsg}`, status: statusCode, actorId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
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
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
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

    // Flexible field extraction helpers for different actors
    const get = (obj: any, keys: string[]) => {
      for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).length) return obj[k];
      }
      return null;
    };
    const getNum = (obj: any, keys: string[]) => {
      const v = get(obj, keys);
      if (v === null) return null;
      const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? null : n;
    };
    const getFloat = (obj: any, keys: string[]) => {
      const v = get(obj, keys);
      if (v === null) return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return isNaN(n) ? null : n;
    };

    const fullName = get(matchingAgent, ['Full Name','full_name','name','Agent Name','agent_name']);
    const brokerage = get(matchingAgent, ['Business Name','brokerage','company','office']);
    const starRating = getFloat(matchingAgent, ['Review Stars Rating','rating','star_rating']);
    const totalReviews = getNum(matchingAgent, ['Total Reviews','reviews','reviews_count','reviewCount']);
    const phoneNumber = get(matchingAgent, ['Phone Number','phone','phone_number']);
    const profileLink = get(matchingAgent, ['Profile Link','profile_url','url','link']);

    const extractZipCode = (loc: string) => {
      if (!loc) return null;
      const zipMatch = loc.match(/\b(\d{5})(?:-\d{4})?\b/);
      return zipMatch ? zipMatch[1] : null;
    };

    const location = get(matchingAgent, ['Location','Address','location','address']);
    const zipCode = extractZipCode(String(location || ''));

    const totalSales = getNum(matchingAgent, ['Sale Count All Time','total_sales','sales_all_time']);
    const salesLastYear = getNum(matchingAgent, ['Sale Count Last Year','sales_last_year','sales_12_months']);
    const priceRangeMin = getNum(matchingAgent, ['Sale Price Range (Min)','price_min']);
    const priceRangeMax = getNum(matchingAgent, ['Sale Price Range (Max)','price_max']);
    const isTopAgent = ['Is Top Agent','is_top_agent','top_agent'].some(k => matchingAgent[k] === true || matchingAgent[k] === 'TRUE');
    const isTeamLead = ['Is Team Lead','is_team_lead','team_lead'].some(k => matchingAgent[k] === true || matchingAgent[k] === 'TRUE');

    console.log('Found matching agent:', fullName);

    const formattedData = {
      success: true,
      stats: {
        fullName: fullName || null,
        brokerage: brokerage || null,
        starRating: starRating,
        totalReviews: totalReviews,
        phoneNumber: phoneNumber || null,
        currentListings: null, // Not provided by all scrapers
        totalSales: totalSales,
        salesLastYear: salesLastYear,
        yearsExperience: null, // Not provided by all scrapers
        priceRangeMin: priceRangeMin,
        priceRangeMax: priceRangeMax,
        isTopAgent: isTopAgent,
        isTeamLead: isTeamLead,
        profileUrl: profileLink || null,
        location: location || null,
        zipCode: zipCode || null,
        // Include some extra fields for debugging/LLM usefulness
        city: get(matchingAgent, ['City','city']) || null,
        state: get(matchingAgent, ['State','state']) || null,
        address: get(matchingAgent, ['Address','address']) || null,
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
