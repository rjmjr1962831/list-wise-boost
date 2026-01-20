import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-enrichment-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATIC_PAGES = [
  "https://www.top10lists.us/",
  "https://www.top10lists.us/about",
  "https://www.top10lists.us/methodology",
  "https://www.top10lists.us/privacy",
  "https://www.top10lists.us/terms",
  "https://www.top10lists.us/contact",
  "https://www.top10lists.us/faq",
  "https://www.top10lists.us/arizona",
];

async function warmAllPages(supabase: any, options: {
  state: string;
  forceRefresh: boolean;
  includeStatic: boolean;
  includeCities: boolean;
  includeNeighborhoods: boolean;
  limit: number;
}) {
  const results: any[] = [];
  const errors: any[] = [];
  let urls: string[] = [];

  // 1. Static pages
  if (options.includeStatic) {
    urls.push(...STATIC_PAGES);
    console.log(`Added ${STATIC_PAGES.length} static pages`);
  }

  // 2. City pages
  if (options.includeCities) {
    const { data: cities, error: cityError } = await supabase
      .from("cities")
      .select("slug, state_slug")
      .eq("active", true);

    if (cityError) {
      errors.push({ type: 'db', source: 'cities', message: cityError.message });
    } else if (cities) {
      for (const city of cities) {
        urls.push(`https://www.top10lists.us/${city.state_slug}/${city.slug}/top10realestateagents`);
      }
      console.log(`Added ${cities.length} city pages`);
    }
  }

  // 3. Neighborhood pages
  if (options.includeNeighborhoods) {
    const { data: neighborhoods, error: nhError } = await supabase
      .from("neighborhood_catalog")
      .select("neighborhood_slug, city_area_slug, primary_zip, state")
      .eq("state", options.state)
      .eq("is_active", true)
      .not("primary_zip", "is", null);

    if (nhError) {
      errors.push({ type: 'db', source: 'neighborhoods', message: nhError.message });
    } else if (neighborhoods) {
      for (const nh of neighborhoods) {
        const stateSlug = nh.state === 'AZ' ? 'arizona' : nh.state.toLowerCase();
        urls.push(`https://www.top10lists.us/${stateSlug}/${nh.city_area_slug}/${nh.primary_zip}/${nh.neighborhood_slug}/top10realestateagents`);
      }
      console.log(`Added ${neighborhoods.length} neighborhood pages`);
    }
  }

  // Apply limit if specified
  if (options.limit > 0 && urls.length > options.limit) {
    urls = urls.slice(0, options.limit);
  }

  console.log(`Total URLs to warm: ${urls.length}`);

  // Warm each URL
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const headers: Record<string, string> = {
        "X-Cache-Warming": "true",
        "User-Agent": "Top10Lists-CacheWarmer/1.0"
      };
      
      if (options.forceRefresh) {
        headers["X-Force-Refresh"] = "true";
      }

      const startTime = Date.now();
      const response = await fetch(url, { headers });
      const elapsed = Date.now() - startTime;

      const cacheStatus = response.headers.get("X-Cache") || "unknown";
      const renderMethod = response.headers.get("X-Rendered") || "unknown";
      const contentLength = response.headers.get("Content-Length") || "0";

      const success = response.status === 200 && renderMethod !== "fallback";
      
      results.push({
        url,
        status: response.status,
        cache: cacheStatus,
        rendered: renderMethod,
        size: parseInt(contentLength),
        ms: elapsed,
        success
      });

      console.log(`[${i + 1}/${urls.length}] ${success ? '✓' : '✗'} ${url} (${cacheStatus}, ${elapsed}ms)`);

    } catch (fetchError: unknown) {
      const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      errors.push({ url, type: 'fetch', message: errMsg });
      console.error(`[${i + 1}/${urls.length}] ERROR ${url}: ${errMsg}`);
    }
  }

  return { results, errors, totalUrls: urls.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const { 
      limit = 0, // 0 = no limit
      state = 'AZ',
      forceRefresh = false,
      urlPattern = 'all', // 'neighborhood', 'city', 'static', or 'all'
      background = true // Use background processing
    } = body;

    const options = {
      state,
      forceRefresh,
      includeStatic: urlPattern === 'static' || urlPattern === 'all',
      includeCities: urlPattern === 'city' || urlPattern === 'all',
      includeNeighborhoods: urlPattern === 'neighborhood' || urlPattern === 'all',
      limit
    };

    if (background) {
      // Background processing - return immediately
      const jobId = crypto.randomUUID().substring(0, 8);
      
      // Use waitUntil for background processing
      (globalThis as any).EdgeRuntime?.waitUntil?.(
        (async () => {
          console.log(`Background job ${jobId} started`);
          const startTime = Date.now();
          
          try {
            const { results, errors, totalUrls } = await warmAllPages(supabase, options);
            
            const summary = {
              total: totalUrls,
              successful: results.filter(r => r.success).length,
              cached: results.filter(r => r.cache === "HIT").length,
              rendered: results.filter(r => r.rendered === "browser-rest-api").length,
              fallback: results.filter(r => r.rendered === "fallback").length,
              failed: errors.length,
              duration_ms: Date.now() - startTime
            };
            
            console.log(`Background job ${jobId} completed:`, JSON.stringify(summary));
          } catch (e) {
            console.error(`Background job ${jobId} failed:`, e);
          }
        })()
      );

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Cache warming job ${jobId} started in background`,
          job_id: jobId,
          options
        }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Synchronous processing (will timeout for large jobs)
    const startTime = Date.now();
    const { results, errors, totalUrls } = await warmAllPages(supabase, options);

    const summary = {
      total: totalUrls,
      successful: results.filter(r => r.success).length,
      cached: results.filter(r => r.cache === "HIT").length,
      rendered: results.filter(r => r.rendered === "browser-rest-api").length,
      fallback: results.filter(r => r.rendered === "fallback").length,
      failed: errors.length,
      duration_ms: Date.now() - startTime
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary,
        results, 
        errors 
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
