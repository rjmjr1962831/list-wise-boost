import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { citySlug } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyToken = Deno.env.get('APIFY_API_TOKEN')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Starting Zillow reviews fetch for city: ${citySlug || 'all'}`);

    // Query agents needing review enrichment
    let query = supabase
      .from('professionals')
      .select('id, name, zillow_profile_url, reviews_data')
      .eq('active', true)
      .not('zillow_profile_url', 'is', null);

    // Filter by city if specified
    if (citySlug) {
      const { data: city } = await supabase
        .from('cities')
        .select('id')
        .eq('slug', citySlug)
        .single();
      
      if (city) {
        query = query.eq('city_id', city.id);
      }
    }

    const { data: agents, error: queryError } = await query;

    if (queryError) throw queryError;

    // Filter agents missing zillow_reviews or with stale data (>30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const agentsNeedingReviews = agents?.filter(agent => {
      const reviewsData = agent.reviews_data as any;
      if (!reviewsData?.zillow_reviews || !Array.isArray(reviewsData.zillow_reviews)) {
        return true; // Missing reviews
      }
      
      // Check if data is stale
      if (reviewsData.zillow_reviews_fetched_at) {
        const fetchedAt = new Date(reviewsData.zillow_reviews_fetched_at);
        return fetchedAt < thirtyDaysAgo;
      }
      
      return false; // Has fresh reviews
    }) || [];

    console.log(`Found ${agentsNeedingReviews.length} agents needing review enrichment`);

    if (agentsNeedingReviews.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'All agents have fresh Zillow reviews cached',
          processed: 0,
          total: agents?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Start background task
    const backgroundTask = async () => {
      const batchSize = 10;
      let processed = 0;
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < agentsNeedingReviews.length; i += batchSize) {
        const batch = agentsNeedingReviews.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} agents)`);

        // Prepare Apify input
        const profileUrls = batch
          .map(agent => agent.zillow_profile_url)
          .filter((url): url is string => !!url);

        if (profileUrls.length === 0) continue;

        try {
          // Start Apify actor
          const actorResponse = await fetch(
            `https://api.apify.com/v2/acts/memo23~apify-zillow-agents-cheerio/runs?token=${apifyToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                profileUrls,
                maxConcurrency: 5,
                proxyConfiguration: { useApifyProxy: true }
              })
            }
          );

          const actorResult = await actorResponse.json();
          const runId = actorResult.data.id;

          console.log(`Apify run started: ${runId}`);

          // Poll for completion
          let runStatus = 'RUNNING';
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes max

          while (runStatus === 'RUNNING' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
            
            const statusResponse = await fetch(
              `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
            );
            const statusData = await statusResponse.json();
            runStatus = statusData.data.status;
            attempts++;
            
            console.log(`Run status: ${runStatus} (attempt ${attempts})`);
          }

          if (runStatus !== 'SUCCEEDED') {
            console.error(`Apify run failed or timed out: ${runStatus}`);
            failed += batch.length;
            continue;
          }

          // Fetch results
          const datasetResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
          );
          const scrapedData = await datasetResponse.json();

          console.log(`Fetched ${scrapedData.length} results from Apify`);

          // Update each agent with their reviews
          for (const agent of batch) {
            try {
              const scrapedAgent = scrapedData.find((item: any) => 
                item.profileLink && agent.zillow_profile_url?.includes(item.profileLink)
              );

              if (!scrapedAgent?.reviewsData?.reviews) {
                console.log(`No reviews found for ${agent.name}`);
                continue;
              }

              const reviews = scrapedAgent.reviewsData.reviews;
              
              // Update reviews_data with zillow_reviews
              const existingReviewsData = (agent.reviews_data as any) || {};
              const updatedReviewsData = {
                ...existingReviewsData,
                zillow_reviews: reviews,
                zillow_reviews_fetched_at: new Date().toISOString()
              };

              const { error: updateError } = await supabase
                .from('professionals')
                .update({ reviews_data: updatedReviewsData })
                .eq('id', agent.id);

              if (updateError) {
                console.error(`Failed to update ${agent.name}:`, updateError);
                failed++;
              } else {
                console.log(`✓ Updated ${agent.name} with ${reviews.length} reviews`);
                successful++;
              }
            } catch (err) {
              console.error(`Error processing ${agent.name}:`, err);
              failed++;
            }
          }

          processed += batch.length;
          
        } catch (batchError) {
          console.error(`Batch processing error:`, batchError);
          failed += batch.length;
        }
      }

      console.log(`\n=== Bulk Zillow Reviews Fetch Complete ===`);
      console.log(`Total processed: ${processed}`);
      console.log(`Successful: ${successful}`);
      console.log(`Failed: ${failed}`);
    };

    // Start background task
    EdgeRuntime.waitUntil(backgroundTask());

    return new Response(
      JSON.stringify({ 
        message: `Started background task to fetch reviews for ${agentsNeedingReviews.length} agents`,
        total: agentsNeedingReviews.length,
        city: citySlug || 'all'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-fetch-zillow-reviews:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
