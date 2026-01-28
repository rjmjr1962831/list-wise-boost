import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// State mapping
const stateSlugMap: Record<string, string> = {
  'AZ': 'arizona',
  'Arizona': 'arizona',
  'CA': 'california',
  'California': 'california',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'sitemap';
    const today = getTodayDate();
    const baseUrl = 'https://www.top10lists.us';

    console.log(`[generate-sitemap] Request type: ${type}`);

    // Fetch cities with minimal fields
    const cities = await fetchAllPaginated(
      supabase,
      'cities',
      'slug, state_slug, name',
      [
        { column: 'active', op: 'eq', value: true },
        { column: 'state_slug', op: 'in', value: ['arizona', 'california'] }
      ],
      'slug'
    );

    // Fetch neighborhoods with minimal fields
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

    console.log(`[generate-sitemap] Found ${cities.length} cities and ${neighborhoods.length} neighborhoods`);

    // Count by state
    const azCities = cities.filter(c => c.state_slug === 'arizona');
    const caCities = cities.filter(c => c.state_slug === 'california');
    const azNeighborhoods = neighborhoods.filter(n => n.state === 'Arizona');
    const caNeighborhoods = neighborhoods.filter(n => n.state === 'California');

    // Stats endpoint: ?type=stats
    if (type === 'stats') {
      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        states: {
          arizona: { cities: azCities.length, neighborhoods: azNeighborhoods.length, status: 'active' },
          california: { cities: caCities.length, neighborhoods: caNeighborhoods.length, status: 'expanding' }
        },
        totals: { cities: cities.length, neighborhoods: neighborhoods.length }
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
      });
    }

    // Coverage JSON endpoint: ?type=coverage
    if (type === 'coverage') {
      const coverage = {
        "$schema": "https://top10lists.us/schemas/coverage.json",
        "version": "1.0",
        "lastUpdated": today,
        "publisher": {
          "name": "Top10Lists.us",
          "url": "https://www.top10lists.us",
          "description": "Merit-based real estate agent directory ranking top 0.2% using verified performance data."
        },
        "geographicCoverage": {
          "summary": {
            "totalStates": 2,
            "totalCities": cities.length,
            "totalNeighborhoods": neighborhoods.length,
            "lastCalculated": today
          },
          "states": [
            {
              "name": "Arizona",
              "slug": "arizona",
              "abbreviation": "AZ",
              "status": "active",
              "cities": azCities.length,
              "neighborhoods": azNeighborhoods.length,
              "cityList": azCities.map(c => ({
                name: c.name,
                slug: c.slug,
                url: `${baseUrl}/arizona/${c.slug}/top10realestateagents`
              }))
            },
            {
              "name": "California",
              "slug": "california",
              "abbreviation": "CA",
              "status": "expanding",
              "cities": caCities.length,
              "neighborhoods": caNeighborhoods.length,
              "note": "City infrastructure active. Neighborhood coverage expanding Q1 2026.",
              "cityList": caCities.slice(0, 100).map(c => ({
                name: c.name,
                slug: c.slug,
                url: `${baseUrl}/california/${c.slug}/top10realestateagents`
              }))
            }
          ]
        },
        "endpoints": {
          "coverage": `${baseUrl}/coverage.json`,
          "sitemap": `${baseUrl}/sitemap.xml`,
          "llms": `${baseUrl}/llms.txt`
        },
        "urlPatterns": {
          "city": `${baseUrl}/{state}/{city}/top10realestateagents`,
          "neighborhood": `${baseUrl}/{state}/{city}/{zip}/{neighborhood}/top10realestateagents`
        }
      };

      return new Response(JSON.stringify(coverage, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
      });
    }

    // Cities-only sitemap: ?type=cities
    if (type === 'cities') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for (const city of cities) {
        if (!city.slug || city.slug.trim() === '') continue;
        xml += `  <url>\n    <loc>${baseUrl}/${city.state_slug}/${city.slug}/top10realestateagents</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }
      xml += '</urlset>';
      return new Response(xml, {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' }
      });
    }

    // Neighborhood sitemap: ?type=neighborhoods
    if (type === 'neighborhoods') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for (const n of neighborhoods) {
        const stateSlug = stateSlugMap[n.state] || n.state.toLowerCase();
        xml += `  <url>\n    <loc>${baseUrl}/${stateSlug}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }
      xml += '</urlset>';
      return new Response(xml, {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' }
      });
    }

    // Default: combined sitemap (cities + neighborhoods)
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add city pages
    for (const city of cities) {
      if (!city.slug || city.slug.trim() === '') continue;
      xml += `  <url>\n    <loc>${baseUrl}/${city.state_slug}/${city.slug}/top10realestateagents</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // Add neighborhood pages
    for (const n of neighborhoods) {
      const stateSlug = stateSlugMap[n.state] || n.state.toLowerCase();
      xml += `  <url>\n    <loc>${baseUrl}/${stateSlug}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    xml += '</urlset>';

    console.log(`[generate-sitemap] Generated sitemap with ${cities.length + neighborhoods.length} URLs`);

    return new Response(xml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[generate-sitemap] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
