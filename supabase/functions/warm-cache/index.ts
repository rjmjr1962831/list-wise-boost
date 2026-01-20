import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-enrichment-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
      limit = 10, 
      state = 'AZ',
      forceRefresh = false,
      urlPattern = 'neighborhood' // 'neighborhood', 'city', or 'all'
    } = body;

    const results: any[] = [];
    const errors: any[] = [];

    // Build URL list based on pattern
    let urls: string[] = [];

    if (urlPattern === 'neighborhood' || urlPattern === 'all') {
      // Fetch active neighborhoods (using correct column names from neighborhood_catalog)
      const { data: neighborhoods, error: nhError } = await supabase
        .from("neighborhood_catalog")
        .select("neighborhood_slug, city_area_slug, primary_zip, state")
        .eq("state", state)
        .eq("is_active", true)
        .not("primary_zip", "is", null)
        .limit(limit);

      if (nhError) {
        errors.push({ type: 'db', message: nhError.message });
      } else if (neighborhoods) {
        for (const nh of neighborhoods) {
          const stateSlug = nh.state === 'AZ' ? 'arizona' : nh.state.toLowerCase();
          const url = `https://www.top10lists.us/${stateSlug}/${nh.city_area_slug}/${nh.primary_zip}/${nh.neighborhood_slug}/top10realestateagents`;
          urls.push(url);
        }
      }
    }

    if (urlPattern === 'city' || urlPattern === 'all') {
      // Fetch active cities from cities table
      const { data: cities, error: cityError } = await supabase
        .from("cities")
        .select("slug, state_slug")
        .eq("active", true)
        .limit(limit);

      if (cityError) {
        errors.push({ type: 'db', message: cityError.message });
      } else if (cities) {
        for (const city of cities) {
          const url = `https://www.top10lists.us/${city.state_slug}/${city.slug}/top10realestateagents`;
          urls.push(url);
        }
      }
    }

    // Warm each URL by requesting it with cache-warming header
    for (const url of urls) {
      try {
        const headers: Record<string, string> = {
          "X-Cache-Warming": "true",
          "User-Agent": "Top10Lists-CacheWarmer/1.0"
        };
        
        if (forceRefresh) {
          headers["X-Force-Refresh"] = "true";
        }

        const startTime = Date.now();
        const response = await fetch(url, { headers });
        const elapsed = Date.now() - startTime;

        const cacheStatus = response.headers.get("X-Cache") || "unknown";
        const renderMethod = response.headers.get("X-Rendered") || "unknown";
        const contentLength = response.headers.get("Content-Length") || "0";

        results.push({
          url,
          status: response.status,
          cache: cacheStatus,
          rendered: renderMethod,
          size: parseInt(contentLength),
          ms: elapsed,
          success: response.status === 200 && renderMethod !== "fallback"
        });

      } catch (fetchError: unknown) {
        errors.push({
          url,
          type: 'fetch',
          message: fetchError instanceof Error ? fetchError.message : String(fetchError)
        });
      }
    }

    const summary = {
      total: urls.length,
      successful: results.filter(r => r.success).length,
      cached: results.filter(r => r.cache === "HIT").length,
      rendered: results.filter(r => r.rendered === "browser-rest-api").length,
      fallback: results.filter(r => r.rendered === "fallback").length,
      failed: errors.length
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary,
        results, 
        errors 
      }, null, 2),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
