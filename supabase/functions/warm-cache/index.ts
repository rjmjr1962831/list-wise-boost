import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-enrichment-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE_URL = "https://www.top10lists.us";

// Static pages - always warmed
const STATIC_PAGES = [
  // Homepage & States
  "/",
  "/arizona",
  "/california",
  "/texas",
  "/florida",
  "/new-york",
  "/colorado",
  // About pages
  "/about",
  "/about/founder",
  "/about/ranking-methodology",
  // AI & Protocol pages
  "/for-ai",
  "/transparency",
  "/ai-liability",
  "/protocol-adopters",
  "/protocol-services",
  // Editorial & Press
  "/press",
  "/editorial-updates",
  // Comparison & Info
  "/compare",
  "/zillow-explained",
  "/faq",
  // Legal
  "/privacy",
  "/terms",
  "/sms-terms",
  "/opt-in",
  // Testing & Agent Onboarding
  "/test",
  "/are-you-an-agent",
  "/agent-onboarding",
];

interface WarmResult {
  url: string;
  status: number;
  cache: string;
  rendered: string;
  size: number;
  ms: number;
  success: boolean;
}

interface WarmError {
  url?: string;
  type: string;
  message: string;
}

interface WarmProgress {
  static: { total: number; completed: number };
  cities: { total: number; completed: number };
  neighborhoods: { total: number; completed: number };
}

async function fetchCityPages(supabase: any): Promise<string[]> {
  const { data: cities, error } = await supabase
    .from("cities")
    .select("slug, state_slug")
    .eq("active", true);

  if (error) {
    console.error("Error fetching cities:", error);
    return [];
  }

  return cities.map((city: any) => 
    `/${city.state_slug}/${city.slug}/top10realestateagents`
  );
}

// Convert state name or abbreviation to slug
const stateToSlug: Record<string, string> = {
  "Arizona": "arizona",
  "AZ": "arizona",
  "California": "california", 
  "CA": "california",
  "Texas": "texas",
  "TX": "texas",
  "Florida": "florida",
  "FL": "florida",
  "New York": "new-york",
  "NY": "new-york",
  "Colorado": "colorado",
  "CO": "colorado"
};

// Reverse lookup: slug to state abbreviations
const slugToStateAbbrs: Record<string, string[]> = {
  "arizona": ["AZ", "Arizona"],
  "california": ["CA", "California"],
  "texas": ["TX", "Texas"],
  "florida": ["FL", "Florida"],
  "new-york": ["NY", "New York"],
  "colorado": ["CO", "Colorado"]
};

async function fetchNeighborhoodPages(supabase: any, stateFilter?: string): Promise<string[]> {
  const allNeighborhoods: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  // Normalize state filter to abbreviations for DB query
  let stateAbbrs: string[] | undefined;
  if (stateFilter) {
    const normalizedFilter = stateFilter.toLowerCase();
    stateAbbrs = slugToStateAbbrs[normalizedFilter] || [stateFilter.toUpperCase(), stateFilter];
  }

  while (hasMore) {
    let query = supabase
      .from("neighborhood_catalog")
      .select("neighborhood_slug, city_area_slug, primary_zip, state")
      .eq("is_active", true)
      .not("primary_zip", "is", null)
      .range(offset, offset + pageSize - 1);

    // Apply state filter if provided
    if (stateAbbrs && stateAbbrs.length > 0) {
      query = query.in("state", stateAbbrs);
    }

    const { data: neighborhoods, error } = await query;

    if (error) {
      console.error("Error fetching neighborhoods:", error);
      break;
    }

    if (!neighborhoods || neighborhoods.length === 0) {
      hasMore = false;
    } else {
      allNeighborhoods.push(...neighborhoods);
      offset += pageSize;
      hasMore = neighborhoods.length === pageSize;
    }
  }

  console.log(`Fetched ${allNeighborhoods.length} neighborhoods${stateFilter ? ` for state: ${stateFilter}` : ''}`);

  return allNeighborhoods
    .filter((n: any) => stateToSlug[n.state])
    .map((n: any) => 
      `/${stateToSlug[n.state]}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`
    );
}

