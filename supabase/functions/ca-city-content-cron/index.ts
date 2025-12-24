import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Track processing state
interface CityContentState {
  currentIndex: number;
  isRunning: boolean;
  totalCities: number;
  processedCount: number;
  startedAt: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 5;
    const regenerate = body.regenerate || false;

    // Get all California cities with active agents
    const { data: professionals } = await supabase
      .from('professionals')
      .select('city_id')
      .eq('active', true);
    
    const cityIds = [...new Set(professionals?.map(p => p.city_id) || [])];
    
    const { data: allCities } = await supabase
      .from('cities')
      .select('name, slug')
      .eq('state', 'California')
      .in('id', cityIds)
      .order('name');

    if (!allCities || allCities.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No California cities with agents found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check which cities need content
    const { data: existingContent } = await supabase
      .from('marketing_content')
      .select('page')
      .like('page', 'city-%')
      .eq('section', 'market_overview')
      .eq('key', 'full_content');

    const existingPages = new Set(existingContent?.map(c => c.page) || []);
    
    const citiesToProcess = regenerate 
      ? allCities 
      : allCities.filter(c => !existingPages.has(`city-${c.slug}`));

    if (citiesToProcess.length === 0) {
      console.log('All California cities already have content generated!');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All California cities already have content!',
        totalCities: allCities.length,
        remaining: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`=== CA City Content Cron: ${citiesToProcess.length} cities remaining ===`);

    // Process a batch
    const batch = citiesToProcess.slice(0, batchSize);
    const results: { city: string; success: boolean; error?: string }[] = [];

    for (const city of batch) {
      try {
        console.log(`Generating content for ${city.name}, CA...`);
        
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

        results.push({ city: city.name, success: true });
        console.log(`✅ Generated content for ${city.name}`);

        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed for ${city.name}:`, errorMessage);
        results.push({ city: city.name, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const remainingCount = citiesToProcess.length - batch.length;

    console.log(`Batch complete: ${successCount}/${batch.length} successful, ${remainingCount} remaining`);

    return new Response(JSON.stringify({
      success: true,
      batchProcessed: batch.length,
      successCount,
      remainingCities: remainingCount,
      totalCities: allCities.length,
      results,
      complete: remainingCount === 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('CA city content cron error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
