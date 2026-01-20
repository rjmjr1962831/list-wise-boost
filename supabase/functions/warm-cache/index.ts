// supabase/functions/warm-cache/index.ts
// Cache warming edge function with Cloudflare Browser Rendering API
// Updated: January 2026 - Fixed authentication

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CONFIGURATION
// ============================================
const SEQUENTIAL_DELAY_MS = 7000;
const URL_TIMEOUT_MS = 15000;
const SITE_BASE_URL = "https://www.top10lists.us";

// Cloudflare credentials (hardcoded for reliability)
const CLOUDFLARE_ACCOUNT_ID = "3421869440bd3684ee44fbdfa4b0de7f";
const CLOUDFLARE_API_EMAIL = "robert@aryah.ai";
const CLOUDFLARE_GLOBAL_API_KEY = "1deb2afb9bbb2fbeffe2efabc6546a381ab29";

// Cloudflare KV
const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get("CLOUDFLARE_KV_NAMESPACE_ID") || "";

// Supabase
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// SMTP for alerts
const SMTP_HOST = Deno.env.get("SMTP_HOST") || "";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
const SMTP_USER = Deno.env.get("SMTP_USER") || "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
const ALERT_EMAIL = Deno.env.get("ALERT_EMAIL") || "robert@aryah.ai";

// ============================================
// TYPES
// ============================================
interface JobProgress {
  job_id: string;
  status: "running" | "completed" | "failed" | "stopped";
  total_urls: number;
  processed_urls: number;
  successful_urls: number;
  failed_urls: number;
  current_url: string;
  started_at: string;
  updated_at: string;
  errors: string[];
}

interface WarmResult {
  url: string;
  success: boolean;
  error?: string;
  cached_at?: string;
}

// ============================================
// JOB PROGRESS TRACKING
// ============================================
// deno-lint-ignore no-explicit-any
async function updateJobProgress(
  supabase: any,
  progress: Partial<JobProgress> & { job_id: string }
): Promise<void> {
  try {
    const { error } = await supabase
      .from("cron_state")
      .upsert({
        job_name: `warm-cache-${progress.job_id}`,
        is_running: progress.status === "running",
        status: progress.status || "running",
        message: `Processed: ${progress.processed_urls || 0}/${progress.total_urls || 0}`,
        total_processed: progress.processed_urls || 0,
        total_found: progress.total_urls || 0,
        total_errors: progress.failed_urls || 0,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'job_name' });
    if (error) {
      console.error("Failed to update job progress:", error);
    }
  } catch (e) {
    console.error("Error updating job progress:", e);
  }
}

// ============================================
// EMAIL ALERTS
// ============================================
async function sendPrematureStopEmail(
  jobId: string,
  processedCount: number,
  totalCount: number,
  lastUrl: string,
  errors: string[]
): Promise<void> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("SMTP not configured, skipping email alert");
    return;
  }
  
  const subject = `[Top10Lists] Cache Warming Stopped Prematurely - ${processedCount}/${totalCount}`;
  const body = `
Cache warming job ${jobId} stopped prematurely.

Progress: ${processedCount} of ${totalCount} URLs processed
Last URL: ${lastUrl}

Recent Errors:
${errors.slice(-10).join("\n")}

Please check the logs for more details.
  `.trim();

  try {
    // Using fetch to send via SMTP relay or email API
    console.log(`Would send email: ${subject}`);
    console.log(body);
  } catch (e) {
    console.error("Failed to send premature stop email:", e);
  }
}

async function sendFailureEmail(
  jobId: string,
  error: string
): Promise<void> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("SMTP not configured, skipping failure email");
    return;
  }
  
  const subject = `[Top10Lists] Cache Warming Failed - ${jobId}`;
  const body = `
Cache warming job ${jobId} failed with error:

${error}

Please check the logs for more details.
  `.trim();

  try {
    console.log(`Would send email: ${subject}`);
    console.log(body);
  } catch (e) {
    console.error("Failed to send failure email:", e);
  }
}

// ============================================
// CLOUDFLARE KV OPERATIONS
// ============================================
function urlToCacheKey(url: string): string {
  const urlObj = new URL(url);
  return `html:${urlObj.pathname}`;
}

