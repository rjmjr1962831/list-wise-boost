/**
 * serve-stats-json -- Live site statistics as JSON
 *
 * Returns agent counts (total + by state), city count, neighborhood count,
 * live states, and merit gate criteria. Designed for programmatic consumers.
 *
 * GET /stats.json (via Vercel rewrite)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STATE_SLUGS = ["arizona", "california"];
const STATE_ABBREV: Record<string, string> = {
  arizona: "AZ",
  california: "CA",
};
const STATE_PROPER: Record<string, string> = {
  arizona: "Arizona",
  california: "California",
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

    const agentsByState: Record<string, number> = {};
    const statesLive: string[] = [];
    let agentsTotal = 0;
    let citiesTotal = 0;
    let neighborhoodsTotal = 0;

    for (const state of STATE_SLUGS) {
      const abbrev = STATE_ABBREV[state];
      const proper = STATE_PROPER[state];

      const [agentsRes, citiesRes, nhRes] = await Promise.all([
        supabase
          .from("professionals")
          .select("*", { count: "exact", head: true })
          .eq("active", true)
          .eq("state_slug", state)
          .not("canonical_slug", "is", null),
        supabase
          .from("cities")
          .select("*", { count: "exact", head: true })
          .eq("active", true)
          .eq("state_slug", state),
        supabase
          .from("neighborhood_catalog")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("state", proper),
      ]);

      const agents = agentsRes.count ?? 0;
      const cities = citiesRes.count ?? 0;
      const neighborhoods = nhRes.count ?? 0;

      agentsByState[abbrev] = agents;
      agentsTotal += agents;
      citiesTotal += cities;
      neighborhoodsTotal += neighborhoods;

      if (agents > 0) statesLive.push(abbrev);
    }

    const result = {
      agents_total: agentsTotal,
      agents_by_state: agentsByState,
      cities_total: citiesTotal,
      neighborhoods_total: neighborhoodsTotal,
      states_live: statesLive.sort(),
      merit_gate: {
        min_rating: 4.5,
        min_reviews: 10,
        review_window_months: 24,
        min_years_experience: 5,
      },
      last_updated: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("serve-stats-json error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
