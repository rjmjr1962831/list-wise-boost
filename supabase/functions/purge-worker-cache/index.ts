// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WARM_SECRET = Deno.env.get("WARM_SECRET");
const WORKER_PURGE_URL = "https://www.top10lists.us/__purge";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!WARM_SECRET) {
      return new Response(
        JSON.stringify({ success: false, error: "WARM_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get full URL list from warm-cache (same list used for warming)
    const warmRes = await fetch(`${SUPABASE_URL}/functions/v1/warm-cache`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ list_urls_only: true }),
    });

    if (!warmRes.ok) {
      const text = await warmRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `warm-cache list failed: ${warmRes.status} ${text}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { urls } = (await warmRes.json()) as { urls?: string[] };
    if (!Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, purged: 0, message: "No URLs to purge" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Purge in batches to avoid huge request body (e.g. 500 at a time)
    const batchSize = 500;
    let totalPurged = 0;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const purgeRes = await fetch(WORKER_PURGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Warm-Secret": WARM_SECRET,
        },
        body: JSON.stringify({ urls: batch }),
      });
      if (!purgeRes.ok) {
        const text = await purgeRes.text();
        return new Response(
          JSON.stringify({ success: false, error: `Worker purge failed: ${purgeRes.status} ${text}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const data = (await purgeRes.json()) as { purged?: number };
      totalPurged += data.purged ?? 0;
    }

    return new Response(
      JSON.stringify({ success: true, purged: totalPurged, total: urls.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
