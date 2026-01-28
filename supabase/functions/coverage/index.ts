import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const stateToSlug = (state: string): string => {
  const map: Record<string, string> = {
    'Arizona': 'arizona',
    'California': 'california',
  };
  return map[state] || state.toLowerCase().replace(/\s+/g, '-');
};

const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'coverage';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch neighborhoods with pagination
    const PAGE_SIZE = 1000;
    let allNeighborhoods: any[] = [];
    let nhOffset = 0;
    let nhHasMore = true;

    while (nhHasMore) {
      const { data, error } = await supabase
        .from('neighborhood_catalog')
        .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, primary_zip, state, tier, median_home_value')
        .in('state', ['Arizona', 'California'])
        .eq('is_active', true)
        .not('primary_zip', 'is', null)
        .order('city_area')
        .order('neighborhood')
        .range(nhOffset, nhOffset + PAGE_SIZE - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        allNeighborhoods = allNeighborhoods.concat(data);
        nhOffset += data.length;
        nhHasMore = data.length === PAGE_SIZE;
      } else {
        nhHasMore = false;
      }
    }

    // Fetch cities with pagination
    let allCities: any[] = [];
    let cityOffset = 0;
    let cityHasMore = true;

    while (cityHasMore) {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, slug, state, state_slug')
        .in('state_slug', ['arizona', 'california'])
        .eq('active', true)
        .order('state_slug')
        .order('name')
        .range(cityOffset, cityOffset + PAGE_SIZE - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        allCities = allCities.concat(data);
        cityOffset += data.length;
        cityHasMore = data.length === PAGE_SIZE;
      } else {
        cityHasMore = false;
      }
    }

    // Count by state
    const azNeighborhoods = allNeighborhoods.filter(n => n.state === 'Arizona');
    const caNeighborhoods = allNeighborhoods.filter(n => n.state === 'California');
    const azCities = allCities.filter(c => c.state_slug === 'arizona');
    const caCities = allCities.filter(c => c.state_slug === 'california');

    if (type === 'stats') {
      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        states: {
          arizona: { cities: azCities.length, neighborhoods: azNeighborhoods.length, status: 'active' },
          california: { cities: caCities.length, neighborhoods: caNeighborhoods.length, status: 'expanding' }
        },
        totals: { cities: allCities.length, neighborhoods: allNeighborhoods.length }
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
      });
    }

    if (type === 'sitemap') {
      const today = getTodayDate();
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      for (const n of allNeighborhoods) {
        const stateSlug = stateToSlug(n.state);
        xml += `  <url>\n    <loc>https://www.top10lists.us/${stateSlug}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }
      xml += `</urlset>`;
      return new Response(xml, {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' }
      });
    }

    // Default: coverage manifest
    const coverage = {
      "$schema": "https://top10lists.us/schemas/coverage.json",
      "version": "1.0",
      "lastUpdated": getTodayDate(),
      "publisher": {
        "name": "Top10Lists.us",
        "url": "https://www.top10lists.us",
        "description": "Merit-based real estate agent directory ranking top 0.2% using verified performance data."
      },
      "geographicCoverage": {
        "summary": {
          "totalStates": 2,
          "totalCities": allCities.length,
          "totalNeighborhoods": allNeighborhoods.length,
          "lastCalculated": getTodayDate()
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
              url: `https://www.top10lists.us/arizona/${c.slug}/top10realestateagents`
            })),
            "neighborhoodSample": azNeighborhoods.slice(0, 10).map(n => ({
              name: n.neighborhood,
              city: n.city_area,
              zip: n.primary_zip,
              url: `https://www.top10lists.us/arizona/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`
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
            "cityList": caCities.slice(0, 50).map(c => ({
              name: c.name,
              slug: c.slug,
              url: `https://www.top10lists.us/california/${c.slug}/top10realestateagents`
            }))
          }
        ]
      },
      "endpoints": {
        "coverage": "https://www.top10lists.us/coverage.json",
        "sitemap": "https://www.top10lists.us/sitemap-neighborhoods.xml",
        "llms": "https://www.top10lists.us/llms.txt",
        "mcp": "https://www.top10lists.us/mcp.json"
      },
      "urlPatterns": {
        "city": "https://www.top10lists.us/{state}/{city}/top10realestateagents",
        "neighborhood": "https://www.top10lists.us/{state}/{city}/{zip}/{neighborhood}/top10realestateagents",
        "agent": "https://www.top10lists.us/{state}/agents/{canonical-slug}"
      }
    };

    return new Response(JSON.stringify(coverage, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('geo-coverage error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
