import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active cities with their agent counts
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select(`
        id,
        name,
        slug,
        state,
        state_slug,
        updated_at
      `)
      .eq('active', true)
      .order('name');

    if (citiesError) {
      console.error('Error fetching cities:', citiesError);
      throw citiesError;
    }

    // Get agent counts per city
    const { data: categories } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    const categoryId = categories?.id;

    // Build city data with agent counts
    const cityData = await Promise.all(
      (cities || []).map(async (city) => {
        let agentCount = 0;
        
        if (categoryId) {
          const { count } = await supabase
            .from('professionals')
            .select('*', { count: 'exact', head: true })
            .eq('city_id', city.id)
            .eq('category_id', categoryId)
            .eq('active', true)
            .gte('review_stars_rating', 4.8)
            .gte('num_total_reviews', 50);
          
          agentCount = count || 0;
        }

        return {
          city: city.name,
          state: city.state,
          slug: city.slug,
          stateSlug: city.state_slug,
          agentCount,
          listUrl: `https://www.top10lists.us/${city.state_slug}/${city.slug}/top10realestateagents`,
          qaUrl: `https://www.top10lists.us/${city.state_slug}/${city.slug}/best-real-estate-agents-${new Date().getFullYear()}`,
          lastUpdated: city.updated_at,
        };
      })
    );

    // Filter to only cities with agents
    const activeCities = cityData.filter(c => c.agentCount > 0);

    const currentYear = new Date().getFullYear();
    const lastUpdated = new Date().toISOString();

    const contentIndex = {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "name": "Top10Lists.us Real Estate Agents Database",
      "description": "An AI and human curated list of the top 10 real estate agents in U.S. markets. Agents qualified with 4.8+ star ratings and 20+ verified reviews.",
      "url": "https://www.top10lists.us",
      "version": "2.1",
      "dateModified": lastUpdated.split('T')[0],
      "lastUpdated": lastUpdated,
      "keywords": [
        "real estate agents",
        "top 10 realtors",
        "verified agents",
        "agent reviews",
        "real estate professionals",
        ...activeCities.slice(0, 10).map(c => `${c.city} real estate agents`),
      ],
      "creator": {
        "@type": "Organization",
        "name": "Top10Lists.us",
        "description": "AI and human curated directory of top 10 real estate agents in U.S. markets"
      },
      "distribution": [
        {
          "@type": "DataDownload",
          "encodingFormat": "application/ld+json",
          "contentUrl": `${supabaseUrl}/functions/v1/agents-search-api`,
          "description": "Search agents by city, state, zipcode, or specialty. Returns structured Schema.org JSON-LD data."
        }
      ],
      "spatialCoverage": activeCities.map(c => ({
        "@type": "Place",
        "name": c.city,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": c.city,
          "addressRegion": c.state
        }
      })),
      "temporalCoverage": currentYear.toString(),
      "contentSize": `${activeCities.reduce((sum, c) => sum + c.agentCount, 0)}+ verified agents`,
      "markets": activeCities.map(c => ({
        city: c.city,
        state: c.state,
        agentCount: c.agentCount,
        listUrl: c.listUrl,
        qaUrl: c.qaUrl,
        lastUpdated: c.lastUpdated,
      })),
      "queryParameters": {
        "city": {
          "description": "City name",
          "type": "string",
          "required": true,
          "examples": activeCities.slice(0, 6).map(c => c.city)
        },
        "state": {
          "description": "State name (defaults to Arizona)",
          "type": "string",
          "required": false,
          "default": "Arizona"
        },
        "zipcode": {
          "description": "5-digit zip code for location-specific search",
          "type": "string",
          "required": false
        },
        "specialty": {
          "description": "Agent specialty or expertise area",
          "type": "string",
          "required": false,
          "examples": [
            "Buyer Representation",
            "Listing Agent",
            "Relocation",
            "Luxury Homes",
            "First-Time Buyers",
            "Investment Properties"
          ]
        },
        "limit": {
          "description": "Maximum number of results (default: 10)",
          "type": "integer",
          "required": false,
          "default": 10,
          "maximum": 50
        }
      },
      "exampleQueries": activeCities.slice(0, 4).map(c => ({
        "name": `Top agents in ${c.city}`,
        "url": `${supabaseUrl}/functions/v1/agents-search-api?city=${encodeURIComponent(c.city.toLowerCase())}&state=${encodeURIComponent(c.state)}`
      })),
      "qualificationCriteria": {
        "minimumRating": 4.8,
        "minimumReviews": 50,
        "verificationStatus": "AI and human curated",
        "listFormat": "Top 10 agents per market",
        "dataFreshness": "Updated weekly from Zillow and verified sources"
      }
    };

    console.log(`Generated AI content index with ${activeCities.length} markets`);

    return new Response(JSON.stringify(contentIndex, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error generating AI content index:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