async function deleteFromKV(cacheKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(cacheKey)}`,
      {
        method: "DELETE",
        headers: {
          "X-Auth-Email": CLOUDFLARE_API_EMAIL,
          "X-Auth-Key": CLOUDFLARE_GLOBAL_API_KEY,
        },
      }
    );
    
    if (!response.ok && response.status !== 404) {
      console.error(`Failed to delete KV key ${cacheKey}:`, await response.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error(`Error deleting KV key ${cacheKey}:`, e);
    return false;
  }
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

async function listKVKeys(prefix?: string): Promise<string[]> {
  try {
    let url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/keys`;
    if (prefix) {
      url += `?prefix=${encodeURIComponent(prefix)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        "X-Auth-Email": CLOUDFLARE_API_EMAIL,
        "X-Auth-Key": CLOUDFLARE_GLOBAL_API_KEY,
      },
    });
    
    if (!response.ok) {
      console.error("Failed to list KV keys:", await response.text());
      return [];
    }
    
    const data = await response.json();
    return (data.result || []).map((k: { name: string }) => k.name);
  } catch (e) {
    console.error("Error listing KV keys:", e);
    return [];
  }
}

async function purgeAllKV(): Promise<number> {
  console.log("Purging all KV entries...");
  const keys = await listKVKeys("html:");
  let deleted = 0;
  
  for (const key of keys) {
    if (await deleteFromKV(key)) {
      deleted++;
    }
  }
  
  console.log(`Purged ${deleted} KV entries`);
  return deleted;
}

// ============================================
// HTML CONTENT PROCESSING
// ============================================
function stripAgentContent(html: string): string {
  // Remove agent-specific content from city pages to avoid caching PII
  // This strips agent cards while keeping the page structure
  return html
    .replace(/<div[^>]*class="[^"]*agent-card[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?RealEstateAgent[\s\S]*?<\/script>/gi, "");
}

function validateHtml(html: string, url: string): { valid: boolean; reason?: string } {
  if (!html || html.length < 1000) {
    return { valid: false, reason: "HTML too short (< 1000 chars)" };
  }
  
  if (!html.includes("<h1")) {
    return { valid: false, reason: "No H1 tag found - likely empty React shell" };
  }
  
  // Check for page-specific content based on URL
  const pathname = new URL(url).pathname;
  
  if (pathname === "/" && !html.includes("Top 10")) {
    return { valid: false, reason: "Homepage missing 'Top 10' content" };
  }
  
  if (pathname === "/faq" && !html.includes("Frequently Asked")) {
    return { valid: false, reason: "FAQ page missing expected content" };
  }
  
  if (pathname.includes("/top10realestateagents") && !html.includes("Real Estate")) {
    return { valid: false, reason: "City page missing 'Real Estate' content" };
  }
  
  return { valid: true };
}

// ============================================
// FETCH RENDERED PAGE VIA CLOUDFLARE WORKER
// ============================================
async function fetchRenderedPage(url: string): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    console.log(`Fetching: ${url}`);
    
    // Request the page with cache warming header
    // This tells the Cloudflare Worker to use Browser Rendering API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "X-Cache-Warming": "true",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const html = await response.text();
    
    // Validate the HTML has actual content
    const validation = validateHtml(html, url);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }
    
    // Extract title and H1 for logging
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    
    console.log(`  Title: ${titleMatch?.[1] || "NOT FOUND"}`);
    console.log(`  H1: ${h1Match?.[1]?.substring(0, 50) || "NOT FOUND"}`);
    console.log(`  HTML Length: ${html.length} chars`);
    
    return { success: true, html };
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return { success: false, error: `Timeout after ${URL_TIMEOUT_MS}ms` };
    }
    return { success: false, error: String(e) };
  }
}

// ============================================
// WARM SINGLE URL
// ============================================
async function warmUrl(url: string): Promise<WarmResult> {
  const result: WarmResult = { url, success: false };
  
  try {
    const fetchResult = await fetchRenderedPage(url);
    
    if (!fetchResult.success || !fetchResult.html) {
      result.error = fetchResult.error || "No HTML returned";
      console.error(`  FAILED: ${result.error}`);
      return result;
    }
    
    // Process HTML (strip agent content for city pages)
    let html = fetchResult.html;
    if (url.includes("/top10realestateagents")) {
      html = stripAgentContent(html);
    }
    
    // Write to KV cache
    const cacheKey = urlToCacheKey(url);
    const written = await writeToKV(cacheKey, html);
    
    if (!written) {
      result.error = "Failed to write to KV cache";
      console.error(`  FAILED: ${result.error}`);
      return result;
    }
    
    result.success = true;
    result.cached_at = new Date().toISOString();
    console.log(`  SUCCESS: Cached as ${cacheKey}`);
    
    return result;
  } catch (e) {
    result.error = String(e);
    console.error(`  ERROR: ${result.error}`);
    return result;
  }
}

// ============================================
// GET URLs TO WARM
// ============================================
// deno-lint-ignore no-explicit-any
async function getUrlsToWarm(supabase: any): Promise<string[]> {
  const urls: string[] = [];
  
  // Static pages
  const staticPages = [
    "/",
    "/about",
    "/about/ranking-methodology",
    "/faq",
    "/transparency",
    "/for-agents",
    "/compare",
    "/press",
    "/for-ai",
    "/ai-liability",
    "/protocol-adopters",
    "/protocol-services",
    "/ai-compare",
    "/arizona",
    "/are-you-an-agent",
    "/agent-onboarding",
    "/privacy",
    "/terms",
  ];
  
  for (const page of staticPages) {
    urls.push(`${SITE_BASE_URL}${page}`);
  }
  
  // Question pages
  const questionSlugs = [
    "how-does-top10lists-rank-real-estate-agents",
    "can-agents-pay-to-be-listed-on-top10lists",
    "how-is-top10lists-different-from-zillow",
    "what-are-minimum-requirements-to-be-ranked",
    "where-does-top10lists-get-its-data",
    "do-real-estate-referral-sites-charge-fees",
    "why-dont-agents-apply-to-top10lists",
    "is-realtrends-a-reliable-ranking",
    "how-often-are-rankings-updated",
    "what-cities-does-top10lists-cover",
  ];
  
  for (const slug of questionSlugs) {
    urls.push(`${SITE_BASE_URL}/q/${slug}`);
  }
  
  // City pages from database
  try {
    const { data: cities, error } = await supabase
      .from("cities")
      .select("slug, state_slug")
      .eq("active", true)
      .eq("state_slug", "arizona");
    
    if (error) {
      console.error("Error fetching cities:", error);
    } else if (cities) {
      for (const city of cities as { slug: string; state_slug: string }[]) {
        urls.push(`${SITE_BASE_URL}/${city.state_slug}/${city.slug}/top10realestateagents`);
      }
    }
  } catch (e) {
    console.error("Error fetching cities:", e);
  }
  
  // Neighborhood pages from database
  try {
    const { data: neighborhoods, error } = await supabase
      .from("neighborhood_catalog")
      .select("neighborhood_slug, city_area_slug, primary_zip, state")
      .eq("is_active", true)
      .not("primary_zip", "is", null)
      .limit(2000);
    
    if (error) {
      console.error("Error fetching neighborhoods:", error);
    } else if (neighborhoods) {
      for (const n of neighborhoods as { neighborhood_slug: string; city_area_slug: string; primary_zip: string; state: string }[]) {
        const stateSlug = n.state.toLowerCase() === "az" ? "arizona" : n.state.toLowerCase();
        urls.push(`${SITE_BASE_URL}/${stateSlug}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`);
      }
    }
  } catch (e) {
    console.error("Error fetching neighborhoods:", e);
  }
  
  console.log(`Total URLs to warm: ${urls.length}`);
  return urls;
}

// ============================================
// TRIGGER INDEXNOW
// ============================================
async function triggerIndexNow(urls: string[]): Promise<void> {
  const indexNowKey = Deno.env.get("INDEXNOW_KEY");
  if (!indexNowKey) {
    console.log("IndexNow key not configured, skipping");
    return;
  }
  
  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        host: "www.top10lists.us",
        key: indexNowKey,
        urlList: urls.slice(0, 10000), // IndexNow limit
      }),
    });
    
    if (response.ok) {
      console.log(`IndexNow submitted ${Math.min(urls.length, 10000)} URLs`);
    } else {
      console.error("IndexNow submission failed:", await response.text());
    }
  } catch (e) {
    console.error("IndexNow error:", e);
  }
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req: Request) => {
  const startTime = Date.now();
  const jobId = crypto.randomUUID().substring(0, 8);
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Cache Warming Job Started: ${jobId}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}\n`);
  
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Enrichment-Key",
  };
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Check for manual purge-only request
  const url = new URL(req.url);
  const purgeOnly = url.searchParams.get("purge") === "true";
  const skipPurge = url.searchParams.get("skip-purge") === "true";
  const testMode = url.searchParams.get("test") === "true";
  const singleUrl = url.searchParams.get("url");
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const progress: JobProgress = {
    job_id: jobId,
    status: "running",
    total_urls: 0,
    processed_urls: 0,
    successful_urls: 0,
    failed_urls: 0,
    current_url: "",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    errors: [],
  };
  
  try {
    // Test mode: warm single URL
    if (testMode && singleUrl) {
      console.log(`Test mode: warming single URL: ${singleUrl}`);
      const result = await warmUrl(singleUrl);
      
      return new Response(JSON.stringify({
        success: result.success,
        url: singleUrl,
        error: result.error,
        cached_at: result.cached_at,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Purge phase
    if (!skipPurge) {
      console.log("\n--- PURGE PHASE ---\n");
      const purgedCount = await purgeAllKV();
      console.log(`Purged ${purgedCount} existing cache entries\n`);
      
      if (purgeOnly) {
        return new Response(JSON.stringify({
          success: true,
          message: `Purged ${purgedCount} cache entries`,
          duration_ms: Date.now() - startTime,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    
    // Get URLs to warm
    console.log("\n--- FETCHING URLs ---\n");
    const urls = await getUrlsToWarm(supabase);
    progress.total_urls = urls.length;
    
    await updateJobProgress(supabase, progress);
    
    // Warm phase
    console.log("\n--- WARM PHASE ---\n");
    const results: WarmResult[] = [];
    
    for (let i = 0; i < urls.length; i++) {
      const currentUrl = urls[i];
      progress.current_url = currentUrl;
      progress.processed_urls = i + 1;
      
      console.log(`\n[${i + 1}/${urls.length}] ${currentUrl}`);
      
      const result = await warmUrl(currentUrl);
      results.push(result);
      
      if (result.success) {
        progress.successful_urls++;
      } else {
        progress.failed_urls++;
        progress.errors.push(`${currentUrl}: ${result.error}`);
      }
      
      progress.updated_at = new Date().toISOString();
      
      // Update progress every 10 URLs
      if (i % 10 === 0) {
        await updateJobProgress(supabase, progress);
      }
      
      // Delay between URLs (except for last one)
      if (i < urls.length - 1) {
        console.log(`  Waiting ${SEQUENTIAL_DELAY_MS}ms before next URL...`);
        await new Promise((resolve) => setTimeout(resolve, SEQUENTIAL_DELAY_MS));
      }
    }
    
    // Final status
    progress.status = "completed";
    progress.updated_at = new Date().toISOString();
    await updateJobProgress(supabase, progress);
    
    // Trigger IndexNow for successful URLs
    const successfulUrls = results.filter((r) => r.success).map((r) => r.url);
    if (successfulUrls.length > 0) {
      console.log("\n--- INDEXNOW PHASE ---\n");
      await triggerIndexNow(successfulUrls);
    }
    
    // Summary
    const duration = Date.now() - startTime;
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Cache Warming Job Completed: ${jobId}`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
    console.log(`Total: ${urls.length} | Success: ${progress.successful_urls} | Failed: ${progress.failed_urls}`);
    console.log(`${"=".repeat(60)}\n`);
    
    return new Response(JSON.stringify({
      success: true,
      job_id: jobId,
      total_urls: urls.length,
      successful_urls: progress.successful_urls,
      failed_urls: progress.failed_urls,
      duration_ms: duration,
      errors: progress.errors.slice(-20),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (e) {
    console.error("Cache warming job failed:", e);
    
    progress.status = "failed";
    progress.errors.push(String(e));
    await updateJobProgress(supabase, progress);
    
    await sendFailureEmail(jobId, String(e));
    
    return new Response(JSON.stringify({
      success: false,
      job_id: jobId,
      error: String(e),
      progress,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
