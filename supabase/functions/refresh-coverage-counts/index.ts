/**
 * refresh-coverage-counts — Daily cron that snapshots live coverage numbers.
 *
 * Queries professionals, cities, neighborhoods tables and writes a single
 * JSON row to static_pages (slug: "coverage-counts"). Every edge function
 * and prebuild script reads from this row — single source of truth for
 * all published numbers.
 *
 * pg_cron: 0 12 * * * (5:00 AM MST daily)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Count active agents by state
    const { data: agentData } = await sb.rpc("run_sql", {
      query: `SELECT
        count(*) FILTER (WHERE active = true AND canonical_slug IS NOT NULL) AS total,
        count(*) FILTER (WHERE active = true AND canonical_slug IS NOT NULL AND state_slug = 'arizona') AS az,
        count(*) FILTER (WHERE active = true AND canonical_slug IS NOT NULL AND state_slug = 'california') AS ca,
        count(*) FILTER (WHERE active = true AND canonical_slug IS NOT NULL AND state_slug = 'texas') AS tx
      FROM professionals`,
    });

    // Count cities with qualified agents (Sitemap Rule A)
    const { data: cityData } = await sb.rpc("run_sql", {
      query: `SELECT
        COUNT(DISTINCT p.city_id) FILTER (WHERE p.state_slug = 'arizona') AS az,
        COUNT(DISTINCT p.city_id) FILTER (WHERE p.state_slug = 'california') AS ca,
        COUNT(DISTINCT p.city_id) FILTER (WHERE p.state_slug = 'texas') AS tx,
        COUNT(DISTINCT p.city_id) AS total
      FROM professionals p
      WHERE p.active = true AND p.city_id IS NOT NULL
        AND p.review_stars_rating >= 4.5 AND p.num_total_reviews >= 10`,
    });

    // Count active neighborhoods in qualified cities
    const { data: nhData } = await sb.rpc("run_sql", {
      query: `SELECT
        COUNT(*) FILTER (WHERE LOWER(REPLACE(nc.state, ' ', '_')) = 'arizona') AS az,
        COUNT(*) FILTER (WHERE LOWER(REPLACE(nc.state, ' ', '_')) = 'california') AS ca,
        COUNT(*) FILTER (WHERE LOWER(REPLACE(nc.state, ' ', '_')) = 'texas') AS tx,
        COUNT(*) AS total
      FROM neighborhood_catalog nc
      WHERE nc.is_active = true AND nc.primary_zip IS NOT NULL`,
    });

    const agents = agentData?.[0] || {};
    const cities = cityData?.[0] || {};
    const neighborhoods = nhData?.[0] || {};

    const snapshot = {
      agents: {
        total: Number(agents.total) || 0,
        az: Number(agents.az) || 0,
        ca: Number(agents.ca) || 0,
        tx: Number(agents.tx) || 0,
      },
      cities: {
        total: Number(cities.total) || 0,
        az: Number(cities.az) || 0,
        ca: Number(cities.ca) || 0,
        tx: Number(cities.tx) || 0,
      },
      neighborhoods: {
        total: Number(neighborhoods.total) || 0,
        az: Number(neighborhoods.az) || 0,
        ca: Number(neighborhoods.ca) || 0,
        tx: Number(neighborhoods.tx) || 0,
      },
      analyzed: 670000,
      updated_at: new Date().toISOString(),
    };

    // Upsert to static_pages
    const { error } = await sb.from("static_pages").upsert(
      {
        slug: "coverage-counts",
        html: JSON.stringify(snapshot),
        rendered_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    );

    if (error) throw error;

    console.log("Coverage counts refreshed:", JSON.stringify(snapshot));

    return new Response(JSON.stringify(snapshot, null, 2), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("refresh-coverage-counts error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
