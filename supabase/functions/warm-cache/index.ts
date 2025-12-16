import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'robert@top10lists.us';
const URL_TIMEOUT_MS = 15000; // 15 seconds per URL
const SEQUENTIAL_DELAY_MS = 3000; // 3 seconds between each URL
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Send failure notification email
async function sendFailureEmail(result: WarmResult, errorMessage?: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured, cannot send failure email');
    return;
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const timestamp = new Date().toISOString();
    
    await resend.emails.send({
      from: 'Top10Lists Cache Monitor <hello@top10lists.us>',
      to: [ADMIN_EMAIL],
      subject: `⚠️ Cache Warming Failed - ${result.failed} URLs failed`,
      html: `
        <h2>Cache Warming Failure Alert</h2>
        <p><strong>Time:</strong> ${timestamp}</p>
        <p><strong>Summary:</strong></p>
        <ul>
          <li>Total URLs: ${result.total}</li>
          <li>Successfully warmed: ${result.warmed}</li>
          <li>Failed: ${result.failed}</li>
        </ul>
        ${errorMessage ? `<p><strong>Error:</strong> ${errorMessage}</p>` : ''}
        ${result.errors.length > 0 ? `
          <p><strong>Failed URLs:</strong></p>
          <ul>
            ${result.errors.slice(0, 20).map(e => `<li>${e}</li>`).join('')}
            ${result.errors.length > 20 ? `<li>... and ${result.errors.length - 20} more</li>` : ''}
          </ul>
        ` : ''}
        <p>Please check the edge function logs for more details.</p>
      `,
    });
    
    console.log('📧 Failure notification email sent to', ADMIN_EMAIL);
  } catch (emailError) {
    console.error('Failed to send failure notification email:', emailError);
  }
}

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

// Check if URL is a non-HTML static file
function isStaticFile(url: string): boolean {
  return url.endsWith('.txt') || url.endsWith('.xml') || url.endsWith('.json');
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
      const content = await response.text();
      
      // Skip HTML validation for static files (txt, xml, json)
      if (isStaticFile(url)) {
        if (content.length > 100) {
          return { success: true, html: content };
        } else {
          return { success: false, error: 'Static file appears empty' };
        }
      }
      
      // HTML validation - should have actual content, not just JS shell
      if (content.length > 1000 && content.includes('</html>')) {
        return { success: true, html: content };
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

// Get URLs to warm - includes static pages AND only city/category pages that actually have content
async function getUrlsToWarm(region?: string, limit?: number, offset?: number): Promise<{ urls: string[]; totalCount: number }> {
  const baseUrl = 'https://list-wise-boost.lovable.app';
  const regionNormalized = region?.toLowerCase().trim();

  // Static crawlable pages (React pages only - Worker skips .txt, .json, .xml files)
  const staticPages = [
    '', // homepage
    '/about',
    '/about/ranking-methodology',
    '/faq',
    '/for-agents',
    '/compare',
    '/press',
    '/for-ai',
    '/test',
    '/ai-compare',
    '/arizona', // state landing page
  ];

  const staticUrls = staticPages.map((path) => `${baseUrl}${path}`);
  let allUrls = [...staticUrls];

  try {
    // Source of truth for "page has content": canonical rankings exist.
    // We fetch only rank=1 to get one row per city/category pair.
    const { data, error } = await supabaseAdmin
      .from('canonical_city_rankings')
      .select('city_id,category_id,rank,cities:city_id(slug,state_slug,active),categories:category_id(slug,active)')
      .eq('rank', 1);

    if (error) throw error;

    const dynamicUrls: string[] = [];

    for (const row of data ?? []) {
      const cityRel: any = (row as any).cities;
      const categoryRel: any = (row as any).categories;

      const city = Array.isArray(cityRel) ? cityRel[0] : cityRel;
      const category = Array.isArray(categoryRel) ? categoryRel[0] : categoryRel;

      if (!city?.slug || !city?.state_slug) continue;
      if (city?.active === false) continue;

      if (!category?.slug) continue;
      if (category?.active === false) continue;

      if (regionNormalized && String(city.state_slug).toLowerCase() !== regionNormalized) continue;

      dynamicUrls.push(`${baseUrl}/${city.state_slug}/${city.slug}/${category.slug}`);
    }

    const uniqueDynamicUrls = Array.from(new Set(dynamicUrls)).sort();
    allUrls = [...staticUrls, ...uniqueDynamicUrls];

    console.log(
      `Generated ${allUrls.length} URLs to warm (${staticUrls.length} static + ${uniqueDynamicUrls.length} content city pages${regionNormalized ? ` for region=${regionNormalized}` : ''})`
    );
  } catch (error) {
    console.error('Error fetching content city pages, using static pages only:', error);
  }

  const totalCount = allUrls.length;
  const startIndex = offset || 0;
  const endIndex = limit ? startIndex + limit : allUrls.length;
  const urls = allUrls.slice(startIndex, endIndex);

  console.log(`Returning ${urls.length} URLs (offset: ${startIndex}, limit: ${limit || 'none'}, total: ${totalCount})`);
  return { urls, totalCount };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({})) as WarmRequest;
    // No default limit - warm all URLs in one run
    const { urls: providedUrls, region, limit, offset = 0 } = body;

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

    // Process URLs sequentially with 3-second intervals
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
      
      // 3-second delay between each URL (except after the last one)
      if (i < urls.length - 1) {
        console.log(`  ⏱️ Waiting ${SEQUENTIAL_DELAY_MS / 1000}s before next URL...`);
        await new Promise(resolve => setTimeout(resolve, SEQUENTIAL_DELAY_MS));
      }
    }

    console.log(`✅ Cache warming complete: ${result.warmed}/${result.total} successful, ${result.failed} failed`);

    // Send failure email if any URLs failed
    if (result.failed > 0) {
      result.success = false;
      await sendFailureEmail(result);
    }

    // Trigger IndexNow after cache warming completes (only on final batch or single batch)
    if (!hasMore && result.warmed > 0) {
      console.log('🔔 Triggering IndexNow to notify search engines...');
      try {
        const { data: indexNowResult, error: indexNowError } = await supabaseAdmin.functions.invoke('push-indexnow', {
          body: {},
        });

        if (indexNowError) {
          console.error('⚠️ IndexNow failed:', indexNowError);
          (result as any).indexNowTriggered = false;
          (result as any).indexNowError = indexNowError.message;
        } else {
          const urlsSubmitted = (indexNowResult as any)?.urlsSubmitted || 0;
          console.log(`✅ IndexNow triggered successfully: ${urlsSubmitted} URLs pushed`);
          (result as any).indexNowTriggered = true;
          (result as any).indexNowUrls = urlsSubmitted;
        }
      } catch (indexNowError) {
        console.error('⚠️ IndexNow error:', indexNowError);
        (result as any).indexNowTriggered = false;
        (result as any).indexNowError = indexNowError instanceof Error ? indexNowError.message : 'Unknown error';
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cache warming error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Send failure email for catastrophic errors
    await sendFailureEmail(
      { success: false, total: 0, warmed: 0, failed: 1, errors: [errorMessage], hasMore: false, nextOffset: 0 },
      errorMessage
    );
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
