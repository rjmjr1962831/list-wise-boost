// supabase/functions/refresh-city-agent-counts/index.ts
// Refreshes the city_agent_counts cache table with qualified agent counts per city.
// Uses same logic as DynamicCategoryList: professional_cities (selected cities) + office zip.
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
    console.log('🔄 Starting city agent count refresh (professional_cities + office zip)...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active cities
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, slug, name, state, state_slug')
      .eq('active', true);

    if (citiesError || !cities?.length) {
      throw new Error(`Failed to fetch cities: ${citiesError?.message || 'No cities'}`);
    }

    // Agents who have selected ANY city (use their selection only; never office zip)
    const { data: anyPcRows } = await supabase
      .from('professional_cities')
      .select('professional_id')
      .eq('active', true);
    const idsWithSelectedCities = new Set((anyPcRows || []).map((r: any) => r.professional_id));

    // Get all professional_cities rows (professional_id, city_id)
    const { data: pcRows, error: pcError } = await supabase
      .from('professional_cities')
      .select('professional_id, city_id')
      .eq('active', true);

    if (pcError) throw new Error(`Failed to fetch professional_cities: ${pcError.message}`);

    // Build map: city_id -> Set of professional_ids
    const cityToProfs = new Map<string, Set<string>>();
    for (const r of pcRows || []) {
      if (!r.city_id || !r.professional_id) continue;
      if (!cityToProfs.has(r.city_id)) cityToProfs.set(r.city_id, new Set());
      cityToProfs.get(r.city_id)!.add(r.professional_id);
    }

    // Get neighborhood_catalog zips per city (city_area_slug -> zips)
    const { data: ncRows } = await supabase
      .from('neighborhood_catalog')
      .select('city_area_slug, zips, state')
      .eq('is_active', true);

    const cityZipsMap = new Map<string, Set<string>>();
    for (const r of ncRows || []) {
      const slug = r.city_area_slug;
      if (!slug) continue;
      const state = r.state || 'Arizona';
      if (!cityZipsMap.has(slug)) cityZipsMap.set(slug, new Set());
      if (Array.isArray(r.zips)) {
        r.zips.forEach((z: string) => cityZipsMap.get(slug)!.add(z));
      }
    }

    // Get all qualified professionals (active, 4.5+, 10+ reviews) with zip info
    const { data: allProfs, error: profsError } = await supabase
      .from('professionals')
      .select('id, business_zip, zip_code, state_slug')
      .eq('active', true)
      .gte('review_stars_rating', 4.5)
      .gte('num_total_reviews', 10);

    if (profsError) throw new Error(`Failed to fetch professionals: ${profsError.message}`);

    // Count per city using same logic as DynamicCategoryList
    const cityCounts: Record<string, { count: number; name: string }> = {};

    for (const city of cities) {
      const byId = new Set<string>();

      // 1) From professional_cities
      const idsFromPc = cityToProfs.get(city.id) || new Set();
      idsFromPc.forEach((id) => byId.add(id));

      // 2) From office zip (only for agents who have NOT selected cities)
      const citySlug = city.slug;
      const stateSlug = (city.state_slug || 'arizona').toLowerCase();
      const cityZips = cityZipsMap.get(citySlug);
      if (cityZips && cityZips.size > 0) {
        const zipList = Array.from(cityZips);
        for (const p of allProfs || []) {
          if (idsWithSelectedCities.has(p.id)) continue;
          const officeZip = (p.business_zip || p.zip_code || '').toString().trim();
          if (!officeZip || !cityZips.has(officeZip)) continue;
          if ((p.state_slug || '').toLowerCase() !== stateSlug) continue;
          byId.add(p.id);
        }
      }

      if (byId.size > 0) {
        cityCounts[citySlug] = { count: byId.size, name: city.name };
      }
    }

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

    const totalAgents = Object.values(cityCounts).reduce((sum, c) => sum + c.count, 0);
    console.log(`✅ Updated ${updates.length} cities with ${totalAgents} total agents`);
    
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