async function warmUrl(url: string, forceRefresh: boolean): Promise<WarmResult | WarmError> {
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

    const success = response.status === 200 && renderMethod !== "fallback";
    
    return {
      url,
      status: response.status,
      cache: cacheStatus,
      rendered: renderMethod,
      size: parseInt(contentLength),
      ms: elapsed,
      success
    };
  } catch (fetchError: unknown) {
    const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    return { url, type: 'fetch', message: errMsg };
  }
}

async function warmPages(
  urls: string[], 
  forceRefresh: boolean, 
  concurrency: number = 5,
  logPrefix: string = ""
): Promise<{ results: WarmResult[]; errors: WarmError[] }> {
  const results: WarmResult[] = [];
  const errors: WarmError[] = [];

  // Process in batches for concurrency control
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchPromises = batch.map(path => warmUrl(`${BASE_URL}${path}`, forceRefresh));
    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if ('success' in result) {
        results.push(result);
        console.log(`${logPrefix}[${results.length + errors.length}/${urls.length}] ${result.success ? '✓' : '✗'} ${result.url} (${result.cache}, ${result.ms}ms)`);
      } else {
        errors.push(result);
        console.error(`${logPrefix}[${results.length + errors.length}/${urls.length}] ERROR ${result.url}: ${result.message}`);
      }
    }
  }

  return { results, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { 
      forceRefresh = false,
      background = false,
      includeNeighborhoods = true,
      includeCities = true,
      staticOnly = false,
      neighborhoodsOnly = false,
      stateFilter = undefined,
      concurrency = 5
    } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build URL list
    let allUrls: string[] = [];
    let cityCount = 0;
    let neighborhoodCount = 0;

    // If neighborhoodsOnly, skip static and cities
    if (!neighborhoodsOnly && !staticOnly) {
      allUrls = [...STATIC_PAGES];
    } else if (staticOnly) {
      allUrls = [...STATIC_PAGES];
    }

    if (!staticOnly) {
      if (includeCities && !neighborhoodsOnly) {
        const cityPages = await fetchCityPages(supabase);
        cityCount = cityPages.length;
        allUrls = [...allUrls, ...cityPages];
        console.log(`Found ${cityCount} city pages to warm`);
      }

      if (includeNeighborhoods || neighborhoodsOnly) {
        const neighborhoodPages = await fetchNeighborhoodPages(supabase, stateFilter);
        neighborhoodCount = neighborhoodPages.length;
        allUrls = [...allUrls, ...neighborhoodPages];
        console.log(`Found ${neighborhoodCount} neighborhood pages to warm${stateFilter ? ` (state: ${stateFilter})` : ''}`);
      }
    }

    console.log(`Total pages to warm: ${allUrls.length} (${STATIC_PAGES.length} static, ${cityCount} cities, ${neighborhoodCount} neighborhoods)`);

    if (background) {
      const jobId = crypto.randomUUID().substring(0, 8);
      
      (globalThis as any).EdgeRuntime?.waitUntil?.(
        (async () => {
          console.log(`Background job ${jobId} started - warming ${allUrls.length} pages`);
          const startTime = Date.now();
          
          try {
            const { results, errors } = await warmPages(allUrls, forceRefresh, concurrency, `[${jobId}] `);
            
            const summary = {
              job_id: jobId,
              total: allUrls.length,
              static_pages: STATIC_PAGES.length,
              city_pages: cityCount,
              neighborhood_pages: neighborhoodCount,
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
          pages: {
            total: allUrls.length,
            static: neighborhoodsOnly ? 0 : STATIC_PAGES.length,
            cities: cityCount,
            neighborhoods: neighborhoodCount
          },
          options: { forceRefresh, concurrency, includeCities, includeNeighborhoods, neighborhoodsOnly, stateFilter }
        }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Synchronous processing
    const startTime = Date.now();
    const { results, errors } = await warmPages(allUrls, forceRefresh, concurrency);

    const summary = {
      total: allUrls.length,
      static_pages: STATIC_PAGES.length,
      city_pages: cityCount,
      neighborhood_pages: neighborhoodCount,
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
