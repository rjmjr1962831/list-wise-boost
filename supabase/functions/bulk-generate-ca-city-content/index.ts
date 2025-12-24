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
    const { regenerate = false, limit = 20, offset = 0 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get California cities with active agents
    const { data: citiesWithAgents, error: citiesError } = await supabase
      .rpc('get_ca_cities_with_agents') as { data: { name: string; slug: string }[] | null; error: any };

    // Fallback: Get all CA cities if RPC doesn't exist
    let citiesToCheck: { name: string; slug: string }[] = [];
    
    if (citiesError || !citiesWithAgents) {
      console.log('RPC not available, fetching cities directly...');
      
      // Get cities with active professionals
      const { data: professionals } = await supabase
        .from('professionals')
        .select('city_id')
        .eq('active', true);
      
      const cityIds = [...new Set(professionals?.map(p => p.city_id) || [])];
      
      const { data: cities } = await supabase
        .from('cities')
        .select('name, slug')
        .eq('state', 'California')
        .in('id', cityIds)
        .order('name');
      
      citiesToCheck = cities || [];
    } else {
      citiesToCheck = citiesWithAgents;
    }

    // Apply offset and limit
    const paginatedCities = citiesToCheck.slice(offset, offset + limit);

    // Check which cities already have content
    const { data: existingContent } = await supabase
      .from('marketing_content')
      .select('page')
      .like('page', 'city-%')
      .eq('section', 'market_overview')
      .eq('key', 'full_content');

    const existingPages = new Set(existingContent?.map(c => c.page) || []);
    
    const citiesToProcess = regenerate 
      ? paginatedCities 
      : paginatedCities.filter(c => !existingPages.has(`city-${c.slug}`));

    console.log(`Found ${citiesToProcess.length} CA cities to process (offset: ${offset}, limit: ${limit}, total: ${citiesToCheck.length})`);

    const results: { city: string; success: boolean; error?: string; cached?: boolean }[] = [];

    // Process each city with a delay to avoid rate limits
    for (const city of citiesToProcess) {
      try {
        console.log(`Generating content for ${city.name}, CA...`);
        
        // Call the generate function
        const response = await supabase.functions.invoke('generate-ca-city-content', {
          body: { 
            cityName: city.name, 
            citySlug: city.slug,
            stateName: 'California',
            stateAbbrev: 'CA',
            regenerate 
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const wasCached = response.data?.cached === true;
        results.push({ city: city.name, success: true, cached: wasCached });
        console.log(`✅ ${wasCached ? 'Cached' : 'Generated'} content for ${city.name}`);

        // Small delay between requests to avoid rate limits
        if (!wasCached) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed for ${city.name}:`, errorMessage);
        results.push({ city: city.name, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const generatedCount = results.filter(r => r.success && !r.cached).length;
    const cachedCount = results.filter(r => r.success && r.cached).length;

    console.log(`\n=== Bulk CA City Content Generation Complete ===`);
    console.log(`Generated: ${generatedCount}, Cached: ${cachedCount}, Failed: ${failCount}`);

    return new Response(JSON.stringify({
      success: true,
      totalCities: citiesToCheck.length,
      processed: results.length,
      successCount,
      generatedCount,
      cachedCount,
      failCount,
      results,
      hasMore: offset + limit < citiesToCheck.length,
      nextOffset: offset + limit
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Bulk generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
