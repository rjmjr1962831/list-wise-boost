/**
 * coverage-stats -- Live coverage statistics as JSON
 * Returns current agent/city/neighborhood counts from the database.
 * Declared in mcp.json as hourly-refresh resource.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATES = ['arizona', 'california'];
const STATE_NAME_MAP: Record<string, string> = { arizona: 'Arizona', california: 'California' };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const stateStats: Record<string, { agents: number; cities: number; neighborhoods: number }> = {};
    let totalAgents = 0, totalCities = 0, totalNeighborhoods = 0;

    // Fetch city IDs that have at least one qualifying agent (Sitemap Rule A)
    // This matches the filter in generate-static-sitemaps.ts
    const { data: qualifiedCityRows } = await supabase.rpc('run_sql', {
      query: `
        SELECT DISTINCT p.city_id::text AS city_id, p.state_slug
        FROM professionals p
        WHERE p.active = true
          AND p.city_id IS NOT NULL
          AND p.review_stars_rating >= 4.5
          AND p.num_total_reviews >= 10
          AND p.state_slug IN ('arizona', 'california')
      `
    });
    const qualifiedCityIdsByState: Record<string, Set<string>> = { arizona: new Set(), california: new Set() };
    for (const row of qualifiedCityRows || []) {
      if (qualifiedCityIdsByState[row.state_slug]) {
        qualifiedCityIdsByState[row.state_slug].add(row.city_id);
      }
    }

    // Count neighborhoods in cities that have qualifying agents (matches sitemap Rule A).
    // The sitemap includes a neighborhood if its parent city has at least one qualifying agent.
    const { data: qualifiedNhRows } = await supabase.rpc('run_sql', {
      query: `
        SELECT
          CASE WHEN nc.state = 'Arizona' THEN 'arizona' ELSE 'california' END AS state_slug,
          COUNT(*) AS nh_count
        FROM neighborhood_catalog nc
        JOIN cities c ON c.slug = nc.city_area_slug AND c.state_slug = CASE WHEN nc.state = 'Arizona' THEN 'arizona' ELSE 'california' END
        WHERE nc.is_active = true
          AND nc.primary_zip IS NOT NULL
          AND nc.state IN ('Arizona', 'California')
          AND c.active = true
          AND c.id IN (
            SELECT DISTINCT p.city_id
            FROM professionals p
            WHERE p.active = true
              AND p.city_id IS NOT NULL
              AND p.review_stars_rating >= 4.5
              AND p.num_total_reviews >= 10
              AND p.state_slug IN ('arizona', 'california')
          )
        GROUP BY 1
      `
    });
    const qualifiedNhByState: Record<string, number> = { arizona: 0, california: 0 };
    if (qualifiedNhRows) {
      for (const row of qualifiedNhRows) {
        qualifiedNhByState[row.state_slug] = parseInt(row.nh_count, 10) || 0;
      }
    }

    for (const state of STATES) {
      const [agentsRes] = await Promise.all([
        supabase.from('professionals').select('*', { count: 'exact', head: true })
          .eq('active', true).eq('state_slug', state).not('canonical_slug', 'is', null),
      ]);

      const agents = agentsRes.count ?? 0;
      // Only count cities/neighborhoods that have qualifying agents (matching sitemap)
      const cities = qualifiedCityIdsByState[state]?.size ?? 0;
      const neighborhoods = qualifiedNhByState[state] ?? 0;

      stateStats[state] = { agents, cities, neighborhoods };
      totalAgents += agents;
      totalCities += cities;
      totalNeighborhoods += neighborhoods;
    }

    const result = {
      generated_at: new Date().toISOString(),
      states: stateStats,
      totals: {
        agents: totalAgents,
        cities: totalCities,
        neighborhoods: totalNeighborhoods,
        analyzed: 670000,
      },
      merit_gate: {
        stars: 4.5,
        reviews: 10,
        window_months: 24,
        years_experience: 5,
      },
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('coverage-stats error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
