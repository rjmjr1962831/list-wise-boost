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
const URL_TIMEOUT_MS = 15000; // 15 seconds per URL
const MAX_CONCURRENT = 3; // Process 3 URLs at a time

interface WarmRequest {
  urls?: string[];
  region?: string;
  limit?: number;
  offset?: number;
}

interface WarmResult {
  success: boolean;
  total: number;
  warmed: number;
  failed: number;
  errors: string[];
  hasMore: boolean;
  nextOffset: number;
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
async function getUrlsToWarm(region?: string, limit?: number, offset?: number): Promise<{ urls: string[]; totalCount: number }> {
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
    return { urls: [], totalCount: 0 };
  }

  // Generate URLs for each city
  const allUrls: string[] = [];
  const baseUrl = 'https://www.top10lists.us';

  for (const city of cities) {
    // Main category page
    allUrls.push(`${baseUrl}/${city.state_slug}/${city.slug}/top10realestateagents`);
  }

  const totalCount = allUrls.length;
  const startIndex = offset || 0;
  const endIndex = limit ? startIndex + limit : allUrls.length;
  const urls = allUrls.slice(startIndex, endIndex);
  
  console.log(`Generated ${urls.length} URLs to warm (offset: ${startIndex}, total: ${totalCount})`);
  return { urls, totalCount };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as WarmRequest;
    const { urls: providedUrls, region, limit = 10, offset = 0 } = body;

    // Validate Cloudflare credentials
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudflare KV credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get URLs to warm
    let urls: string[];
    let totalCount: number;
    
    if (providedUrls && providedUrls.length > 0) {
      urls = providedUrls;
      totalCount = providedUrls.length;
    } else {
      const result = await getUrlsToWarm(region, limit, offset);
      urls = result.urls;
      totalCount = result.totalCount;
    }

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, total: 0, warmed: 0, failed: 0, errors: [], hasMore: false, nextOffset: offset }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nextOffset = offset + urls.length;
    const hasMore = nextOffset < totalCount;
    
    console.log(`🔥 Starting cache warming for ${urls.length} URLs (batch ${offset}-${nextOffset} of ${totalCount})...`);

    const result: WarmResult = {
      success: true,
      total: totalCount,
      warmed: 0,
      failed: 0,
      errors: [],
      hasMore,
      nextOffset,
    };

    // Process URLs in parallel batches for speed
    for (let i = 0; i < urls.length; i += MAX_CONCURRENT) {
      const batch = urls.slice(i, i + MAX_CONCURRENT);
      console.log(`Processing batch ${Math.floor(i/MAX_CONCURRENT) + 1}: ${batch.length} URLs`);
      
      const batchResults = await Promise.all(
        batch.map(async (url, idx) => {
          console.log(`[${i + idx + 1}/${urls.length}] Warming: ${url}`);
          const warmResult = await warmUrl(url);
          return { url, ...warmResult };
        })
      );
      
      for (const res of batchResults) {
        if (res.success) {
          result.warmed++;
        } else {
          result.failed++;
          result.errors.push(`${res.url}: ${res.error}`);
          console.error(`  ✗ Failed: ${res.error}`);
        }
      }
      
      // Small delay between batches
      if (i + MAX_CONCURRENT < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
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
