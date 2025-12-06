import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

declare const EdgeRuntime: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all Phoenix-area cities (Arizona state)
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, name, slug')
      .eq('state', 'Arizona')
      .eq('active', true);

    if (citiesError) throw citiesError;

    // Get the Real Estate Agent category ID
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (categoryError) {
      console.error('Category query error:', categoryError);
      throw new Error(`Real Estate Agent category lookup failed: ${categoryError.message}`);
    }
    
    if (!category) {
      throw new Error('Real Estate Agent category not found with slug: top10realestateagents');
    }

    // Check which cities need agents (less than 10 qualified)
    const citiesNeedingAgents: typeof cities = [];
    for (const city of cities || []) {
      const { count } = await supabase
        .from('professionals')
        .select('id', { count: 'exact', head: true })
        .eq('city_id', city.id)
        .eq('active', true)
        .gte('review_stars_rating', 4.8)
        .gte('num_total_reviews', 50);
      
      if ((count || 0) < 10) {
        citiesNeedingAgents.push(city);
      }
    }

    console.log(`Starting bulk import for ${citiesNeedingAgents.length} cities needing agents (out of ${cities?.length || 0} total)`);

    // Background task to process cities needing agents
    const backgroundImport = async () => {
      for (const city of citiesNeedingAgents) {
        try {
          console.log(`Processing ${city.name}...`);
          
          // Call import-city-agents for this city (4.8★ + 50 reviews criteria)
          const { data: importData, error: importError } = await supabase.functions.invoke(
            'import-city-agents',
            {
              body: { 
                cityId: city.id,
                categoryId: category.id,
                maxResults: 50
              }
            }
          );

          if (importError) {
            console.error(`Error importing ${city.name}:`, importError);
            continue;
          }

          console.log(`✓ Completed ${city.name}: ${importData?.agentsImported || importData?.agenscrapeImported || 0} agents imported`);
          
          // Delay between cities to manage rate limits
          await new Promise(resolve => setTimeout(resolve, 10000));
          
        } catch (error) {
          console.error(`Failed to process ${city.name}:`, error);
        }
      }
      
      console.log('Bulk import complete for all Phoenix cities');
    };

    // Start background task
    EdgeRuntime.waitUntil(backgroundImport());

    // Return immediately
    return new Response(
      JSON.stringify({ 
        message: 'Bulk import started in background',
        citiesNeedingAgents: citiesNeedingAgents.map(c => c.name),
        totalCitiesNeedingAgents: citiesNeedingAgents.length,
        totalCities: cities?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in bulk-import-phoenix-agents:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
