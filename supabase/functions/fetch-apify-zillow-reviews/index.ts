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

    // Try multiple Apify actors to maximize review coverage
    const profileUrl = `https://www.zillow.com/profile/${zuid}`;
    const ACTORS = [
      'getdataforme~zillow-real-state-agents-scraper',
      'getdataforme~zillow-agents-reviews-scraper',
    ];

    async function runActorAndCollect(actorSlug: string) {
      console.log(`Starting Apify actor: ${actorSlug} for ${profileUrl}`);
      const startRes = await fetch(
        `https://api.apify.com/v2/acts/${actorSlug}/runs?token=${APIFY_API_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentProfileUrl: profileUrl,
            profileUrl,
            maxReviews: 100,
            maxItems: 200,
            proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
          }),
        }
      );

      if (!startRes.ok) {
        const t = await startRes.text();
        console.warn(`Actor ${actorSlug} failed to start:`, startRes.status, t);
        return { reviews: [], totalReviews: 0, averageRating: 0 };
      }

      const startData = await startRes.json();
      const runId = startData.data.id as string;
      console.log(`Apify run started (${actorSlug}): ${runId}`);

      // Poll for completion
      let attempts = 0;
      let runStatus = 'RUNNING';
      while (runStatus === 'RUNNING' && attempts < 60) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
        const statusRes = await fetch(
          `https://api.apify.com/v2/acts/${actorSlug}/runs/${runId}?token=${APIFY_API_TOKEN}`
        );
        if (statusRes.ok) {
          const status = await statusRes.json();
          runStatus = status.data.status;
          console.log(`Status (${actorSlug}): ${runStatus} (attempt ${attempts}/60)`);
        }
      }

      if (runStatus !== 'SUCCEEDED') {
        console.warn(`Actor ${actorSlug} did not succeed: ${runStatus}`);
        return { reviews: [], totalReviews: 0, averageRating: 0 };
      }

      // Fetch dataset items
      const datasetId = startData.data.defaultDatasetId as string;
      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&limit=500&token=${APIFY_API_TOKEN}`
      );
      if (!itemsRes.ok) {
        console.warn(`Actor ${actorSlug} dataset fetch failed`);
        return { reviews: [], totalReviews: 0, averageRating: 0 };
      }
      const items = await itemsRes.json();
      const itemsArr = Array.isArray(items) ? items : [];
      console.log(`Retrieved ${itemsArr.length} items from ${actorSlug}`);

      // Extract nested reviews from common keys
      const first = itemsArr[0] || {};
      const nested = Array.isArray(first?.reviews)
        ? first.reviews
        : Array.isArray(first?.agentReviews)
        ? first.agentReviews
        : Array.isArray(first?.reviewsList)
        ? first.reviewsList
        : [];

      const itemLevel = itemsArr.filter((it: any) =>
        it.reviewText || it.text || it.body || it.review
      );

      let combined = [
        ...nested.map(mapReview),
        ...itemLevel.map(mapReview),
      ];

      // Deduplicate by text+date
      const seen = new Set<string>();
      combined = combined.filter((r) => {
        const key = `${r.reviewText}__${r.reviewDate}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const total = first?.totalReviews || first?.reviewsCount || combined.length;
      const avg = first?.averageRating || first?.rating || (combined.length
        ? Number((combined.reduce((s, r) => s + (Number(r.rating) || 0), 0) / combined.length).toFixed(2))
        : 0);

      return { reviews: combined, totalReviews: Number(total) || 0, averageRating: Number(avg) || 0 };
    }

    // Aggregate across actors
    let aggregated: any[] = [];
    let totalFromActor = 0;
    let avgFromActor = 0;

    for (const actor of ACTORS) {
      const { reviews: r, totalReviews: tr, averageRating: ar } = await runActorAndCollect(actor);
      aggregated = [...aggregated, ...r];
      totalFromActor = Math.max(totalFromActor, tr);
      avgFromActor = ar || avgFromActor;

      // Early exit if we have plenty
      if (aggregated.length >= 20) break;
    }

    // Final de-dup across actors
    const seenFinal = new Set<string>();
    const combined = aggregated.filter((r) => {
      const key = `${r.reviewText}__${r.reviewDate}`;
      if (seenFinal.has(key)) return false;
      seenFinal.add(key);
      return true;
    });

    const avgFinal = combined.length
      ? Number((combined.reduce((s, r) => s + (Number(r.rating) || 0), 0) / combined.length).toFixed(2))
      : 0;

    const result = {
      reviews: combined.slice(0, 30),
      totalReviews: totalFromActor || combined.length,
      averageRating: avgFromActor || avgFinal,
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
