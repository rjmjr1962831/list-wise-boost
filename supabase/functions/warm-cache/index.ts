// supabase/functions/warm-cache/index.ts
// Cache warming edge function - calls Cloudflare Browser Rendering API directly
// Updated: January 2026

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEQUENTIAL_DELAY_MS = 7000;
const URL_TIMEOUT_MS = 30000;
const SITE_BASE_URL = "https://www.top10lists.us";
const LOVABLE_ORIGIN = "https://list-wise-boost.lovable.app";

const CLOUDFLARE_ACCOUNT_ID = "3421869440bd3684ee44fbdfa4b0de7f";
const CLOUDFLARE_API_EMAIL = "robert@aryah.ai";
const CLOUDFLARE_GLOBAL_API_KEY = "1deb2afb9bbb2fbeffe2efabc6546a381ab29";
const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get("CLOUDFLARE_KV_NAMESPACE_ID") || "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface WarmResult {
  url: string;
  success: boolean;
  error?: string;
  cached_at?: string;
}

function urlToCacheKey(url: string): string {
  const urlObj = new URL(url);
  let path = urlObj.pathname;
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return `html:${path}`;
}

async function writeToKV(cacheKey: string, html: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(cacheKey)}`,
      {
        method: "PUT",
        headers: {
          "X-Auth-Email": CLOUDFLARE_API_EMAIL,
          "X-Auth-Key": CLOUDFLARE_GLOBAL_API_KEY,
          "Content-Type": "text/plain",
        },
        body: html,
      }
    );
    if (!response.ok) {
      console.error(`Failed to write KV key ${cacheKey}:`, await response.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error(`Error writing KV key ${cacheKey}:`, e);
    return false;
  }
}

function validateHtml(html: string): { valid: boolean; reason?: string } {
  if (!html || html.length < 1000) {
    return { valid: false, reason: "HTML too short (< 1000 chars)" };
  }
  if (html.includes('id="root"></div>') || html.includes('id="root"> </div>')) {
    return { valid: false, reason: "Empty React root - JavaScript not executed" };
  }
  if (!html.includes("<h1")) {
    return { valid: false, reason: "No H1 tag found" };
  }
  return { valid: true };
}

async function fetchRenderedPage(url: string): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    const renderUrl = url.replace(SITE_BASE_URL, LOVABLE_ORIGIN);
    console.log(`Rendering: ${renderUrl}`);
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/render`,
      {
        method: "POST",
        headers: {
          "X-Auth-Email": CLOUDFLARE_API_EMAIL,
          "X-Auth-Key": CLOUDFLARE_GLOBAL_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: renderUrl,
          renderType: "html",
          waitUntil: "networkidle0",
          timeout: URL_TIMEOUT_MS,
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API ${response.status}: ${errorText.substring(0, 200)}` };
    }
    
    const data = await response.json();
    const html = data.result?.html || data.html || data.result?.content || data.content;
    
    if (!html) {
      return { success: false, error: "No HTML in API response" };
    }
    
    const validation = validateHtml(html);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }
    
    console.log(`  HTML Length: ${html.length} chars`);
    return { success: true, html };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

async function warmUrl(url: string): Promise<WarmResult> {
  const result: WarmResult = { url, success: false };
  try {
    const fetchResult = await fetchRenderedPage(url);
    if (!fetchResult.success || !fetchResult.html) {
      result.error = fetchResult.error || "No HTML returned";
      return result;
    }
    
    const cacheKey = urlToCacheKey(url);
    const written = await writeToKV(cacheKey, fetchResult.html);
    if (!written) {
      result.error = "Failed to write to KV cache";
      return result;
    }
    
    result.success = true;
    result.cached_at = new Date().toISOString();
    console.log(`  SUCCESS: Cached as ${cacheKey}`);
    return result;
  } catch (e) {
    result.error = String(e);
    return result;
  }
}

async function getUrlsToWarm(supabase: any): Promise<string[]> {
  const urls: string[] = [];
  
  const staticPages = ["/", "/about", "/faq", "/methodology", "/privacy", "/terms", "/contact", "/arizona"];
  for (const page of staticPages) {
    urls.push(`${SITE_BASE_URL}${page}`);
  }
  
  try {
    const { data: cities } = await supabase.from("cities").select("slug, state_slug").eq("active", true);
    if (cities) {
      for (const city of cities as any[]) {
        urls.push(`${SITE_BASE_URL}/${city.state_slug}/${city.slug}/top10realestateagents`);
      }
    }
  } catch (e) {
    console.error("Error fetching cities:", e);
  }
  
  try {
    const { data: neighborhoods } = await supabase
      .from("neighborhood_catalog")
      .select("neighborhood_slug, city_area_slug, state, primary_zip")
      .eq("is_active", true)
      .not("primary_zip", "is", null);
    if (neighborhoods) {
      for (const n of neighborhoods as any[]) {
        const stateSlug = n.state.toLowerCase().replace(/\s+/g, '-');
        urls.push(`${SITE_BASE_URL}/${stateSlug}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`);
      }
    }
  } catch (e) {
    console.error("Error fetching neighborhoods:", e);
  }
  
  console.log(`Total URLs to warm: ${urls.length}`);
  return urls;
}

serve(async (req: Request) => {
  const startTime = Date.now();
  const jobId = crypto.randomUUID().substring(0, 8);
  
  console.log(`Cache Warming Job Started: ${jobId} - Using Cloudflare Browser Rendering API`);
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const url = new URL(req.url);
  const testMode = url.searchParams.get("test") === "true";
  const singleUrl = url.searchParams.get("url");
  const limit = parseInt(url.searchParams.get("limit") || "0");
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    if (testMode && singleUrl) {
      const result = await warmUrl(singleUrl);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    let urls = await getUrlsToWarm(supabase);
    if (limit > 0) urls = urls.slice(0, limit);
    
    const results: WarmResult[] = [];
    for (let i = 0; i < urls.length; i++) {
      console.log(`[${i + 1}/${urls.length}] ${urls[i]}`);
      results.push(await warmUrl(urls[i]));
      if (i < urls.length - 1) await new Promise(r => setTimeout(r, SEQUENTIAL_DELAY_MS));
    }
    
    const successful = results.filter(r => r.success).length;
    return new Response(JSON.stringify({
      success: true,
      job_id: jobId,
      total_urls: urls.length,
      successful_urls: successful,
      failed_urls: urls.length - successful,
      duration_ms: Date.now() - startTime,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Cache warming failed:", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
