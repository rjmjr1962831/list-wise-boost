import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE_URL = "https://www.top10lists.us";

// Target states for cache warming
const TARGET_STATES = ["AZ", "Arizona", "CA", "California"];

// Static pages - always warmed
const STATIC_PAGES = [
  "/",
  "/arizona",
  "/california",
  "/about",
  "/about/founder",
  "/about/ranking-methodology",
  "/for-ai",
];

const stateToSlug: Record<string, string> = {
  "Arizona": "arizona",
  "AZ": "arizona",
  "California": "california", 
  "CA": "california",
};

interface WarmResult {
  url: string;
  status: number;
  cache: string;
  timeMs: number;
  success: boolean;
}

async function fetchTopNeighborhoods(supabase: any, topPercentage: number = 0.25): Promise<string[]> {
  console.log(`Fetching top ${topPercentage * 100}% of neighborhoods in AZ and CA...`);
  
  // Get neighborhoods for target states, ordered by score
  const { data: neighborhoods, error } = await supabase
    .from("neighborhood_catalog")
    .select("neighborhood_slug, city_area_slug, primary_zip, state, score")
    .in("state", TARGET_STATES)
    .eq("is_active", true)
    .not("primary_zip", "is", null)
    .not("score", "is", null)
    .order("score", { ascending: false });

  if (error) {
    console.error("Error fetching neighborhoods:", error);
    return [];
  }

  if (!neighborhoods || neighborhoods.length === 0) {
    console.log("No neighborhoods found");
    return [];
  }

  // Calculate how many to warm (top 25%)
  const totalCount = neighborhoods.length;
  const topCount = Math.ceil(totalCount * topPercentage);
  
  console.log(`Total neighborhoods: ${totalCount}`);
  console.log(`Warming top ${topCount} (${topPercentage * 100}%)`);
  
  // Take top X% and convert to URLs
  const topNeighborhoods = neighborhoods.slice(0, topCount);
  
  const urls = topNeighborhoods
    .filter((n: any) => stateToSlug[n.state])
    .map((n: any) => {
      const stateSlug = stateToSlug[n.state];
      return `/${stateSlug}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`;
    });
  
  // Log some stats
  const byState = topNeighborhoods.reduce((acc: any, n: any) => {
    const state = n.state;
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});
  
  console.log("Breakdown by state:", byState);
  console.log("Score range:", {
    highest: topNeighborhoods[0]?.score,
    lowest: topNeighborhoods[topCount - 1]?.score
  });
  
  return urls;
}

async function warmUrl(url: string): Promise<WarmResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) GPTBot/1.0",
        "X-Cache-Warming": "true",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(30000),
    });

    const html = await response.text();
    const timeMs = Date.now() - startTime;
    const cacheStatus = response.headers.get("X-Cache") || "unknown";

    return {
      url,
      status: response.status,
      cache: cacheStatus,
      timeMs,
      success: response.ok && html.length > 10000,
    };
  } catch (error: unknown) {
    const timeMs = Date.now() - startTime;
    return {
      url,
      status: 0,
      cache: "error",
      timeMs,
      success: false,
    };
  }
}

async function warmPages(
  urls: string[], 
  concurrency: number = 5
): Promise<{ successful: number; failed: number; totalTimeMs: number }> {
  const startTime = Date.now();
  let successful = 0;
  let failed = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchPromises = batch.map(path => warmUrl(`${BASE_URL}${path}`));
    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if (result.success) {
        successful++;
        console.log(`✓ [${successful + failed}/${urls.length}] ${result.cache} ${result.url} (${result.timeMs}ms)`);
      } else {
        failed++;
        console.error(`✗ [${successful + failed}/${urls.length}] FAILED ${result.url}`);
      }
    }
  }

  const totalTimeMs = Date.now() - startTime;
  return { successful, failed, totalTimeMs };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { 
      topPercentage = 0.25,  // Default to top 25%
      concurrency = 5,
      staticOnly = false,
    } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`\n🔥 Starting cache warming for top ${topPercentage * 100}% of markets`);
    console.log(`States: Arizona, California`);
    console.log(`Concurrency: ${concurrency}\n`);

    // Build URL list
    let allUrls: string[] = [];

    if (staticOnly) {
      allUrls = [...STATIC_PAGES];
      console.log(`Warming ${allUrls.length} static pages only`);
    } else {
      // Add static pages
      allUrls = [...STATIC_PAGES];
      console.log(`Added ${STATIC_PAGES.length} static pages`);

      // Add top neighborhoods
      const neighborhoodUrls = await fetchTopNeighborhoods(supabase, topPercentage);
      allUrls = [...allUrls, ...neighborhoodUrls];
      console.log(`Added ${neighborhoodUrls.length} top neighborhood pages`);
    }

    console.log(`\nTotal pages to warm: ${allUrls.length}\n`);

    // Warm the cache
    const results = await warmPages(allUrls, concurrency);

    const summary = {
      total_pages: allUrls.length,
      static_pages: STATIC_PAGES.length,
      neighborhood_pages: allUrls.length - STATIC_PAGES.length,
      successful: results.successful,
      failed: results.failed,
      success_rate: ((results.successful / allUrls.length) * 100).toFixed(1) + "%",
      total_time_ms: results.totalTimeMs,
      avg_time_per_page_ms: Math.round(results.totalTimeMs / allUrls.length),
    };

    console.log(`\n✅ Cache warming completed!`);
    console.log(JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Warmed ${results.successful}/${allUrls.length} pages successfully`,
        summary
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Error:", errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
