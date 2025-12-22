import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONCURRENCY = 5;
const BATCH_SIZE = 5; // Process 5 cities at a time

interface CityResult {
  city: string;
  imported: number;
  skipped: number;
  enriched: number;
  error?: string;
}

// Process a single city through Rigelbytes
async function processCity(
  city: string,
  state: string,
  categoryId: string,
  supabaseUrl: string,
  supabaseKey: string,
  apifyToken: string
): Promise<CityResult> {
  const result: CityResult = { city, imported: 0, skipped: 0, enriched: 0 };
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log(`[${city}] Starting Rigelbytes scrape...`);

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
        result.error = `Failed to create city: ${cityError.message}`;
        return result;
      }
      cityRecord = newCity;
      console.log(`[${city}] Created new city record`);
    }

    const cityId = cityRecord.id;

    // Start Rigelbytes actor
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
      result.error = `Failed to start Rigelbytes: ${runResponse.status}`;
      return result;
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`[${city}] Rigelbytes started with run ID: ${runId}`);

    // Poll for completion (max 20 minutes)
    let runStatus = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 240; // 20 minutes

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      attempts++;
      
      if (attempts % 12 === 0) {
        console.log(`[${city}] Still running... (${Math.round(attempts * 5 / 60)} min)`);
      }
    }

    if (runStatus !== 'SUCCEEDED') {
      console.error(`[${city}] Rigelbytes ended with status: ${runStatus}`);
      result.error = `Rigelbytes status: ${runStatus}`;
      return result;
    }

    // Get dataset
    const datasetId = runData.data.defaultDatasetId;
    const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`);
    const agents = await datasetResponse.json();
    console.log(`[${city}] Rigelbytes returned ${agents.length} agents`);

    // Get next available rank
    const { data: maxRankData } = await supabase
      .from('professionals')
      .select('rank')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .order('rank', { ascending: false })
      .limit(1);

    let nextRank = maxRankData && maxRankData.length > 0 ? maxRankData[0].rank + 1 : 1;

    const qualifiedAgentIds: string[] = [];

    for (const agent of agents) {
      const rating = agent.review_average || 0;
      const reviewCount = typeof agent.review_count === 'string'
        ? parseInt(agent.review_count.replace(/[()]/g, ''), 10) || 0
        : agent.review_count || 0;

      // Filter: 4.5+ rating, 50+ reviews
      if (rating < 4.5 || reviewCount < 50) {
        result.skipped++;
        continue;
      }

      const profileUrl = agent.link;
      const { data: existing } = await supabase
        .from('professionals')
        .select('id')
        .eq('zillow_profile_url', profileUrl)
        .maybeSingle();

      const zuidMatch = profileUrl?.match(/profile\/([^\/]+)/);
      const zuid = zuidMatch ? zuidMatch[1] : null;

      const profileDataObj: any = {};
      if (Array.isArray(agent.profile_data)) {
        agent.profile_data.forEach((item: any) => Object.assign(profileDataObj, item));
      }

      const teamSalesTotal = profileDataObj['team sales in Phoenix'] || profileDataObj['team sales in Scottsdale'] || profileDataObj['team sales'];

      const professionalData: any = {
        name: agent.title,
        company: agent.secondary_title,
        zillow_profile_url: profileUrl,
        zuid: zuid,
        total_sales: teamSalesTotal ? parseInt(String(teamSalesTotal).replace(/,/g, ''), 10) : 0,
        review_stars_rating: rating,
        num_total_reviews: reviewCount,
        is_top_agent: agent.top_agent || false,
        professional_information: [agent],
        ratings: { average: rating, count: reviewCount },
        image_url: agent.image_url,
        zillow_data_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from('professionals').update(professionalData).eq('id', existing.id);
        qualifiedAgentIds.push(existing.id);
        result.imported++;
      } else {
        professionalData.city_id = cityId;
        professionalData.category_id = categoryId;
        professionalData.rank = nextRank++;
        professionalData.type = 'individual';
        professionalData.active = true;

        const { data: inserted, error: insertError } = await supabase
          .from('professionals')
          .insert(professionalData)
          .select('id')
          .single();

        if (!insertError && inserted) {
          qualifiedAgentIds.push(inserted.id);
          result.imported++;
        } else {
          result.skipped++;
        }
      }
    }

    console.log(`[${city}] Imported ${result.imported} qualified agents, skipped ${result.skipped}`);

    // Queue qualified agents for enrichment
    if (qualifiedAgentIds.length > 0) {
      const queueItems = qualifiedAgentIds.map(id => ({
        professional_id: id,
        reason: `Auto-queued from ${city}, ${state} pipeline`,
        status: 'pending',
        stage: 'queued'
      }));

      // Insert with conflict handling (skip if already queued)
      for (const item of queueItems) {
        await supabase
          .from('contact_enrichment_queue')
          .upsert(item, { onConflict: 'professional_id' });
      }

      result.enriched = qualifiedAgentIds.length;
      console.log(`[${city}] Queued ${result.enriched} agents for enrichment`);
    }

    return result;
  } catch (error) {
    console.error(`[${city}] Error:`, error);
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { state = 'California', stateAbbr = 'CA', startIndex = 0, maxCities = 100 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Get category ID for realtors
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'realtors')
      .single();

    if (!category) {
      throw new Error('Realtors category not found');
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

    const results: CityResult[] = [];

    // Process in batches of CONCURRENCY
    for (let i = 0; i < citiesToProcess.length; i += CONCURRENCY) {
      const batch = citiesToProcess.slice(i, i + CONCURRENCY);
      console.log(`\n=== Processing batch ${Math.floor(i / CONCURRENCY) + 1}: ${batch.join(', ')} ===`);

      const batchResults = await Promise.allSettled(
        batch.map(city => processCity(city, state, category.id, supabaseUrl, supabaseKey, apifyToken))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ city: 'unknown', imported: 0, skipped: 0, enriched: 0, error: result.reason });
        }
      }
    }

    // Trigger enrichment processor with 5 concurrency
    const totalQueued = results.reduce((sum, r) => sum + r.enriched, 0);
    if (totalQueued > 0) {
      console.log(`\nTriggering enrichment for ${totalQueued} agents with concurrency ${CONCURRENCY}...`);
      
      await supabase.functions.invoke('process-contact-enrichment-queue', {
        body: {
          batchSize: 50,
          concurrency: CONCURRENCY,
          dryRun: false,
          skipRecentlyEnriched: true,
          skipGenericBios: false,
          skipIfNoPress: false
        }
      });
    }

    // If more cities remain, trigger next batch (fire-and-forget)
    const nextIndex = startIndex + citiesToProcess.length;
    if (nextIndex < uniqueCities.length) {
      console.log(`\n🔄 ${uniqueCities.length - nextIndex} cities remaining, triggering next batch...`);
      
      fetch(`${supabaseUrl}/functions/v1/run-state-pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          state,
          stateAbbr,
          startIndex: nextIndex,
          maxCities
        })
      }).catch(() => {}); // Fire and forget
    }

    const summary = {
      state,
      citiesProcessed: citiesToProcess.length,
      totalCities: uniqueCities.length,
      startIndex,
      nextIndex: nextIndex < uniqueCities.length ? nextIndex : null,
      totalImported: results.reduce((sum, r) => sum + r.imported, 0),
      totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
      totalQueued: totalQueued,
      errors: results.filter(r => r.error).length,
      results
    };

    console.log(`\n=== BATCH COMPLETE ===`);
    console.log(`Cities: ${summary.citiesProcessed}/${summary.totalCities}`);
    console.log(`Imported: ${summary.totalImported}, Skipped: ${summary.totalSkipped}, Queued: ${summary.totalQueued}`);
    console.log(`Errors: ${summary.errors}`);

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
