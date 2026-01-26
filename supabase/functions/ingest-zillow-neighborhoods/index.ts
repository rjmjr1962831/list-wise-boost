import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZillowNeighborhoodInput {
  state: string;
  city_area: string;
  city_area_slug: string;
  neighborhood: string;
  neighborhood_slug: string;
  lat?: number;
  lon?: number;
  county?: string;
  zillow_region_id?: string;
  is_active?: boolean;
}

const JOB_NAME = 'zillow-neighborhood-ingestion';
const BATCH_SIZE = 50;
const CONCURRENCY = 5;

// Public raw URL for the JSON data - deployed with the project
const DATA_URL = "https://list-wise-boost.lovable.app/zillowTargetStates.json";

async function processNeighborhood(
  supabase: any,
  item: ZillowNeighborhoodInput
): Promise<{ action: 'inserted' | 'updated' | 'error'; error?: string }> {
  try {
    const { data: existing } = await supabase
      .from('neighborhood_catalog')
      .select('id, lat, lon, tier, primary_zip, zips, source')
      .eq('state', item.state)
      .eq('city_area_slug', item.city_area_slug)
      .eq('neighborhood_slug', item.neighborhood_slug)
      .single();

    if (existing) {
      const updateData: any = {
        county: item.county || existing.county,
        zillow_region_id: item.zillow_region_id || existing.zillow_region_id,
        updated_at: new Date().toISOString(),
      };
      if (!existing.lat && item.lat) updateData.lat = item.lat;
      if (!existing.lon && item.lon) updateData.lon = item.lon;
      // Only update source if it was 'manual' or NULL
      if (!existing.source || existing.source === 'manual') updateData.source = 'zillow';

      const { error } = await supabase.from('neighborhood_catalog').update(updateData).eq('id', existing.id);
      return error ? { action: 'error', error: error.message } : { action: 'updated' };
    } else {
      const { error } = await supabase.from('neighborhood_catalog').insert({
        state: item.state,
        city_area: item.city_area,
        city_area_slug: item.city_area_slug,
        neighborhood: item.neighborhood,
        neighborhood_slug: item.neighborhood_slug,
        lat: item.lat || null,
        lon: item.lon || null,
        county: item.county || null,
        zillow_region_id: item.zillow_region_id || null,
        source: 'zillow',
        tier: 'Main',
        is_verified: true,
        is_active: item.is_active !== false,
        zips: [],
        updated_at: new Date().toISOString(),
      });
      return error ? { action: 'error', error: error.message } : { action: 'inserted' };
    }
  } catch (e: any) {
    return { action: 'error', error: e.message };
  }
}

async function processBatch(supabase: any, items: ZillowNeighborhoodInput[]): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0, updated = 0, errors = 0;
  
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(item => processNeighborhood(supabase, item)));
    for (const r of results) {
      if (r.action === 'inserted') inserted++;
      else if (r.action === 'updated') updated++;
      else errors++;
    }
  }
  return { inserted, updated, errors };
}

// Cache the data in memory for the function instance
let cachedData: ZillowNeighborhoodInput[] | null = null;

