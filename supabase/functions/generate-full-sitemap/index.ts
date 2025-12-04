import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating full sitemap from database...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active cities
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('slug, state_slug, name')
      .eq('active', true)
      .order('name');

    if (citiesError) {
      console.error('Error fetching cities:', citiesError);
      throw citiesError;
    }

    console.log(`Found ${cities?.length || 0} active cities`);

    const baseUrl = 'https://top10lists.us';
    const today = new Date().toISOString().split('T')[0];

    // Build sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Auto-generated sitemap - ${today} -->
<!-- Total cities: ${cities?.length || 0} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- AI Content Index -->
  <url>
    <loc>${baseUrl}/.well-known/ai-content-index.json</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- Static Pages -->
  <url><loc>${baseUrl}/about</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${baseUrl}/ranking-methodology</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${baseUrl}/privacy</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${baseUrl}/terms</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${baseUrl}/sms-terms</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${baseUrl}/agent-info</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>
  <url><loc>${baseUrl}/check-profile</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>
  <url><loc>${baseUrl}/join</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/agent-onboarding</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  
  <!-- State Landing -->
  <url><loc>${baseUrl}/arizona</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
`;

    // Add all city pages (3 variants per city)
    if (cities) {
      for (const city of cities) {
        const cityPath = `${baseUrl}/${city.state_slug}/${city.slug}`;
        
        // Main listing page
        sitemap += `  <url><loc>${cityPath}/top10realestateagents</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>\n`;
        
        // Q&A landing pages
        sitemap += `  <url><loc>${cityPath}/best-real-estate-agents</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
        sitemap += `  <url><loc>${cityPath}/best-real-estate-agents-2025</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
      }
    }

    sitemap += '</urlset>';

    const urlCount = 11 + (cities?.length || 0) * 3; // static pages + city pages
    console.log(`Generated sitemap with ${urlCount} URLs`);

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
