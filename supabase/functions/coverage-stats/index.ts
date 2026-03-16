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

    for (const state of STATES) {
      const [agentsRes, citiesRes, nhRes] = await Promise.all([
        supabase.from('professionals').select('*', { count: 'exact', head: true })
          .eq('active', true).eq('state_slug', state).not('canonical_slug', 'is', null),
        supabase.from('cities').select('*', { count: 'exact', head: true })
          .eq('active', true).eq('state_slug', state),
        supabase.from('neighborhood_catalog').select('*', { count: 'exact', head: true })
          .eq('is_active', true).eq('state', state === 'arizona' ? 'Arizona' : 'California'),
      ]);

      const agents = agentsRes.count ?? 0;
      const cities = citiesRes.count ?? 0;
      const neighborhoods = nhRes.count ?? 0;

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
