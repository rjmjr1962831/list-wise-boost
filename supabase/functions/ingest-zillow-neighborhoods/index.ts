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

const JOB_NAME = 'zillow-neighborhood-ingest';
const BATCH_SIZE = 50;
const CONCURRENCY = 5;

// GitHub raw URL for the data (public access)
const DATA_URL = "https://gist.githubusercontent.com/top10lists/zillow-neighborhoods/main/data.json";

async function processNeighborhood(
  supabase: any,
  item: ZillowNeighborhoodInput
): Promise<{ action: 'inserted' | 'updated' | 'error'; error?: string }> {
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
    if (existing.source === 'manual') updateData.source = 'zillow';

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

async function triggerNextBatch(supabaseUrl: string, anonKey: string) {
  try {
    // Fire and forget - don't await
    fetch(`${supabaseUrl}/functions/v1/ingest-zillow-neighborhoods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ action: 'continue' }),
    });
  } catch (e) {
    console.error('[ingest-zillow] Failed to trigger next batch:', e);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
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

    // Handle actions
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
        },
        countByState,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'start') {
      if (state?.is_running) {
        return new Response(JSON.stringify({ success: false, error: 'Already running' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get data from request body
      const allData: ZillowNeighborhoodInput[] = body.data;
      
      if (!allData || !Array.isArray(allData) || allData.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Please provide data array in request body: { "action": "start", "data": [...] }' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Initialize job state
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
        message: `Starting: ${allData.length} neighborhoods to process`,
      });

      // Process first batch immediately
      const batch = allData.slice(0, BATCH_SIZE);
      console.log(`[ingest-zillow] Processing batch 0-${batch.length} of ${allData.length}`);
      
      const result = await processBatch(supabase, batch);

      // Store remaining data for continuation
      const remaining = allData.slice(BATCH_SIZE);
      if (remaining.length > 0) {
        // Store in a temp table or update state with serialized data
        await supabase.from('cron_state').update({
          total_processed: batch.length,
          total_found: result.inserted,
          total_not_found: result.updated,
          total_errors: result.errors,
          remaining_count: remaining.length,
          message: `Processed ${batch.length}/${allData.length}`,
        }).eq('job_name', JOB_NAME);
      } else {
        // All done
        await supabase.from('cron_state').update({
          is_running: false,
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_processed: batch.length,
          total_found: result.inserted,
          total_not_found: result.updated,
          total_errors: result.errors,
          remaining_count: 0,
          message: `Completed: ${result.inserted} inserted, ${result.updated} updated`,
        }).eq('job_name', JOB_NAME);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Processed first batch of ${batch.length} neighborhoods`,
        stats: {
          processed: batch.length,
          inserted: result.inserted,
          updated: result.updated,
          errors: result.errors,
          remaining: remaining.length,
        },
        note: remaining.length > 0 ? 
          `Send remaining ${remaining.length} records with action: "continue" and data array to continue processing` :
          'All records processed!'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'continue') {
      // Continue processing with provided data
      const allData: ZillowNeighborhoodInput[] = body.data;
      
      if (!allData || !Array.isArray(allData) || allData.length === 0) {
        await supabase.from('cron_state').update({
          is_running: false,
          status: 'completed',
          completed_at: new Date().toISOString(),
          message: 'No more data to process',
        }).eq('job_name', JOB_NAME);
        
        return new Response(JSON.stringify({ success: true, message: 'Completed - no more data' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Process batch
      const batch = allData.slice(0, BATCH_SIZE);
      console.log(`[ingest-zillow] Processing batch of ${batch.length}, remaining: ${allData.length - batch.length}`);
      
      const result = await processBatch(supabase, batch);

      // Update state
      const currentProcessed = (state?.total_processed || 0) + batch.length;
      const remaining = allData.slice(BATCH_SIZE);
      
      await supabase.from('cron_state').update({
        total_processed: currentProcessed,
        total_found: (state?.total_found || 0) + result.inserted,
        total_not_found: (state?.total_not_found || 0) + result.updated,
        total_errors: (state?.total_errors || 0) + result.errors,
        remaining_count: remaining.length,
        last_run_at: new Date().toISOString(),
        message: `Processed ${currentProcessed} total`,
        is_running: remaining.length > 0,
        status: remaining.length > 0 ? 'running' : 'completed',
        completed_at: remaining.length === 0 ? new Date().toISOString() : null,
      }).eq('job_name', JOB_NAME);

      if (remaining.length === 0) {
        await supabase.from('pipeline_alerts').insert({
          pipeline: 'zillow-ingest',
          severity: 'info',
          title: 'Zillow Ingestion Complete',
          message: `Processed ${currentProcessed} neighborhoods`,
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        processed: batch.length,
        total: currentProcessed,
        remaining: remaining.length,
        stats: {
          inserted: result.inserted,
          updated: result.updated,
          errors: result.errors,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'stop') {
      await supabase.from('cron_state').update({
        is_running: false,
        status: 'stopped',
        message: 'Manually stopped',
      }).eq('job_name', JOB_NAME);

      return new Response(JSON.stringify({ success: true, message: 'Stopped' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Direct processing mode - process inline data immediately without state management
    if (body.data && Array.isArray(body.data)) {
      const data = body.data as ZillowNeighborhoodInput[];
      console.log(`[ingest-zillow] Direct processing ${data.length} neighborhoods`);
      
      const result = await processBatch(supabase, data);
      
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
        message: `Processed ${data.length} neighborhoods`,
        stats: {
          inputCount: data.length,
          inserted: result.inserted,
          updated: result.updated,
          errors: result.errors,
          countByState,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Unknown action. Use: status, start, continue, stop, or provide data array directly' 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[ingest-zillow] Error:', error);
    await supabase.from('cron_state').update({
      is_running: false,
      status: 'error',
      last_error: error.message,
    }).eq('job_name', JOB_NAME);

    return new Response(JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
};

serve(handler);
