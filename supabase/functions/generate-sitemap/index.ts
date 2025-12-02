import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating dynamic sitemap...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active cities
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('slug, state_slug, name, state')
      .eq('active', true)
      .order('name');

    if (citiesError) {
      console.error('Error fetching cities:', citiesError);
      throw citiesError;
    }

    // Fetch all active categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('slug, name')
      .eq('active', true)
      .order('name');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      throw categoriesError;
    }

    console.log(`Found ${cities?.length || 0} cities and ${categories?.length || 0} categories`);

    // Build sitemap XML
    const baseUrl = 'https://top10lists.us';
    const apiBaseUrl = 'https://bgdtekbhelormzbymkhh.supabase.co/functions/v1';
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- AI Content Index -->
  <url>
    <loc>${baseUrl}/.well-known/ai-content-index.json</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
`;

    // Add API endpoints for AI discovery - dynamically for cities with agents
    sitemap += `
  <!-- API Endpoints for AI Discovery -->
`;
    
    // Get cities that have agents (either direct or via professional_cities)
    const { data: citiesWithAgents, error: agentsError } = await supabase
      .rpc('get_cities_with_agents');
    
    // Fallback: if RPC doesn't exist, use major cities
    const apiCities = agentsError 
      ? cities?.filter(c => ['phoenix', 'scottsdale', 'gilbert', 'mesa', 'chandler', 'tempe', 'glendale', 'peoria'].includes(c.slug))
      : citiesWithAgents;
    
    if (apiCities && Array.isArray(apiCities)) {
      for (const city of apiCities.slice(0, 20)) { // Limit to top 20 cities for API discovery
        const citySlug = city.slug || city;
        sitemap += `  <url>
    <loc>${apiBaseUrl}/agents-search-api?city=${citySlug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;
      }
    }

    // Add dynamic city + category pages
    sitemap += `
  <!-- Dynamic City & Category Pages -->
`;
    
    if (cities && categories) {
      for (const city of cities) {
        for (const category of categories) {
          sitemap += `  <url>
    <loc>${baseUrl}/${city.state_slug}/${city.slug}/${category.slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;
        }
      }
    }

    // Add static pages
    sitemap += `
  <!-- Agent Pages -->
  <url>
    <loc>${baseUrl}/join</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/agent-onboarding</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <!-- Legal & Info Pages -->
  <url>
    <loc>${baseUrl}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/agent-info</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  
  <!-- Featured Real Estate Agent Pages -->
  <url>
    <loc>${baseUrl}/arizona/gilbert/top10realestateagents</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/arizona/scottsdale/top10realestateagents</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/arizona/phoenix/top10realestateagents</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

    console.log('Sitemap generated successfully');

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
