import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { zuid } = await req.json();
    
    if (!zuid) {
      throw new Error('ZUID is required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN')?.trim();

    if (!APIFY_API_TOKEN) {
      throw new Error('Apify API token not configured');
    }

    console.log(`Fetching reviews for ZUID: ${zuid} using Apify`);

    // Start the Apify actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/getdataforme~zillow-agents-reviews-scraper/runs?token=${APIFY_API_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentProfileUrl: `https://www.zillow.com/profile/${zuid}`,
          proxy: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
          }
        })
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start Apify run:', runResponse.status, errorText);
      throw new Error(`Failed to start Apify actor: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Apify run started: ${runId}`);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60;
    let runStatus = 'RUNNING';

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/getdataforme~zillow-agents-reviews-scraper/runs/${runId}?token=${APIFY_API_TOKEN}`
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        runStatus = statusData.data.status;
        console.log(`Status: ${runStatus} (attempt ${attempts}/${maxAttempts})`);
      }
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Actor run did not complete successfully: ${runStatus}`);
    }

    // Fetch results from dataset
    const datasetId = runData.data.defaultDatasetId;
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`
    );

    if (!datasetResponse.ok) {
      throw new Error('Failed to fetch dataset');
    }

    const data = await datasetResponse.json();
    console.log(`Retrieved ${data.length} items from dataset`);

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ reviews: [], totalReviews: 0, averageRating: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentData = data[0];
    const reviews = (agentData.reviews || []).map((review: any) => ({
      reviewerName: review.reviewerName || 'Anonymous',
      reviewText: review.reviewText || '',
      rating: review.rating || 0,
      reviewDate: review.reviewDate || ''
    }));

    const result = {
      reviews: reviews.slice(0, 10),
      totalReviews: agentData.totalReviews || reviews.length,
      averageRating: agentData.averageRating || 0
    };

    console.log(`Returning ${result.reviews.length} reviews, total: ${result.totalReviews}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-apify-zillow-reviews function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
