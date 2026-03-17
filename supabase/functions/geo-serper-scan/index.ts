import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface City {
  id: string;
  name: string;
  state_slug: string;
  state: string;
}

interface SerperOrganic {
  title: string;
  link: string;
  snippet?: string;
  position: number;
}

interface SerperResponse {
  organic?: SerperOrganic[];
  searchParameters?: Record<string, string>;
  credits?: number;
}

// Rate limit: ~50ms between requests to stay well under Serper limits
const DELAY_MS = 100;
const BATCH_SIZE = 50; // Process cities in batches
const MAX_RESULTS = 20; // Check top 20 organic results

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serperKey = Deno.env.get("SERPER_API_KEY");

  if (!serperKey) {
    return new Response(
      JSON.stringify({ error: "SERPER_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Parse optional filters from request body
    const body = await req.json().catch(() => ({}));
    const stateFilter: string | null = body.state_slug || null;
    const cityLimit: number = body.limit || 0; // 0 = all
    const dryRun: boolean = body.dry_run || false;

    // Step 1: Get qualified cities (cities with at least one merit-gate agent)
    const qualifiedQuery = `
      SELECT DISTINCT c.id, c.name, c.state_slug, c.state
      FROM cities c
      INNER JOIN professionals p ON p.city_id = c.id
      WHERE c.active = true
        AND p.active = true
        AND p.review_stars_rating >= 4.5
        AND p.num_total_reviews >= 10
        ${stateFilter ? `AND c.state_slug = '${stateFilter.replace(/'/g, "''")}'` : ""}
      ORDER BY c.state_slug, c.name
    `;

    const { data: cityRows, error: cityErr } = await supabase.rpc("run_sql", {
      query: qualifiedQuery,
    });

    if (cityErr) throw new Error(`City query failed: ${cityErr.message}`);

    const scanDate = new Date().toISOString().split("T")[0];

    // Skip cities already scanned today (resume from where we left off)
    const { data: alreadyScanned } = await supabase.rpc("run_sql", {
      query: `SELECT city_id::text FROM geo_serp_results WHERE scan_date = '${scanDate}'`,
    });
    const scannedIds = new Set(((alreadyScanned as Array<{ city_id: string }>) || []).map((r) => r.city_id));

    let cities: City[] = (cityRows || []).filter((c: City) => !scannedIds.has(c.id));
    const skippedCount = (cityRows || []).length - cities.length;

    // Cap at 80 cities per invocation to stay under edge function timeout
    const MAX_PER_RUN = 80;
    if (cityLimit > 0) cities = cities.slice(0, Math.min(cityLimit, MAX_PER_RUN));
    else cities = cities.slice(0, MAX_PER_RUN);

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, cities_count: cities.length, skipped: skippedCount, sample: cities.slice(0, 5) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 GEO SERP scan starting: ${cities.length} cities (${skippedCount} already scanned today)`);
    let processed = 0;
    let found = 0;
    let cited = 0;
    let errors = 0;
    const results: Array<{ city: string; position: number | null; url: string | null }> = [];

    for (let i = 0; i < cities.length; i += BATCH_SIZE) {
      const batch = cities.slice(i, i + BATCH_SIZE);

      for (const city of batch) {
        try {
          const query = `best real estate agents in ${city.name} ${city.state}`;

          const serperRes = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "X-API-KEY": serperKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: query,
              gl: "us",
              hl: "en",
              num: MAX_RESULTS,
            }),
          });

          if (!serperRes.ok) {
            console.error(`Serper error for ${city.name}: ${serperRes.status}`);
            errors++;
            await sleep(DELAY_MS);
            continue;
          }

          const data: SerperResponse = await serperRes.json();
          const organic = data.organic || [];

          // Find top10lists.us in results
          const ourResult = organic.find((r) =>
            r.link?.includes("top10lists.us")
          );

          // Check if we're cited in any snippet (even if not in organic results)
          const citedInSnippet = organic.some(
            (r) => r.snippet?.toLowerCase().includes("top10lists") || false
          );

          const top5 = organic.slice(0, 5).map((r) => ({
            position: r.position,
            url: r.link,
            title: r.title?.substring(0, 100),
          }));

          // Upsert result
          const { error: upsertErr } = await supabase
            .from("geo_serp_results" as any)
            .upsert(
              {
                city_id: city.id,
                city_name: city.name,
                state_slug: city.state_slug,
                query,
                scan_date: scanDate,
                top10lists_position: ourResult?.position || null,
                top10lists_url: ourResult?.link || null,
                cited_as_source: !!ourResult || citedInSnippet,
                total_results: organic.length,
                top_competitors: top5,
              },
              { onConflict: "city_id,scan_date" }
            );

          if (upsertErr) {
            console.error(`Upsert error for ${city.name}: ${upsertErr.message}`);
            errors++;
          } else {
            processed++;
            if (ourResult) found++;
            if (ourResult || citedInSnippet) cited++;
            results.push({
              city: `${city.name}, ${city.state_slug}`,
              position: ourResult?.position || null,
              url: ourResult?.link || null,
            });
          }

          await sleep(DELAY_MS);
        } catch (e) {
          console.error(`Error processing ${city.name}:`, e);
          errors++;
        }
      }

      console.log(`📊 Progress: ${Math.min(i + BATCH_SIZE, cities.length)}/${cities.length} cities`);
    }

    // Check how many remain unscanned
    const totalQualified = (cityRows || []).length;
    const totalScannedNow = scannedIds.size + processed;
    const remaining = totalQualified - totalScannedNow;

    const summary = {
      scan_date: scanDate,
      total_cities: cities.length,
      skipped: skippedCount,
      processed,
      appearing: found,
      appearance_rate: processed > 0 ? `${((found / processed) * 100).toFixed(1)}%` : "0%",
      cited,
      errors,
      remaining,
      done: remaining <= 0,
      top_results: results.filter((r) => r.position !== null).sort((a, b) => (a.position || 99) - (b.position || 99)).slice(0, 10),
    };

    console.log(`✅ GEO SERP scan complete:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ GEO SERP scan error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
