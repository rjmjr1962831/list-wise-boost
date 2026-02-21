/**
 * pre-render-batch
 * Iterates active cities and/or neighborhoods, calls pre-render-page for each,
 * and writes the result to Cloudflare KV via the Worker's __prerender-store endpoint.
 * Auth: X-Enrichment-Key. Env: WORKER_STORE_URL (e.g. https://www.top10lists.us/__prerender-store), WARM_SECRET.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENRICHMENT_KEY = "t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a";
const PRE_RENDER_PAGE_URL = "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/pre-render-page";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const key = req.headers.get("X-Enrichment-Key");
  if (key !== ENRICHMENT_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  let body: { scope?: string; state_slug?: string; type?: string; concurrency?: number; dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const scope = body.scope === "state" ? "state" : "all";
  const state_slug = (body.state_slug || "").toLowerCase();
  const type = body.type === "neighborhood" ? "neighborhood" : body.type === "city" ? "city" : "all";
  const concurrency = Math.min(Math.max(Number(body.concurrency) || 5, 1), 20);
  const dry_run = !!body.dry_run;

  if (scope === "state" && !state_slug) {
    return new Response(JSON.stringify({ error: "state_slug required when scope=state" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const workerStoreUrl = Deno.env.get("WORKER_STORE_URL") || "https://www.top10lists.us/__prerender-store";
  const warmSecret = Deno.env.get("WARM_SECRET");

  const pages: { type: "city" | "neighborhood"; state_slug: string; city_slug: string; neighborhood_slug?: string }[] = [];

  if (type === "city" || type === "all") {
    let cityQuery = supabase.from("cities").select("state_slug, slug").eq("active", true);
    if (scope === "state") cityQuery = cityQuery.eq("state_slug", state_slug);
    const { data: cities } = await cityQuery;
    for (const c of cities || []) {
      pages.push({ type: "city", state_slug: c.state_slug, city_slug: c.slug });
    }
  }

  if (type === "neighborhood" || type === "all") {
    let nhQuery = supabase
      .from("neighborhood_catalog")
      .select("state, city_area_slug, neighborhood_slug")
      .eq("is_active", true);
    if (scope === "state") nhQuery = nhQuery.eq("state", state_slug);
    const { data: neighborhoods } = await nhQuery;
    for (const n of neighborhoods || []) {
      const stateSlug = (n.state || "").toLowerCase().replace(/\s+/g, "-");
      pages.push({
        type: "neighborhood",
        state_slug: stateSlug,
        city_slug: n.city_area_slug,
        neighborhood_slug: n.neighborhood_slug,
      });
    }
  }

  const total = pages.length;
  let success = 0;
  let failed = 0;
  const failures: { key: string; error: string }[] = [];
  let totalSizeBytes = 0;
  const start = Date.now();

  async function processOne(
    page: { type: "city" | "neighborhood"; state_slug: string; city_slug: string; neighborhood_slug?: string },
    index: number
  ): Promise<void> {
    const kvKey =
      page.type === "city"
        ? `clean/${page.state_slug}/${page.city_slug}`
        : `clean/${page.state_slug}/${page.city_slug}/${page.neighborhood_slug}`;
    try {
      const prerenderBody =
        page.type === "city"
          ? { type: "city", state_slug: page.state_slug, city_slug: page.city_slug }
          : { type: "neighborhood", state_slug: page.state_slug, city_slug: page.city_slug, neighborhood_slug: page.neighborhood_slug };
      const res = await fetch(PRE_RENDER_PAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Enrichment-Key": ENRICHMENT_KEY },
        body: JSON.stringify(prerenderBody),
      });
      if (!res.ok) {
        const errText = await res.text();
        failures.push({ key: kvKey, error: `pre-render ${res.status}: ${errText.slice(0, 200)}` });
        failed++;
        return;
      }
      const data = await res.json();
      const html = data.html;
      const meta = data.metadata || {};
      if (!html || typeof html !== "string") {
        failures.push({ key: kvKey, error: "No html in response" });
        failed++;
        return;
      }
      totalSizeBytes += meta.html_size || html.length;
      if (!dry_run && warmSecret) {
        const storeRes = await fetch(workerStoreUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Warm-Secret": warmSecret },
          body: JSON.stringify({ key: kvKey, html, metadata: { ...meta, generated_at: meta.generated_at || new Date().toISOString() } }),
        });
        if (!storeRes.ok) {
          const errText = await storeRes.text();
          failures.push({ key: kvKey, error: `store ${storeRes.status}: ${errText.slice(0, 200)}` });
          failed++;
          return;
        }
      }
      success++;
      const agentCount = meta.agent_count ?? 0;
      const nhCount = meta.neighborhood_count ?? 0;
      const sizeKb = Math.round((meta.html_size || html.length) / 1024);
      console.log(`[${index + 1}/${total}] Rendered ${page.state_slug}/${page.city_slug}${page.neighborhood_slug ? "/" + page.neighborhood_slug : ""} (${agentCount} agents${page.type === "city" ? ", " + nhCount + " neighborhoods" : ""}, ${sizeKb} KB)`);
    } catch (e) {
      failures.push({ key: kvKey, error: String(e && (e as Error).message) });
      failed++;
    }
  }

  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    await Promise.all(batch.map((p, j) => processOne(p, i + j)));
  }

  const duration_seconds = (Date.now() - start) / 1000;
  const total_size_mb = Math.round((totalSizeBytes / 1024 / 1024) * 100) / 100;

  return new Response(
    JSON.stringify({
      total,
      success,
      failed,
      failures: failures.slice(0, 50),
      total_size_mb,
      duration_seconds,
      dry_run,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
