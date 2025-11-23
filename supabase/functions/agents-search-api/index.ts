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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const city = url.searchParams.get('city');
    const state = url.searchParams.get('state') || 'Arizona';
    const zipcode = url.searchParams.get('zipcode');
    const specialty = url.searchParams.get('specialty');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    console.log('API search params:', { city, state, zipcode, specialty, limit });

    // Build base query
    let cityQuery = supabase
      .from('cities')
      .select('id, name, state, slug, state_slug')
      .eq('active', true);

    if (city) {
      cityQuery = cityQuery.eq('slug', city.toLowerCase().replace(/\s+/g, '-'));
    }
    if (state) {
      cityQuery = cityQuery.eq('state', state);
    }

    const { data: cityData, error: cityError } = await cityQuery.limit(1).single();
    
    if (cityError || !cityData) {
      console.error('City not found:', cityError);
      throw new Error('City not found');
    }

    // Build professionals query
    let query = supabase
      .from('professionals')
      .select(`
        id,
        name,
        description,
        email,
        phone,
        website,
        zillow_profile_url,
        specialty,
        review_stars_rating,
        num_total_reviews,
        years_experience,
        company,
        address,
        zip_code,
        image_url,
        type
      `)
      .eq('active', true)
      .eq('city_id', cityData.id)
      .gte('review_stars_rating', 4.8)
      .gte('num_total_reviews', 100)
      .order('review_stars_rating', { ascending: false })
      .limit(limit);

    // Filter by zipcode if provided
    if (zipcode) {
      query = query.eq('zip_code', zipcode);
    }

    // Filter by specialty if provided
    if (specialty) {
      query = query.contains('specialty', [specialty]);
    }

    const { data: agents, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log(`Found ${agents?.length || 0} agents`);

    // Transform to Schema.org JSON-LD format
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": `Top 10 Real Estate Agents in ${cityData.name}, ${cityData.state}`,
      "description": `AI and human curated list of the top 10 real estate agents in ${cityData.name}, ${cityData.state}. Qualified with 4.8+ star ratings and 100+ verified reviews.`,
      "numberOfItems": agents?.length || 0,
      "itemListElement": agents?.map((agent, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "RealEstateAgent",
          "@id": `https://top10lists.us/agent/${agent.id}`,
          "name": agent.name,
          "description": agent.description || `Professional real estate agent serving ${cityData.name}, ${cityData.state}`,
          "email": agent.email || undefined,
          "telephone": agent.phone || undefined,
          "url": agent.website || agent.zillow_profile_url || undefined,
          "image": agent.image_url || undefined,
          "address": agent.address ? {
            "@type": "PostalAddress",
            "streetAddress": agent.address,
            "addressLocality": cityData.name,
            "addressRegion": cityData.state,
            "postalCode": agent.zip_code || undefined
          } : undefined,
          "areaServed": {
            "@type": "City",
            "name": cityData.name,
            "containedInPlace": {
              "@type": "State",
              "name": cityData.state
            }
          },
          "knowsAbout": agent.specialty || [],
          "aggregateRating": agent.review_stars_rating ? {
            "@type": "AggregateRating",
            "ratingValue": agent.review_stars_rating,
            "reviewCount": agent.num_total_reviews,
            "bestRating": 5,
            "worstRating": 1
          } : undefined,
          "yearsInOperation": agent.years_experience || undefined,
          "memberOf": agent.company ? {
            "@type": "Organization",
            "name": agent.company
          } : undefined
        }
      }))
    };

    return new Response(
      JSON.stringify(structuredData, null, 2),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/ld+json',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      }
    );

  } catch (error) {
    console.error('Error in agents-search-api:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        "@context": "https://schema.org",
        "@type": "ItemList",
        "numberOfItems": 0,
        "itemListElement": []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
