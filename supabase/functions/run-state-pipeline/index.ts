import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fire and forget - just kick off the Apify run, don't wait
async function startCityApifyRun(
  city: string,
  state: string,
  cityId: string,
  categoryId: string,
  apifyToken: string
): Promise<{ city: string; runId?: string; error?: string }> {
  try {
    console.log(`[${city}] Starting Rigelbytes scrape...`);

    const actorId = 'rigelbytes~zillow-agents';
    const actorInput = {
      search_keywords: [`${city}, ${state}`],
      max_agents: 50,
      detailed_profiles: true,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    };

    const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error(`[${city}] Failed to start Rigelbytes:`, errorText);
      return { city, error: `Failed to start: ${runResponse.status}` };
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`[${city}] ✅ Rigelbytes started with run ID: ${runId}`);

    return { city, runId };
  } catch (error) {
    console.error(`[${city}] Error:`, error);
    return { city, error: error instanceof Error ? error.message : String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { state = 'California', stateAbbr = 'CA', startIndex = 0, maxCities = 10 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Get category ID for real estate agents
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (!category) {
      throw new Error('Real estate agents category not found');
    }

    // Get all distinct cities from state_licenses for this state
    const { data: cities, error: citiesError } = await supabase
      .from('state_licenses')
      .select('city')
      .eq('state', stateAbbr)
      .not('city', 'is', null);

    if (citiesError) {
      throw new Error(`Failed to fetch cities: ${citiesError.message}`);
    }

    // Get unique cities
    const uniqueCities = [...new Set(cities?.map(c => c.city).filter(Boolean) || [])].sort();
    console.log(`Found ${uniqueCities.length} unique cities in ${state}`);

    // Get slice to process
    const citiesToProcess = uniqueCities.slice(startIndex, startIndex + maxCities);
    console.log(`Processing cities ${startIndex + 1} to ${startIndex + citiesToProcess.length} of ${uniqueCities.length}`);

    const results: { city: string; cityId?: string; runId?: string; error?: string }[] = [];

    // Process cities: create city records and kick off Apify runs (don't wait for completion)
    for (const city of citiesToProcess) {
      // Get or create city in cities table
      let { data: cityRecord } = await supabase
        .from('cities')
        .select('id')
        .eq('name', city)
        .eq('state', state)
        .maybeSingle();

      if (!cityRecord) {
        const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const { data: newCity, error: cityError } = await supabase
          .from('cities')
          .insert({
            name: city,
            slug: citySlug,
            state: state,
            state_slug: state.toLowerCase().replace(/\s+/g, '-'),
            active: true
          })
          .select('id')
          .single();

        if (cityError) {
          console.error(`[${city}] Failed to create city:`, cityError);
          results.push({ city, error: `Failed to create city: ${cityError.message}` });
          continue;
        }
        cityRecord = newCity;
        console.log(`[${city}] Created new city record`);
      }

      const result = await startCityApifyRun(city, state, cityRecord.id, category.id, apifyToken);
      results.push({ ...result, cityId: cityRecord.id });
    }

    const successfulRuns = results.filter(r => r.runId);
    const failedRuns = results.filter(r => r.error);

    console.log(`\n=== BATCH KICKED OFF ===`);
    console.log(`Started ${successfulRuns.length} Apify runs`);
    console.log(`Failed to start: ${failedRuns.length}`);

    // Store run info for later polling
    if (successfulRuns.length > 0) {
      for (const run of successfulRuns) {
        await supabase.from('scrape_jobs').upsert({
          id: run.runId,
          city: run.city,
          state: state,
          apify_run_id: run.runId,
          status: 'running',
          started_at: new Date().toISOString()
        }, { onConflict: 'id' });
      }
      console.log(`Stored ${successfulRuns.length} run records in scrape_jobs`);
    }

    const summary = {
      state,
      stateAbbr,
      citiesProcessed: citiesToProcess.length,
      totalCities: uniqueCities.length,
      startIndex,
      nextIndex: startIndex + citiesToProcess.length < uniqueCities.length 
        ? startIndex + citiesToProcess.length 
        : null,
      runsStarted: successfulRuns.length,
      runsFailed: failedRuns.length,
      message: `Started ${successfulRuns.length} Apify runs. Use poll-apify-runs to check status and import results.`,
      runs: successfulRuns.map(r => ({ city: r.city, runId: r.runId })),
      errors: failedRuns
    };

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in run-state-pipeline:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
