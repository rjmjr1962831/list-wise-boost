import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentName, city, state } = await req.json();
    
    if (!agentName) {
      return new Response(JSON.stringify({ error: 'Agent name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Construct search query - looking for press mentions, awards, features
    const searchQuery = `"${agentName}" "${city}" ${state} real estate (award OR featured OR recognized OR "top agent" OR news)`;
    console.log(`🔍 Searching press mentions: ${searchQuery}`);

    // Start Apify actor run for Google Search
    const actorInput = {
      queries: searchQuery,
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      languageCode: "en",
      mobileResults: false,
      includeUnfilteredResults: false
    };

    const runResponse = await fetch('https://api.apify.com/v2/acts/apify~google-search-scraper/runs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(actorInput)
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('❌ Apify actor start failed:', runResponse.status, errorText);
      throw new Error(`Apify actor start failed: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`✅ Apify run started: ${runId}`);

    // Poll for completion (max 30 seconds)
    let attempts = 0;
    const maxAttempts = 15; // 30 seconds with 2s intervals
    let runStatus = runData.data.status;

    while (runStatus !== 'SUCCEEDED' && runStatus !== 'FAILED' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${APIFY_API_TOKEN}` }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        runStatus = statusData.data.status;
        console.log(`⏳ Apify run status: ${runStatus} (attempt ${attempts}/${maxAttempts})`);
      }
    }

    if (runStatus !== 'SUCCEEDED') {
      console.error(`❌ Apify run failed or timed out: ${runStatus}`);
      return new Response(JSON.stringify({ mentions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the dataset ID from the final status check
    const finalStatusResponse = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}`, {
      headers: { 'Authorization': `Bearer ${APIFY_API_TOKEN}` }
    });

    if (!finalStatusResponse.ok) {
      console.error(`❌ Failed to get final run status: ${finalStatusResponse.status}`);
      return new Response(JSON.stringify({ mentions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const finalStatusData = await finalStatusResponse.json();
    const datasetId = finalStatusData.data.defaultDatasetId;
    
    if (!datasetId) {
      console.error('❌ No dataset ID found in run data');
      return new Response(JSON.stringify({ mentions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📦 Fetching dataset ${datasetId}...`);

    // Fetch results using the dataset ID
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`
    );

    console.log(`📦 Dataset fetch response status: ${resultsResponse.status}`);

    if (!resultsResponse.ok) {
      const errorText = await resultsResponse.text();
      console.error(`❌ Failed to fetch Apify dataset: ${resultsResponse.status} - ${errorText}`);
      
      // Return empty results instead of throwing - don't fail the whole enrichment
      return new Response(JSON.stringify({ mentions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = await resultsResponse.json();
    console.log(`📊 Received ${results?.length || 0} raw search results`);

    if (!results || !Array.isArray(results) || results.length === 0) {
      console.log('ℹ️ No search results returned from Apify');
      return new Response(JSON.stringify({ mentions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filter and format results
    const excludedDomains = [
      'zillow.com', 'realtor.com', 'facebook.com', 'linkedin.com', 
      'instagram.com', 'twitter.com', 'x.com', 'yelp.com', 'redfin.com',
      'homes.com', 'trulia.com'
    ];

    const pressMentions = results
      .filter((result: any) => {
        if (!result || !result.url) return false;
        
        // Exclude irrelevant domains
        const urlLower = result.url.toLowerCase();
        if (excludedDomains.some(domain => urlLower.includes(domain))) {
          return false;
        }
        
        // Must have a title
        if (!result.title || typeof result.title !== 'string' || result.title.length < 10) return false;
        
        return true;
      })
      .slice(0, 5) // Limit to top 5 mentions
      .map((result: any) => {
        try {
          const hostname = new URL(result.url).hostname.replace('www.', '');
          return {
            title: result.title,
            source: hostname,
            url: result.url,
            snippet: result.description || '',
            date: new Date().toISOString().split('T')[0]
          };
        } catch (error) {
          console.error('Error parsing result URL:', result.url, error);
          return null;
        }
      })
      .filter(Boolean); // Remove any null entries from URL parsing errors

    console.log(`✅ Filtered to ${pressMentions.length} press mentions`);

    return new Response(JSON.stringify({ mentions: pressMentions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in search-agent-press:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      mentions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
