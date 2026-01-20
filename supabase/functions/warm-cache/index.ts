import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

async function warmStaticPages(forceRefresh: boolean): Promise<{
  results: WarmResult[];
  errors: WarmError[];
  totalUrls: number;
}> {
  const results: WarmResult[] = [];
  const errors: WarmError[] = [];

  console.log(`Warming ${STATIC_PAGES.length} static pages`);

  for (let i = 0; i < STATIC_PAGES.length; i++) {
    const url = STATIC_PAGES[i];
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
      
      results.push({
        url,
        status: response.status,
        cache: cacheStatus,
        rendered: renderMethod,
        size: parseInt(contentLength),
        ms: elapsed,
        success
      });

      console.log(`[${i + 1}/${STATIC_PAGES.length}] ${success ? '✓' : '✗'} ${url} (${cacheStatus}, ${elapsed}ms)`);

    } catch (fetchError: unknown) {
      const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      errors.push({ url, type: 'fetch', message: errMsg });
      console.error(`[${i + 1}/${STATIC_PAGES.length}] ERROR ${url}: ${errMsg}`);
    }
  }

  return { results, errors, totalUrls: STATIC_PAGES.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { 
      forceRefresh = false,
      background = false
    } = body;

    if (background) {
      const jobId = crypto.randomUUID().substring(0, 8);
      
      (globalThis as any).EdgeRuntime?.waitUntil?.(
        (async () => {
          console.log(`Background job ${jobId} started`);
          const startTime = Date.now();
          
          try {
            const { results, errors, totalUrls } = await warmStaticPages(forceRefresh);
            
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
          pages: STATIC_PAGES.length
        }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Synchronous processing
    const startTime = Date.now();
    const { results, errors, totalUrls } = await warmStaticPages(forceRefresh);

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
