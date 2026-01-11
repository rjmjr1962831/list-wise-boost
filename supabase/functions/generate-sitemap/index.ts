import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// State abbreviation to slug mapping
const stateSlugMap: Record<string, string> = {
  'AZ': 'arizona',
  'CA': 'california',
  'TX': 'texas',
  'FL': 'florida',
  'NY': 'new-york',
  'CO': 'colorado',
  'NV': 'nevada',
  'WA': 'washington',
  'OR': 'oregon',
  'UT': 'utah',
};

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = getTodayDate();
    const baseUrl = 'https://www.top10lists.us';

    console.log('[generate-sitemap] Starting sitemap generation...');

    // Fetch cities and neighborhoods in parallel
    // RESTRICTED TO ARIZONA ONLY for now
    const [citiesResult, neighborhoodsResult] = await Promise.all([
      supabase
        .from('cities')
        .select('slug, state, state_slug')
        .eq('active', true)
        .eq('state', 'Arizona')
        .order('slug'),
      supabase
        .from('neighborhood_catalog')
        .select('neighborhood_slug, city_area_slug, state')
        .eq('is_active', true)
        .eq('state', 'AZ')
        .order('neighborhood_slug')
    ]);

    if (citiesResult.error) {
      console.error('[generate-sitemap] Cities query error:', citiesResult.error);
      throw new Error(`Failed to fetch cities: ${citiesResult.error.message}`);
    }

    if (neighborhoodsResult.error) {
      console.error('[generate-sitemap] Neighborhoods query error:', neighborhoodsResult.error);
      throw new Error(`Failed to fetch neighborhoods: ${neighborhoodsResult.error.message}`);
    }

    const cities = citiesResult.data || [];
    const neighborhoods = neighborhoodsResult.data || [];

    console.log(`[generate-sitemap] Found ${cities.length} Arizona cities and ${neighborhoods.length} Arizona neighborhoods`);

    // Build XML sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add city pages (priority 0.8)
    for (const city of cities) {
      const stateSlug = city.state_slug || stateSlugMap[city.state] || city.state.toLowerCase();
      const url = `${baseUrl}/${stateSlug}/${city.slug}/top10realestateagents`;
      
      xml += '  <url>\n';
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }

    // Add neighborhood pages (priority 0.7)
    for (const neighborhood of neighborhoods) {
      const stateSlug = stateSlugMap[neighborhood.state] || 'arizona';
      const url = `${baseUrl}/${stateSlug}/${neighborhood.city_area_slug}/${neighborhood.neighborhood_slug}/top10realestateagents`;
      
      xml += '  <url>\n';
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    const totalUrls = cities.length + neighborhoods.length;
    console.log(`[generate-sitemap] Generated sitemap with ${totalUrls} URLs`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // 1 hour cache
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[generate-sitemap] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
