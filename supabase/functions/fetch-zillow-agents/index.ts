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
    const { city, state } = await req.json();
    
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')?.trim();
    const RAPIDAPI_HOST = Deno.env.get('RAPIDAPI_HOST')?.trim();

    if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
      throw new Error('RapidAPI credentials not configured');
    }

    // Format location for the API (City, State format)
    const location = `${city}, ${state}`;
    
    console.log(`Fetching agents for ${location}`);

    // Aggregate search: API requires a name term; iterate common fragments until we collect results
    const fragments = ['a','e','i','o','u','s','m','c','b','t','r','n'];

    const dedup = new Map<string, any>();

    for (const frag of fragments) {
      try {
        const url = `https://${RAPIDAPI_HOST}/?data_type=search_agents&name=${encodeURIComponent(frag)}&location=${encodeURIComponent(location)}&page_number=1`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': RAPIDAPI_HOST,
          },
        });

        if (!resp.ok) {
          const txt = await resp.text();
          console.warn('Partial fetch error', resp.status, txt);
          continue;
        }

        const data = await resp.json();
        const arr = data?.agents || data?.results || data?.data || (Array.isArray(data) ? data : []);
        console.log(`Fragment '${frag}' returned ${Array.isArray(arr) ? arr.length : 0} items`);

        if (Array.isArray(arr)) {
          for (const item of arr) {
            const a = item || {};
            const normalized = {
              fullName: a.fullName || a.name || a.agentName || null,
              businessName: a.businessName || a.company || a.brokerage || null,
              phoneNumber: a.phoneNumber || a.phone || a.contactPhone || null,
              profilePhotoSrc: a.profilePhotoSrc || a.photo || a.image || a.avatar || null,
              profileLink: a.profileLink || a.profile_url || a.url || null,
              reviewExcerpt: a.reviewExcerpt || a.latestReview || a.topReview || null,
              zuid: a.zuid || a.id || a.zillowUserId || null,
            };

            const key = normalized.zuid || normalized.profileLink || `${normalized.fullName}|${normalized.businessName}`;
            if (key && !dedup.has(key)) dedup.set(key, normalized);
          }
        }

        // Stop early if we have enough
        if (dedup.size >= 30) break;
      } catch (e) {
        console.error('Error on fragment fetch', frag, e);
        continue;
      }
    }

    const agents = Array.from(dedup.values()).slice(0, 50);
    console.log('Total aggregated agents:', agents.length);

    return new Response(JSON.stringify(agents), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-zillow-agents function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
