import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const URL_TIMEOUT_MS = 60000; // 60 seconds per URL

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

// Generate a cache key from URL
function urlToCacheKey(url: string): string {
  // Remove protocol and create a clean key
  return url.replace('https://', '').replace('http://', '').replace(/[^a-zA-Z0-9]/g, '_');
}

// Write to Cloudflare KV
async function writeToKV(key: string, value: string): Promise<boolean> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
    console.error('Cloudflare KV credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${key}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'text/html',
        },
        body: value,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`KV write failed for ${key}: ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`KV write error for ${key}:`, error);
    return false;
  }
}

// Fetch rendered HTML from Cloudflare Worker (with bot user-agent)
async function fetchRenderedPage(url: string): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);

    // Use Googlebot user-agent to trigger Cloudflare's bot rendering
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const html = await response.text();
      
      // Basic validation - should have actual content, not just JS shell
      if (html.length > 1000 && html.includes('</html>')) {
        return { success: true, html };
      } else {
        return { success: false, error: 'Response appears to be empty or JS shell only' };
      }
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// Warm a single URL: fetch rendered HTML and store in KV
async function warmUrl(url: string): Promise<{ success: boolean; error?: string }> {
  // Fetch rendered page from Cloudflare Worker
  const fetchResult = await fetchRenderedPage(url);
  
  if (!fetchResult.success || !fetchResult.html) {
    return { success: false, error: fetchResult.error || 'No HTML returned' };
  }

  // Store in Cloudflare KV
  const cacheKey = urlToCacheKey(url);
  const kvSuccess = await writeToKV(cacheKey, fetchResult.html);
  
  if (!kvSuccess) {
    return { success: false, error: 'Failed to write to KV' };
  }

  console.log(`  ✓ Cached ${url} (${fetchResult.html.length} bytes)`);
  return { success: true };
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
  const baseUrl = 'https://www.top10lists.us';

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

    // Validate Cloudflare credentials
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudflare KV credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

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

    console.log(`🔥 Starting cache warming for ${urls.length} URLs...`);

    const result: WarmResult = {
      success: true,
      total: urls.length,
      warmed: 0,
      failed: 0,
      errors: [],
    };

    // Process URLs sequentially to avoid overwhelming the server
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[${i + 1}/${urls.length}] Warming: ${url}`);
      
      const warmResult = await warmUrl(url);
      
      if (warmResult.success) {
        result.warmed++;
      } else {
        result.failed++;
        result.errors.push(`${url}: ${warmResult.error}`);
        console.error(`  ✗ Failed: ${warmResult.error}`);
      }

      // Small delay between requests
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Cache warming complete: ${result.warmed}/${result.total} successful, ${result.failed} failed`);

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
