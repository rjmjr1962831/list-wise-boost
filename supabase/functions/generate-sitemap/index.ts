import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// State abbreviation to slug mapping
const stateSlugMap: Record<string, string> = {
  'AZ': 'arizona',
  'Arizona': 'arizona',
  'CA': 'california',
  'California': 'california',
};

// States to include in sitemap (indexable states only)
const INDEXABLE_STATES = ['Arizona', 'California', 'AZ', 'CA'];

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Paginated fetch helper to bypass 1000-row limit
async function fetchAllPaginated(
  supabase: any,
  table: string,
  columns: string,
  filters: { column: string; op: string; value: any }[],
  orderBy: string
): Promise<any[]> {
  const allResults: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(columns)
      .order(orderBy)
      .range(offset, offset + pageSize - 1);

    // Apply filters
    for (const filter of filters) {
      if (filter.op === 'eq') {
        query = query.eq(filter.column, filter.value);
      } else if (filter.op === 'in') {
        query = query.in(filter.column, filter.value);
      } else if (filter.op === 'not.is') {
        query = query.not(filter.column, 'is', filter.value);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`);
    }

    if (data && data.length > 0) {
      allResults.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allResults;
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

    console.log('[generate-sitemap] Starting sitemap generation with pagination...');

    // Fetch cities with pagination - Arizona and California only (indexable)
    const cities = await fetchAllPaginated(
      supabase,
      'cities',
      'slug, state, state_slug',
      [
        { column: 'active', op: 'eq', value: true },
        { column: 'state', op: 'in', value: ['Arizona', 'California'] }
      ],
      'slug'
    );

    // Fetch neighborhoods with pagination - Arizona and California only (indexable)
    const neighborhoods = await fetchAllPaginated(
      supabase,
      'neighborhood_catalog',
      'neighborhood_slug, city_area_slug, state, primary_zip',
      [
        { column: 'is_active', op: 'eq', value: true },
        { column: 'state', op: 'in', value: ['Arizona', 'California'] },
        { column: 'primary_zip', op: 'not.is', value: null }
      ],
      'neighborhood_slug'
    );

    console.log(`[generate-sitemap] Found ${cities.length} cities and ${neighborhoods.length} neighborhoods (AZ + CA)`);

    // Build XML sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add city pages (priority 0.8) - skip entries with empty slugs
    for (const city of cities) {
      if (!city.slug || city.slug.trim() === '') continue;
      const stateSlug = city.state_slug || stateSlugMap[city.state] || city.state.toLowerCase();
      const url = `${baseUrl}/${stateSlug}/${city.slug}/top10realestateagents`;
      
      xml += '  <url>\n';
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }

    // Add neighborhood pages with ZIP (priority 0.7) - 5-segment format
    for (const neighborhood of neighborhoods) {
      const stateSlug = stateSlugMap[neighborhood.state] || neighborhood.state.toLowerCase().replace(/\s+/g, '-');
      const url = `${baseUrl}/${stateSlug}/${neighborhood.city_area_slug}/${neighborhood.primary_zip}/${neighborhood.neighborhood_slug}/top10realestateagents`;
      
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
        'Cache-Control': 'public, max-age=3600',
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
