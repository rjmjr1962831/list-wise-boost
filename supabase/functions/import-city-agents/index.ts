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
    const { cityId, categoryId } = await req.json();

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

    // Step 1: Run agenscrape to get profile URLs
    console.log('Step 1/2: Running agenscrape to fetch profile URLs...');
    const agenscrapeResult = await supabase.functions.invoke('fetch-agenscrape-agents', {
      body: { cityId, categoryId }
    });

    if (agenscrapeResult.error) {
      console.error('Agenscrape error:', agenscrapeResult.error);
      throw new Error(`Agenscrape failed: ${agenscrapeResult.error.message}`);
    }

    const agenscrapeData = agenscrapeResult.data;
    console.log(`Agenscrape completed: ${agenscrapeData?.total || 0} agents imported`);

    // Small delay between steps
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Run memo23 to enrich with detailed data
    console.log('Step 2/2: Running memo23 to enrich with licenses, videos, stats, bios...');
    const memo23Result = await supabase.functions.invoke('fetch-memo23-agents', {
      body: { cityId, categoryId }
    });

    if (memo23Result.error) {
      console.error('Memo23 error:', memo23Result.error);
      // Don't throw - agenscrape succeeded, so we have basic data
      return new Response(
        JSON.stringify({
          success: true,
          agenscrapeImported: agenscrapeData?.imported || 0,
          memo23Enriched: 0,
          warning: 'Enrichment failed but basic data imported',
          error: memo23Result.error.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const memo23Data = memo23Result.data;
    console.log(`Memo23 completed: ${memo23Data?.imported || 0} agents enriched`);

    return new Response(
      JSON.stringify({
        success: true,
        agenscrapeImported: agenscrapeData?.imported || 0,
        memo23Enriched: memo23Data?.imported || 0,
        message: `Successfully imported ${agenscrapeData?.imported || 0} agents and enriched ${memo23Data?.imported || 0} with full data`
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
