// supabase/functions/refresh-city-agent-counts/index.ts
// Refreshes the city_agent_counts cache table with qualified agent counts per city.
// Run monthly via cron or manually when agents are added.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting city agent count refresh...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all qualified agents with their city info
    // Qualification: active, 4.8+ rating, 20+ reviews
    const { data: professionals, error: fetchError } = await supabase
      .from('professionals')
      .select(`
        id,
        city_id,
        cities!inner(slug, name)
      `)
      .eq('active', true)
      .gte('review_stars_rating', 4.8)
      .gte('num_total_reviews', 20);

    if (fetchError) {
      throw new Error(`Failed to fetch professionals: ${fetchError.message}`);
    }

    console.log(`📊 Found ${professionals?.length || 0} qualified agents`);

    // Count agents per city
    const cityCounts: Record<string, { count: number; name: string }> = {};
    
    (professionals || []).forEach((prof: any) => {
      const citySlug = prof.cities?.slug;
      const cityName = prof.cities?.name;
      if (citySlug && cityName) {
        if (!cityCounts[citySlug]) {
          cityCounts[citySlug] = { count: 0, name: cityName };
        }
        cityCounts[citySlug].count++;
      }
    });

    console.log(`🏙️ Agents distributed across ${Object.keys(cityCounts).length} cities`);

    // Prepare upsert data
    const updates = Object.entries(cityCounts).map(([citySlug, data]) => ({
      city_slug: citySlug,
      city_name: data.name,
      agent_count: data.count,
      last_updated: new Date().toISOString()
    }));

    if (updates.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No qualified agents found',
        citiesUpdated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Upsert to cache table
    const { error: upsertError } = await supabase
      .from('city_agent_counts')
      .upsert(updates, { onConflict: 'city_slug' });

    if (upsertError) {
      throw new Error(`Failed to update cache: ${upsertError.message}`);
    }

    // Log summary
    const totalAgents = Object.values(cityCounts).reduce((sum, c) => sum + c.count, 0);
    
    console.log(`✅ Updated ${updates.length} cities with ${totalAgents} total agents`);
    
    // Log top 5 cities
    const topCities = updates
      .sort((a, b) => b.agent_count - a.agent_count)
      .slice(0, 5);
    console.log('Top 5 cities:', topCities.map(c => `${c.city_name}: ${c.agent_count}`));

    return new Response(JSON.stringify({ 
      success: true, 
      citiesUpdated: updates.length,
      totalAgents: totalAgents,
      topCities: topCities,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error:', message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
