// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
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
const PRERENDER_TOKEN = Deno.env.get("PRERENDER_TOKEN");
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get("CLOUDFLARE_KV_NAMESPACE_ID");
const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
const WARM_SECRET = Deno.env.get("WARM_SECRET");
const WORKER_WARM_URL = "https://www.top10lists.us/__warm";

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
  "/for-ai-systems",
  "/transparency",
  "/ai-liability",
  "/ai-citation-whitepaper",
  "/protocol-services",
  // Editorial & Press
  "/press",
  "/editorial-updates",
  // Info
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

const EMPTY_ROOT_PATTERN = /<div id="root"[^>]*>\s*<\/div>/i;

function hasAgentContent(html: string): boolean {
  return html.includes('itemtype="https://schema.org/RealEstateAgent"') ||
    html.includes("data-professional-id") ||
    html.includes("professional-card");
}

function hasStructuredData(html: string): boolean {
  return html.includes("application/ld+json") &&
    (html.includes("RealEstateAgent") || html.includes("ItemList"));
}

function isMarkdownArtifact(content: string): boolean {
  return !!content && content.length >= 500 &&
    (content.startsWith("# ") || content.includes("## `") || content.includes("REASONING_NUGGET") || content.includes("MARKET_AUDIT_GRID"));
}

function validateRenderedHtml(html: string, url: string): { ok: boolean; reason?: string } {
  if (!html || html.length < 500) {
    return { ok: false, reason: "Response too short" };
  }

  // Support markdown artifact format (worker returns text/markdown)
  if (isMarkdownArtifact(html)) {
    return { ok: true };
  }

  // Legacy HTML validation
  if (html.length < 1000 || !html.includes("</html>")) {
    return { ok: false, reason: "Invalid HTML response" };
  }

  if (EMPTY_ROOT_PATTERN.test(html)) {
    return { ok: false, reason: "Empty React shell detected" };
  }

  const isAgentList = url.includes("/top10realestateagents");
  if (isAgentList) {
    if (!hasAgentContent(html) && !hasStructuredData(html)) {
      return { ok: false, reason: "No agent content detected" };
    }
    if (html.length < 30000) {
      return { ok: false, reason: "Rendered content too small for agent list" };
    }
  }

  return { ok: true };
}

function urlToSanitizedCacheKey(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 512);
}

function buildCacheKeys(url: string): string[] {
  const rawKey = url;
  const sanitizedKey = urlToSanitizedCacheKey(url);
  return sanitizedKey !== rawKey ? [rawKey, sanitizedKey] : [rawKey];
}

async function fetchPrerenderedHtml(url: string, forceRefresh: boolean): Promise<{ success: boolean; html?: string; status?: number; error?: string }> {
  if (!PRERENDER_TOKEN) {
    return { success: false, error: "PRERENDER_TOKEN not configured" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`https://service.prerender.io/${url}`, {
      headers: {
        "X-Prerender-Token": PRERENDER_TOKEN,
        "Prerender-Force-Reload": forceRefresh ? "true" : "false",
        "User-Agent": "Top10Lists-CacheWarmer/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, status: response.status, error: `Prerender HTTP ${response.status}` };
    }

    const html = await response.text();
    return { success: true, html, status: response.status };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMsg };
  }
}

async function fetchBotHtml(url: string, forceRefresh: boolean): Promise<{ success: boolean; html?: string; status?: number; cache?: string; rendered?: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const headers: Record<string, string> = {
      "X-Cache-Warming": "true",
      "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) GPTBot/1.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    if (forceRefresh) {
      headers["X-Force-Refresh"] = "true";
    }

    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, status: response.status, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    return {
      success: true,
      html,
      status: response.status,
      cache: response.headers.get("X-Worker-Cache") || response.headers.get("X-Cache") || "unknown",
      rendered: response.headers.get("X-Rendered") || "unknown",
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMsg };
  }
}

