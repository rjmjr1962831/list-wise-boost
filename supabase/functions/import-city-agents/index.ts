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
    const { cityId, categoryId, maxResults = 50 } = await req.json();

    if (!cityId || !categoryId) {
      throw new Error('cityId and categoryId are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get city and category info for logging
    const { data: city } = await supabase
      .from('cities')
      .select('name, state')
      .eq('id', cityId)
      .single();

    const { data: category } = await supabase
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    console.log(`Starting full import for ${city?.name}, ${city?.state} - ${category?.name}`);

    // Step 1: Run getdataforme to get profile URLs
    console.log(`Step 1/2: Running getdataforme to fetch profile URLs (max ${maxResults})...`);
    const agenscrapeResult = await supabase.functions.invoke('fetch-agenscrape-agents', {
      body: { cityId, categoryId, maxResults }
    });

    if (agenscrapeResult.error) {
      console.error('Getdataforme error:', agenscrapeResult.error);
      throw new Error(`Getdataforme failed: ${agenscrapeResult.error.message}`);
    }

    const agenscrapeData = agenscrapeResult.data;
    console.log(`Getdataforme completed: ${agenscrapeData?.total || 0} agents imported`);

    // Kick off memo23 enrichment in the background so the client doesn't hang
    const backgroundEnrichment = async () => {
      try {
        // Small delay between steps
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Run memo23 to enrich with detailed data
        console.log('Step 2/2: Running memo23 to enrich with licenses, videos, stats, bios (concurrency=10)...');
        const memo23Result = await supabase.functions.invoke('fetch-memo23-agents', {
          body: { cityId, categoryId }
        });

        if (memo23Result.error) {
          console.error('Memo23 error (background):', memo23Result.error);
          return;
        }

        const memo23Data = memo23Result.data;
        console.log(`Memo23 completed in background: ${memo23Data?.imported || 0} agents enriched`);
      } catch (bgError) {
        console.error('Background memo23 enrichment failed:', bgError);
      }
    };

    // Use background task so the HTTP response can return immediately
    // while memo23 continues to run.
    // @ts-ignore - EdgeRuntime is provided by the Edge environment
    EdgeRuntime.waitUntil(backgroundEnrichment());

    return new Response(
      JSON.stringify({
        success: true,
        agenscrapeImported: agenscrapeData?.imported || 0,
        memo23EnrichmentStarted: true,
        message: `Started import for ${agenscrapeData?.imported || 0} agents; detailed enrichment is running in the background.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in import-city-agents:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
