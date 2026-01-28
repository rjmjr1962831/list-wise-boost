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

/**
 * Paraphrase a review using Lovable AI (Gemini Flash) to avoid verbatim copying
 */
async function paraphraseReview(reviewText: string, reviewerName: string, lovableApiKey: string): Promise<string> {
  if (!reviewText || reviewText.length < 20) return reviewText;
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Cheapest/fastest for simple rewording
        messages: [
          { 
            role: 'system', 
            content: `You are a professional editor. Rework the given customer review to convey the same meaning and sentiment without copying it verbatim. Keep the same length and tone. Do NOT add or remove information. Do NOT change the rating implication. Output ONLY the reworded review text, nothing else.`
          },
          { 
            role: 'user', 
            content: `Rework this customer review by ${reviewerName} while preserving the exact meaning and sentiment:\n\n"${reviewText}"`
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error(`Paraphrase API error: ${response.status}`);
      return reviewText; // Fallback to original
    }

    const data = await response.json();
    const paraphrased = data.choices?.[0]?.message?.content?.trim();
    
    if (paraphrased && paraphrased.length > 10) {
      return paraphrased;
    }
    return reviewText;
  } catch (error) {
    console.error('Paraphrase error:', error);
    return reviewText; // Fallback to original on error
  }
}

/**
 * Paraphrase multiple reviews in parallel with rate limiting
 */
async function paraphraseReviews(reviews: any[], lovableApiKey: string): Promise<any[]> {
  const paraphrasedReviews = [];
  const batchSize = 5; // Process 5 reviews at a time to avoid rate limits
  
  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (review) => {
        const paraphrasedText = await paraphraseReview(
          review.reviewText || review.text || '',
          review.reviewerName || review.reviewer || 'Customer',
          lovableApiKey
        );
        
        return {
          ...review,
          reviewText: paraphrasedText,
          text: paraphrasedText,
          originalTextHash: review.reviewText?.substring(0, 50) || '', // Keep a hash for reference
          paraphrased: true
        };
      })
    );
    
    paraphrasedReviews.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < reviews.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return paraphrasedReviews;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { citySlug } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyToken = Deno.env.get('APIFY_API_TOKEN')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
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

              let reviews = scrapedAgent.reviewsData.reviews;
              
              // PARAPHRASE REVIEWS to avoid verbatim copying
              console.log(`Paraphrasing ${reviews.length} reviews for ${agent.name}...`);
              reviews = await paraphraseReviews(reviews, lovableApiKey);
              console.log(`✓ Paraphrased ${reviews.length} reviews for ${agent.name}`);
              
              // Update reviews_data with zillow_reviews
              const existingReviewsData = (agent.reviews_data as any) || {};
              const updatedReviewsData = {
                ...existingReviewsData,
                zillow_reviews: reviews,
                zillow_reviews_fetched_at: new Date().toISOString(),
                zillow_reviews_paraphrased: true
              };

              const { error: updateError } = await supabase
                .from('professionals')
                .update({ reviews_data: updatedReviewsData })
                .eq('id', agent.id);

              if (updateError) {
                console.error(`Failed to update ${agent.name}:`, updateError);
                failed++;
              } else {
                console.log(`✓ Updated ${agent.name} with ${reviews.length} paraphrased reviews`);
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
        message: `Started background task to fetch & paraphrase reviews for ${agentsNeedingReviews.length} agents`,
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