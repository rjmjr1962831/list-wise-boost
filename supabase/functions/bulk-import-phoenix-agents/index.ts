import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

declare const EdgeRuntime: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ZERO_RESULT_ATTEMPTS = 2; // Skip city after 2 attempts with 0 results

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

    console.log(`Starting bulk import for ${citiesNeedingAgents.length} cities needing agents`);

    // Create a progress tracking session
    const sessionId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('bulk_capture_progress')
      .insert({
        session_id: sessionId,
        status: 'running',
        total_cities: citiesNeedingAgents.length,
        current_index: 0,
        started_at: new Date().toISOString(),
        results: { 
          processed: [], 
          skipped: [],
          failed: [] 
        }
      });

    if (insertError) {
      console.error('Failed to create progress record:', insertError);
    }

    // Background task to process cities
    const backgroundImport = async () => {
      const results = { processed: [] as any[], skipped: [] as any[], failed: [] as any[] };
      
      for (let i = 0; i < citiesNeedingAgents.length; i++) {
        const city = citiesNeedingAgents[i];
        
        try {
          // Update progress
          await supabase
            .from('bulk_capture_progress')
            .update({
              current_index: i + 1,
              current_city: city.name,
              results
            })
            .eq('session_id', sessionId);

          console.log(`[${i + 1}/${citiesNeedingAgents.length}] Processing ${city.name}...`);
          
          // Call import-city-agents
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
            results.failed.push({ city: city.name, error: importError.message });
            continue;
          }

          const agentsImported = importData?.agentsImported || importData?.agenscrapeImported || 0;
          
          // Check if we got 0 results - might need to skip
          if (agentsImported === 0) {
            console.log(`⚠ ${city.name} returned 0 agents - skipping (scraper may not have data for this area)`);
            results.skipped.push({ city: city.name, reason: 'No agents found by scraper' });
          } else {
            console.log(`✓ ${city.name}: ${agentsImported} agents imported`);
            results.processed.push({ city: city.name, count: agentsImported });
          }
          
          // Delay between cities to manage rate limits
          await new Promise(resolve => setTimeout(resolve, 8000));
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed ${city.name}:`, errorMsg);
          results.failed.push({ city: city.name, error: errorMsg });
        }
      }
      
      // Mark as completed
      await supabase
        .from('bulk_capture_progress')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          current_index: citiesNeedingAgents.length,
          current_city: null,
          results
        })
        .eq('session_id', sessionId);

      console.log('Bulk import complete:', results);
    };

    // Start background task
    EdgeRuntime.waitUntil(backgroundImport());

    return new Response(
      JSON.stringify({ 
        message: 'Bulk import started',
        sessionId,
        citiesNeedingAgents: citiesNeedingAgents.map(c => c.name),
        totalCitiesNeedingAgents: citiesNeedingAgents.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
