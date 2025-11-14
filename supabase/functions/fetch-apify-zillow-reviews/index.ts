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
    const { zuid, agentName, location, profileUrl: inputProfileUrl } = await req.json();
    
    if (!zuid && !agentName && !inputProfileUrl) {
      throw new Error('Provide either ZUID, agentName+location, or profileUrl');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN')?.trim();

    if (!APIFY_API_TOKEN) {
      throw new Error('Apify API token not configured');
    }

    // Resolve profileUrl from inputs or discover by name+location
    let profileUrl: string | undefined = inputProfileUrl || (zuid ? `https://www.zillow.com/profile/${zuid}` : undefined);

    // If we don't have a direct profile URL, try to discover it via search actors
    if (!profileUrl && agentName) {
      // COMMENTED OUT: Using jupri/zillow-agents instead
      /*
      const DISCOVERY_ACTORS = [
        'getdataforme~zillow-agent-scraper',
      ];
      */
      const DISCOVERY_ACTORS = [
        'jupri~zillow-agents',
      ];

      async function discoverProfileUrl(actorSlug: string): Promise<string | undefined> {
        console.log(`Discovering profile with ${actorSlug} for`, { agentName, location });
        const startRes = await fetch(
          `https://api.apify.com/v2/acts/${actorSlug}/runs?token=${APIFY_API_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: [agentName, `${agentName} ${location ?? ''}`.trim()],
              limit: 10,
              ...(location ? { filters: { location } } : {}),
            }),
          }
        );
        if (!startRes.ok) {
          const t = await startRes.text();
          console.warn(`Discovery actor ${actorSlug} failed to start:`, startRes.status, t);
          return undefined;
        }
        const startData = await startRes.json();
        const runId = startData.data.id as string;

        let attempts = 0;
        let runStatus = 'RUNNING';
        while (runStatus === 'RUNNING' && attempts < 45) {
          await new Promise((r) => setTimeout(r, 1500));
          attempts++;
          const statusRes = await fetch(
            `https://api.apify.com/v2/acts/${actorSlug}/runs/${runId}?token=${APIFY_API_TOKEN}`
          );
          if (statusRes.ok) {
            const status = await statusRes.json();
            runStatus = status.data.status;
          }
        }
        if (runStatus !== 'SUCCEEDED') return undefined;

        const datasetId = startData.data.defaultDatasetId as string;
        const itemsRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&limit=100&token=${APIFY_API_TOKEN}`
        );
        if (!itemsRes.ok) return undefined;
        const items = await itemsRes.json();
        const arr: any[] = Array.isArray(items) ? items : [];

        const normName = (agentName || '').toLowerCase();
        for (const it of arr) {
          const candidates = [
            it?.profileUrl,
            it?.agentProfileUrl,
            it?.zillowUrl,
            it?.detailUrl,
            it?.url,
            it?.profile,
            it?.agent?.profileUrl,
          ].filter(Boolean) as string[];

          const displayName = (it?.name || it?.agentName || it?.agent?.name || '').toLowerCase();
          const nameMatches = normName && displayName.includes(normName);

          const found = candidates.find((u) => typeof u === 'string' && u.includes('zillow.com/profile/'));
          if (found && (nameMatches || candidates.length > 0)) {
            console.log('Discovered Zillow profile:', found);
            return found.split('?')[0];
          }
        }
        return undefined;
      }

      for (const a of DISCOVERY_ACTORS) {
        profileUrl = await discoverProfileUrl(a);
        if (profileUrl) break;
      }
    }

    if (!profileUrl) {
      console.warn('Could not resolve Zillow profile URL');
      return new Response(JSON.stringify({ reviews: [], totalReviews: 0, averageRating: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try multiple Apify actors to maximize review coverage
    // COMMENTED OUT: Using jupri/zillow-agents instead
    /*
    const ACTORS = [
      'getdataforme~zillow-real-state-agents-scraper',
      'getdataforme~zillow-agents-reviews-scraper',
    ];
    */
    const ACTORS = [
      'jupri~zillow-agents',
    ];

    async function runActorAndCollect(actorSlug: string) {
      console.log(`Starting Apify actor: ${actorSlug} for ${profileUrl}`);
      const screenName = profileUrl && profileUrl.includes('/profile/')
        ? profileUrl.split('/profile/')[1]?.split(/[\/?#]/)[0]
        : undefined;
      const queries = [
        profileUrl,
        ...(screenName ? [`@${screenName}/reviews`] : []),
      ].filter(Boolean);
      const startRes = await fetch(
        `https://api.apify.com/v2/acts/${actorSlug}/runs?token=${APIFY_API_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: queries,
            limit: 100,
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
      if (ar) avgFromActor = ar;

      // Early exit if we have plenty
      if (aggregated.length >= 30) break;
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
      profileUrl: profileUrl,
    };

    console.log(`Returning ${result.reviews.length} reviews (combined=${combined.length}), total: ${result.totalReviews}, profileUrl=${result.profileUrl}`);

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
