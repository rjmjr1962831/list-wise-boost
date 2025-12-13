import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// IndexNow API configuration
const INDEXNOW_KEY = "c24fefbb226c4059afbfa6c5cbce8639";
const INDEXNOW_HOST = "www.top10lists.us";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, submitAll } = await req.json();
    
    console.log('[IndexNow] Request received:', { urlCount: urls?.length, submitAll });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let urlList: string[] = [];

    if (submitAll) {
      // Get all active Arizona cities and generate URLs
      console.log('[IndexNow] Fetching all active Arizona cities...');
      
      const { data: cities, error: citiesError } = await supabase
        .from('cities')
        .select('slug, state_slug')
        .eq('active', true)
        .eq('state_slug', 'arizona');

      if (citiesError) {
        throw new Error(`Failed to fetch cities: ${citiesError.message}`);
      }

      // Generate city page URLs
      for (const city of cities || []) {
        urlList.push(`https://www.top10lists.us/${city.state_slug}/${city.slug}/top10realestateagents`);
        urlList.push(`https://www.top10lists.us/${city.state_slug}/${city.slug}`);
      }

      // Add static pages
      urlList.push('https://www.top10lists.us/');
      urlList.push('https://www.top10lists.us/about');
      urlList.push('https://www.top10lists.us/about/ranking-methodology');
      urlList.push('https://www.top10lists.us/faq');
      urlList.push('https://www.top10lists.us/for-agents');
      urlList.push('https://www.top10lists.us/compare');
      urlList.push('https://www.top10lists.us/test');

      console.log(`[IndexNow] Generated ${urlList.length} URLs from ${cities?.length} cities`);
    } else if (urls && Array.isArray(urls)) {
      urlList = urls;
      console.log(`[IndexNow] Using ${urlList.length} provided URLs`);
    } else {
      throw new Error('Either urls array or submitAll flag is required');
    }

    if (urlList.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No URLs to submit' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // IndexNow allows up to 10,000 URLs per request
    const batchSize = 10000;
    const results: { batch: number; status: number; submitted: number }[] = [];

    for (let i = 0; i < urlList.length; i += batchSize) {
      const batch = urlList.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(`[IndexNow] Submitting batch ${batchNumber}: ${batch.length} URLs`);

      const payload = {
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: batch
      };

      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log(`[IndexNow] Batch ${batchNumber} response: ${response.status}`);
      
      results.push({
        batch: batchNumber,
        status: response.status,
        submitted: batch.length
      });

      // If error, log response body
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[IndexNow] Batch ${batchNumber} error:`, errorText);
      }
    }

    const totalSubmitted = results.reduce((sum, r) => sum + r.submitted, 0);
    const allSuccess = results.every(r => r.status >= 200 && r.status < 300);

    console.log(`[IndexNow] Complete: ${totalSubmitted} URLs submitted, success: ${allSuccess}`);

    return new Response(
      JSON.stringify({
        success: allSuccess,
        totalUrls: totalSubmitted,
        batches: results,
        sampleUrls: urlList.slice(0, 5)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[IndexNow] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
