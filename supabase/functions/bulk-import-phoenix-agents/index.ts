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

    console.log(`Starting bulk import for ${cities?.length || 0} Phoenix-area cities`);

    // Background task to process all cities
    const backgroundImport = async () => {
      for (const city of cities || []) {
        try {
          console.log(`Processing ${city.name}...`);
          
          // Call import-city-agents for this city with 300 agents max
          const { data: importData, error: importError } = await supabase.functions.invoke(
            'import-city-agents',
            {
              body: { 
                cityId: city.id,
                categoryId: category.id,
                maxResults: 300
              }
            }
          );

          if (importError) {
            console.error(`Error importing ${city.name}:`, importError);
            continue;
          }

          console.log(`✓ Completed ${city.name}: ${importData?.agenscrapeImported || 0} agents imported, ${importData?.memo23Enriched || 0} enriched`);
          
          // Delay between cities to avoid rate limits
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
        cities: cities?.map(c => c.name) || [],
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