async function fetchData(): Promise<ZillowNeighborhoodInput[]> {
  if (cachedData) return cachedData;
  
  console.log('[ingest-zillow] Fetching data from:', DATA_URL);
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  cachedData = await response.json();
  console.log(`[ingest-zillow] Loaded ${cachedData!.length} records`);
  return cachedData!;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';

    // Get or create job state
    let { data: state } = await supabase
      .from('cron_state')
      .select('*')
      .eq('job_name', JOB_NAME)
      .single();

    if (!state) {
      const { data: newState } = await supabase.from('cron_state').insert({
        job_name: JOB_NAME,
        is_running: false,
        total_processed: 0,
        total_found: 0,
        total_not_found: 0,
        total_errors: 0,
        status: 'idle',
      }).select().single();
      state = newState;
    }

    // STATUS - check current progress
    if (action === 'status') {
      const { data: counts } = await supabase
        .from('neighborhood_catalog')
        .select('state')
        .in('state', ['Arizona', 'California', 'Colorado', 'Florida', 'New York', 'Texas']);
      
      const countByState: Record<string, number> = {};
      for (const row of counts || []) {
        countByState[row.state] = (countByState[row.state] || 0) + 1;
      }

      return new Response(JSON.stringify({
        success: true,
        state: {
          status: state?.status || 'idle',
          is_running: state?.is_running || false,
          total_processed: state?.total_processed || 0,
          inserted: state?.total_found || 0,
          updated: state?.total_not_found || 0,
          errors: state?.total_errors || 0,
          remaining: state?.remaining_count || 0,
          message: state?.message,
          last_run_at: state?.last_run_at,
        },
        countByState,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // START - initialize and begin processing
    if (action === 'start') {
      if (state?.is_running && state?.status === 'running') {
        return new Response(JSON.stringify({ success: false, error: 'Already running' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Fetch data
      const allData = await fetchData();

      // Initialize job state at index 0
      await supabase.from('cron_state').upsert({
        job_name: JOB_NAME,
        is_running: true,
        status: 'running',
        started_at: new Date().toISOString(),
        total_processed: 0,
        total_found: 0,
        total_not_found: 0,
        total_errors: 0,
        remaining_count: allData.length,
        message: `Started: ${allData.length} neighborhoods to process`,
      }, { onConflict: 'job_name' });

      // Process first batch
      const batch = allData.slice(0, BATCH_SIZE);
      console.log(`[ingest-zillow] START: Processing batch 0-${batch.length} of ${allData.length}`);
      
      const result = await processBatch(supabase, batch);

      // Update state with progress
      await supabase.from('cron_state').update({
        total_processed: batch.length,
        total_found: result.inserted,
        total_not_found: result.updated,
        total_errors: result.errors,
        remaining_count: allData.length - batch.length,
        last_run_at: new Date().toISOString(),
        message: `Processed ${batch.length}/${allData.length}`,
      }).eq('job_name', JOB_NAME);

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Started! Processed first ${batch.length} of ${allData.length} neighborhoods`,
        stats: {
          processed: batch.length,
          inserted: result.inserted,
          updated: result.updated,
          errors: result.errors,
          remaining: allData.length - batch.length,
        },
        note: 'Cron job will continue processing every minute'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // CONTINUE - called by cron job every minute
    if (action === 'continue') {
      // Check if we should be running
      if (!state?.is_running || state?.status !== 'running') {
        console.log('[ingest-zillow] CONTINUE: Not running, skipping');
        return new Response(JSON.stringify({ success: true, message: 'Not running' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if already complete
      if ((state?.remaining_count || 0) <= 0) {
        await supabase.from('cron_state').update({
          is_running: false,
          status: 'completed',
          completed_at: new Date().toISOString(),
          message: 'Completed',
        }).eq('job_name', JOB_NAME);
        
        return new Response(JSON.stringify({ success: true, message: 'Already completed' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Fetch data and calculate current position
      const allData = await fetchData();
      const currentIndex = state?.total_processed || 0;
      
      if (currentIndex >= allData.length) {
        await supabase.from('cron_state').update({
          is_running: false,
          status: 'completed',
          completed_at: new Date().toISOString(),
          remaining_count: 0,
          message: `Completed: ${currentIndex} processed`,
        }).eq('job_name', JOB_NAME);
        
        return new Response(JSON.stringify({ success: true, message: 'Completed' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Process next batch
      const batch = allData.slice(currentIndex, currentIndex + BATCH_SIZE);
      console.log(`[ingest-zillow] CONTINUE: Processing ${currentIndex}-${currentIndex + batch.length} of ${allData.length}`);
      
      const result = await processBatch(supabase, batch);

      const newTotal = currentIndex + batch.length;
      const remaining = allData.length - newTotal;
      const isComplete = remaining <= 0;

      // Update state
      await supabase.from('cron_state').update({
        total_processed: newTotal,
        total_found: (state?.total_found || 0) + result.inserted,
        total_not_found: (state?.total_not_found || 0) + result.updated,
        total_errors: (state?.total_errors || 0) + result.errors,
        remaining_count: remaining,
        last_run_at: new Date().toISOString(),
        is_running: !isComplete,
        status: isComplete ? 'completed' : 'running',
        completed_at: isComplete ? new Date().toISOString() : null,
        message: isComplete 
          ? `Completed: ${newTotal} processed` 
          : `Processed ${newTotal}/${allData.length}`,
      }).eq('job_name', JOB_NAME);

      if (isComplete) {
        await supabase.from('pipeline_alerts').insert({
          pipeline: 'zillow-ingest',
          severity: 'info',
          title: 'Zillow Ingestion Complete',
          message: `Processed ${newTotal} neighborhoods: ${(state?.total_found || 0) + result.inserted} inserted, ${(state?.total_not_found || 0) + result.updated} updated`,
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        processed: batch.length,
        total: newTotal,
        remaining,
        stats: {
          inserted: result.inserted,
          updated: result.updated,
          errors: result.errors,
        },
        complete: isComplete,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // STOP - halt processing
    if (action === 'stop') {
      await supabase.from('cron_state').update({
        is_running: false,
        status: 'stopped',
        message: 'Manually stopped',
      }).eq('job_name', JOB_NAME);

      return new Response(JSON.stringify({ success: true, message: 'Stopped' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // RESET - clear state and start fresh
    if (action === 'reset') {
      await supabase.from('cron_state').update({
        is_running: false,
        status: 'idle',
        total_processed: 0,
        total_found: 0,
        total_not_found: 0,
        total_errors: 0,
        remaining_count: 0,
        started_at: null,
        completed_at: null,
        message: 'Reset',
      }).eq('job_name', JOB_NAME);

      return new Response(JSON.stringify({ success: true, message: 'Reset complete' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Unknown action. Use: status, start, continue, stop, reset' 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[ingest-zillow] Error:', error);
    await supabase.from('cron_state').update({
      last_error: error.message,
      message: `Error: ${error.message}`,
    }).eq('job_name', JOB_NAME);

    return new Response(JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
};

serve(handler);
