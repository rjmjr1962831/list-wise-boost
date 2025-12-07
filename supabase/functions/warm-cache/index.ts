import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRERENDER_TOKEN = Deno.env.get('PRERENDER_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const URL_TIMEOUT_MS = 60000; // 60 seconds per URL for Prerender

interface WarmRequest {
  urls?: string[];
  region?: string;
  limit?: number;
}

interface WarmResult {
  success: boolean;
  total: number;
  warmed: number;
  failed: number;
  errors: string[];
}

// Warm a single URL via Prerender.io
async function warmUrl(url: string): Promise<{ success: boolean; error?: string }> {
  if (!PRERENDER_TOKEN) {
    return { success: false, error: 'PRERENDER_TOKEN not configured' };
  }

  try {
    const prerenderUrl = `https://service.prerender.io/${url}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);

    const response = await fetch(prerenderUrl, {
      method: 'GET',
      headers: {
        'X-Prerender-Token': PRERENDER_TOKEN,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// Get URLs to warm based on region or fetch from database
async function getUrlsToWarm(region?: string, limit?: number): Promise<string[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Get cities with qualified agents
  let query = supabase
    .from('cities')
    .select('slug, state_slug')
    .eq('active', true);

  if (region) {
    // Filter by state if region specified
    query = query.eq('state_slug', region);
  }

  const { data: cities, error } = await query;
  
  if (error || !cities) {
    console.error('Error fetching cities:', error);
    return [];
  }

  // Generate URLs for each city
  const urls: string[] = [];
  const baseUrl = 'https://top10lists.us';

  for (const city of cities) {
    // Main category page
    urls.push(`${baseUrl}/${city.state_slug}/${city.slug}/top10realestateagents`);
  }

  // Apply limit if specified
  const finalUrls = limit ? urls.slice(0, limit) : urls;
  
  console.log(`Generated ${finalUrls.length} URLs to warm`);
  return finalUrls;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as WarmRequest;
    const { urls: providedUrls, region, limit } = body;

    // Get URLs to warm
    const urls = providedUrls && providedUrls.length > 0 
      ? providedUrls 
      : await getUrlsToWarm(region, limit);

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, total: 0, warmed: 0, failed: 0, errors: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting cache warming for ${urls.length} URLs...`);

    const result: WarmResult = {
      success: true,
      total: urls.length,
      warmed: 0,
      failed: 0,
      errors: [],
    };

    // Process URLs sequentially to avoid overwhelming Prerender
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[${i + 1}/${urls.length}] Warming: ${url}`);
      
      const warmResult = await warmUrl(url);
      
      if (warmResult.success) {
        result.warmed++;
      } else {
        result.failed++;
        result.errors.push(`${url}: ${warmResult.error}`);
        console.error(`Failed to warm ${url}: ${warmResult.error}`);
      }

      // Small delay between requests to be nice to Prerender
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Cache warming complete: ${result.warmed}/${result.total} successful`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cache warming error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
