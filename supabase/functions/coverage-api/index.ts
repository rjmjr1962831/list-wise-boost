import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stateToSlug = (abbr: string): string => {
  const map: Record<string, string> = {
    'AZ': 'arizona',
    'CA': 'california',
  };
  return map[abbr] || abbr.toLowerCase();
};

const stateSlugToName = (slug: string): string => {
  const map: Record<string, string> = {
    'arizona': 'Arizona',
    'california': 'California',
  };
  return map[slug] || slug;
};

const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'coverage';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch ALL active neighborhoods with pagination (bypasses 1000-row limit)
    const PAGE_SIZE = 1000;
    let allNeighborhoods: any[] = [];
    let nhOffset = 0;
    let nhHasMore = true;

    while (nhHasMore) {
      const { data, error } = await supabase
        .from('neighborhood_catalog')
        .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, primary_zip, state, tier, median_home_value')
        .in('state', ['AZ', 'CA'])
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
    const neighborhoods = allNeighborhoods;

    // Fetch ALL active cities with pagination
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
    const cities = allCities;

    // Count by state
    const azNeighborhoods = (neighborhoods || []).filter(n => n.state === 'AZ');
    const caNeighborhoods = (neighborhoods || []).filter(n => n.state === 'CA');
    const azCities = (cities || []).filter(c => c.state_slug === 'arizona');
    const caCities = (cities || []).filter(c => c.state_slug === 'california');

    if (type === 'coverage') {
      // Return JSON coverage manifest
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
            "totalCities": azCities.length + caCities.length,
            "totalNeighborhoods": azNeighborhoods.length + caNeighborhoods.length,
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
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    if (type === 'sitemap') {
      // Return XML sitemap of neighborhood pages
      const today = getTodayDate();
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      // Add all neighborhood URLs
      for (const n of neighborhoods || []) {
        const stateSlug = stateToSlug(n.state);
        const url = `https://www.top10lists.us/${stateSlug}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`;
        xml += `  <url>\n`;
        xml += `    <loc>${url}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += `  </url>\n`;
      }

      xml += `</urlset>`;

      return new Response(xml, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    if (type === 'stats') {
      // Return simple stats for monitoring
      const stats = {
        timestamp: new Date().toISOString(),
        states: {
          arizona: {
            cities: azCities.length,
            neighborhoods: azNeighborhoods.length,
            status: 'active'
          },
          california: {
            cities: caCities.length,
            neighborhoods: caNeighborhoods.length,
            status: 'expanding'
          }
        },
        totals: {
          cities: azCities.length + caCities.length,
          neighborhoods: azNeighborhoods.length + caNeighborhoods.length
        }
      };

      return new Response(JSON.stringify(stats, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Default: return help
    return new Response(JSON.stringify({
      error: 'Unknown type parameter',
      validTypes: ['coverage', 'sitemap', 'stats'],
      usage: {
        coverage: '/coverage-api?type=coverage - Full JSON coverage manifest',
        sitemap: '/coverage-api?type=sitemap - XML sitemap of neighborhood pages',
        stats: '/coverage-api?type=stats - Simple stats for monitoring'
      }
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('coverage-api error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