async function writeToWorkerCache(url: string, content: string, format?: "html" | "markdown"): Promise<{ success: boolean; error?: string }> {
  if (!WARM_SECRET) {
    return { success: false, error: "WARM_SECRET not configured" };
  }
  const body = format === "markdown" ? { url, html: content, format: "markdown" } : { url, html: content };
  try {
    const response = await fetch(WORKER_WARM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Warm-Secret": WARM_SECRET,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Worker warm failed: ${response.status} ${text}` };
    }
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

async function writeToKv(cacheKey: string, html: string): Promise<{ success: boolean; error?: string }> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID || !CLOUDFLARE_API_TOKEN) {
    return { success: false, error: "Missing Cloudflare KV credentials" };
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(cacheKey)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "text/html; charset=utf-8",
      },
      body: html,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `KV write failed: ${response.status} ${errorText}` };
  }

  return { success: true };
}

async function fetchCityPages(supabase: any, stateFilter?: string): Promise<string[]> {
  let query = supabase
    .from("cities")
    .select("slug, state_slug")
    .eq("active", true);
  if (stateFilter) {
    const slug = stateFilter.toLowerCase().replace(/\s+/g, "-");
    query = query.eq("state_slug", slug);
  }
  const { data: cities, error } = await query;

  if (error) {
    console.error("Error fetching cities:", error);
    return [];
  }

  return (cities || []).map((city: any) =>
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
    const startTime = Date.now();
    const canWriteKv = Boolean(CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_KV_NAMESPACE_ID && CLOUDFLARE_API_TOKEN);
    let html = "";
    let renderMethod = "unknown";
    let status = 0;
    let cacheStatus = "unknown";

    const botResult = await fetchBotHtml(url, forceRefresh);
    if (botResult.success && botResult.html) {
      const botValidation = validateRenderedHtml(botResult.html, url);
      if (botValidation.ok) {
        html = botResult.html;
        renderMethod = botResult.rendered || "worker";
        status = botResult.status || 200;
        cacheStatus = botResult.cache || "unknown";
      }
    }

    if (!html && PRERENDER_TOKEN && canWriteKv) {
      const prerenderResult = await fetchPrerenderedHtml(url, forceRefresh);
      if (!prerenderResult.success || !prerenderResult.html) {
        return { url, type: "fetch", message: prerenderResult.error || "Prerender fetch failed" };
      }

      html = prerenderResult.html;
      renderMethod = "prerender-io";
      status = prerenderResult.status || 200;
      cacheStatus = "KV";
    }

    if (!html) {
      return { url, type: "fetch", message: botResult.error || "Bot fetch failed" };
    }

    const validation = validateRenderedHtml(html, url);
    if (!validation.ok) {
      return { url, type: "validation", message: validation.reason || "Validation failed" };
    }

    // Primary: write to Worker cache (same store bots read from). This fixes low hit rate.
    const workerResult = await writeToWorkerCache(url, html, isMarkdownArtifact(html) ? "markdown" : "html");
    if (!workerResult.success && WARM_SECRET) {
      console.warn(`Worker cache write failed for ${url}: ${workerResult.error}`);
    }

    // Optional: also write to KV for other consumers
    if (PRERENDER_TOKEN && canWriteKv) {
      const cacheKeys = buildCacheKeys(url);
      for (const cacheKey of cacheKeys) {
        await writeToKv(cacheKey, html);
      }
    }

    const elapsed = Date.now() - startTime;
    const size = new TextEncoder().encode(html).length;
    const success = status === 200 && renderMethod !== "fallback";

    return {
      url,
      status,
      cache: cacheStatus,
      rendered: renderMethod,
      size,
      ms: elapsed,
      success
    };
  } catch (fetchError: unknown) {
    const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    return { url, type: "fetch", message: errMsg };
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
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { 
      forceRefresh = false,
      force = false,
      background = false,
      includeNeighborhoods = true,
      includeCities = true,
      staticOnly = false,
      neighborhoodsOnly = false,
      stateFilter = undefined,
      concurrency = 5,
      limit = undefined,
      offset = 0,
      region = undefined,
      list_urls_only = false
    } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const shouldForceRefresh = forceRefresh || force;
    const effectiveStateFilter = stateFilter ?? (typeof region === "string" && region ? region : undefined);

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
        const cityPages = await fetchCityPages(supabase, effectiveStateFilter);
        cityCount = cityPages.length;
        allUrls = [...allUrls, ...cityPages];
        console.log(`Found ${cityCount} city pages to warm`);
      }

      if (includeNeighborhoods || neighborhoodsOnly) {
        const neighborhoodPages = await fetchNeighborhoodPages(supabase, effectiveStateFilter);
        neighborhoodCount = neighborhoodPages.length;
        allUrls = [...allUrls, ...neighborhoodPages];
        console.log(`Found ${neighborhoodCount} neighborhood pages to warm${effectiveStateFilter ? ` (state: ${effectiveStateFilter})` : ''}`);
      }
    }

    const totalCount = allUrls.length;
    if (list_urls_only) {
      const fullUrls = allUrls.map((p) => (p === "/" ? BASE_URL + "/" : BASE_URL + p));
      return new Response(JSON.stringify({ urls: fullUrls, total: fullUrls.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batchLimit = typeof limit === "number" && limit > 0 ? limit : allUrls.length;
    const batchOffset = typeof offset === "number" && offset >= 0 ? Math.min(offset, allUrls.length) : 0;
    const batchUrls = allUrls.slice(batchOffset, batchOffset + batchLimit);
    const hasMore = batchOffset + batchLimit < allUrls.length;
    const nextOffset = batchOffset + batchLimit;

    console.log(`Total pages to warm: ${allUrls.length} (${STATIC_PAGES.length} static, ${cityCount} cities, ${neighborhoodCount} neighborhoods); batch ${batchOffset}-${batchOffset + batchUrls.length}`);

    if (background && batchUrls.length === allUrls.length) {
      const jobId = crypto.randomUUID().substring(0, 8);
      
      (globalThis as any).EdgeRuntime?.waitUntil?.(
        (async () => {
          console.log(`Background job ${jobId} started - warming ${allUrls.length} pages`);
          const startTime = Date.now();
          
          try {
            const { results, errors } = await warmPages(allUrls, shouldForceRefresh, concurrency, `[${jobId}] `);
            
            const summary = {
              job_id: jobId,
              total: allUrls.length,
              static_pages: STATIC_PAGES.length,
              city_pages: cityCount,
              neighborhood_pages: neighborhoodCount,
              successful: results.filter(r => r.success).length,
              cached: results.filter(r => r.cache === "HIT").length,
              rendered: results.filter(r => r.rendered === "browser-rest-api").length,
              prerendered: results.filter(r => r.rendered === "prerender-io").length,
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
          options: { forceRefresh: shouldForceRefresh, concurrency, includeCities, includeNeighborhoods, neighborhoodsOnly, stateFilter }
        }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Synchronous processing (batch or full)
    const startTime = Date.now();
    const { results, errors } = await warmPages(batchUrls, shouldForceRefresh, concurrency);

    const successful = results.filter(r => r.success).length;
    const summary = {
      total: totalCount,
      static_pages: STATIC_PAGES.length,
      city_pages: cityCount,
      neighborhood_pages: neighborhoodCount,
      successful,
      cached: results.filter(r => r.cache === "HIT").length,
      rendered: results.filter(r => r.rendered === "browser-rest-api").length,
      prerendered: results.filter(r => r.rendered === "prerender-io").length,
      fallback: results.filter(r => r.rendered === "fallback").length,
      failed: errors.length,
      duration_ms: Date.now() - startTime
    };

    if (typeof limit === "number" && limit > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          total: totalCount,
          warmed: successful,
          failed: errors.length,
          hasMore,
          nextOffset,
          errors: errors.map((e: WarmError) => e.message || e.type),
          summary,
          results,
          errors
        }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
