import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function mapReview(item: any) {
  return {
    reviewerName: item.reviewerName || item.name || item.reviewer || 'Anonymous',
    reviewText: item.reviewText || item.text || item.body || item.review || '',
    rating: Number(item.rating ?? item.stars ?? item.score ?? 0),
    reviewDate: item.reviewDate || item.date || item.publishedAt || item.time || ''
  };
}

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

    console.log(`Fetching reviews for ZUID: ${zuid} using Apify (zillow-real-state-agents-scraper)`);

    // Start the Apify actor run using the real estate agents scraper
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/getdataforme~zillow-real-state-agents-scraper/runs?token=${APIFY_API_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentProfileUrl: `https://www.zillow.com/profile/${zuid}`,
          maxReviews: 50,
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/getdataforme~zillow-real-state-agents-scraper/runs/${runId}?token=${APIFY_API_TOKEN}`
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

    // Fetch results from dataset, request plenty of items just in case actor outputs one item per review
    const datasetId = runData.data.defaultDatasetId;
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&limit=200&token=${APIFY_API_TOKEN}`
    );

    if (!datasetResponse.ok) {
      throw new Error('Failed to fetch dataset');
    }

    const data = await datasetResponse.json();
    console.log(`Retrieved ${Array.isArray(data) ? data.length : 0} items from dataset`);

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ reviews: [], totalReviews: 0, averageRating: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Some actors return a single item with nested `reviews` array; others return items per review.
    const nestedReviews = Array.isArray(data[0]?.reviews) ? data[0].reviews : [];
    const itemLevelReviews = data.filter((it: any) => 
      it.reviewText || it.text || it.body || it.review
    );

    let combined = [
      ...nestedReviews.map(mapReview),
      ...itemLevelReviews.map(mapReview)
    ];

    // Deduplicate by text+date to avoid duplicates between nested and item-level
    const seen = new Set<string>();
    combined = combined.filter((r) => {
      const key = `${r.reviewText}__${r.reviewDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Compute average rating if missing
    const avg = combined.length
      ? combined.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / combined.length
      : 0;

    const result = {
      reviews: combined.slice(0, 10),
      totalReviews: data[0]?.totalReviews || combined.length,
      averageRating: data[0]?.averageRating || Number(avg.toFixed(2))
    };

    console.log(`Returning ${result.reviews.length} reviews (combined=${combined.length}), total: ${result.totalReviews}`);

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
