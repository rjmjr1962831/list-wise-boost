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

async function processNeighborhood(
  supabase: any,
  item: ZillowNeighborhoodInput
): Promise<{ action: 'inserted' | 'updated' | 'error'; error?: string }> {
  // Check if record exists
  const { data: existing } = await supabase
    .from('neighborhood_catalog')
    .select('id, lat, lon, tier, primary_zip, zips, source')
    .eq('state', item.state)
    .eq('city_area_slug', item.city_area_slug)
    .eq('neighborhood_slug', item.neighborhood_slug)
    .single();

  if (existing) {
    // Update existing record, preserving existing data with COALESCE logic
    const updateData: any = {
      county: item.county || existing.county,
      zillow_region_id: item.zillow_region_id || existing.zillow_region_id,
      updated_at: new Date().toISOString(),
    };
    
    // Only update lat/lon if existing is NULL
    if (!existing.lat && item.lat) updateData.lat = item.lat;
    if (!existing.lon && item.lon) updateData.lon = item.lon;
    
    // Only change source from 'manual' to 'zillow'
    if (existing.source === 'manual') {
      updateData.source = 'zillow';
    }

    const { error: updateError } = await supabase
      .from('neighborhood_catalog')
      .update(updateData)
      .eq('id', existing.id);

    if (updateError) {
      return { action: 'error', error: updateError.message };
    }
    return { action: 'updated' };
  } else {
    // Insert new record
    const insertData = {
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
    };

    const { error: insertError } = await supabase
      .from('neighborhood_catalog')
      .insert(insertData);

    if (insertError) {
      return { action: 'error', error: insertError.message };
    }
    return { action: 'inserted' };
  }
}

async function processNeighborhoodsConcurrent(
  supabase: any,
  neighborhoods: ZillowNeighborhoodInput[],
  concurrency: number = 5
): Promise<{ inserted: number; updated: number; errors: number; errorMessages: string[] }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  // Process in batches with concurrency
  for (let i = 0; i < neighborhoods.length; i += concurrency) {
    const batch = neighborhoods.slice(i, i + concurrency);
    
    const results = await Promise.all(
      batch.map(item => processNeighborhood(supabase, item)
        .then(result => ({ item, result }))
        .catch(err => ({ item, result: { action: 'error' as const, error: err.message } }))
      )
    );

    for (const { item, result } of results) {
      if (result.action === 'inserted') inserted++;
      else if (result.action === 'updated') updated++;
      else {
        errors++;
        if (errorMessages.length < 20) {
          errorMessages.push(`${item.state}/${item.city_area_slug}/${item.neighborhood_slug}: ${result.error}`);
        }
      }
    }

    // Progress logging every 100 records
    if ((i + concurrency) % 100 === 0 || i + concurrency >= neighborhoods.length) {
      console.log(`[ingest-zillow] Progress: ${Math.min(i + concurrency, neighborhoods.length)}/${neighborhoods.length} (inserted: ${inserted}, updated: ${updated}, errors: ${errors})`);
    }
  }

  return { inserted, updated, errors, errorMessages };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    
    let neighborhoods: ZillowNeighborhoodInput[];
    
    // Support fetching from URL or inline data
    if (body.dataUrl) {
      console.log(`[ingest-zillow] Fetching data from URL: ${body.dataUrl}`);
      const response = await fetch(body.dataUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }
      neighborhoods = await response.json();
    } else if (body.data && Array.isArray(body.data)) {
      neighborhoods = body.data;
    } else {
      throw new Error('Invalid request. Expected { data: [...] } or { dataUrl: "..." }');
    }

    // Filter by state if specified
    const filterState = body.state;
    if (filterState) {
      neighborhoods = neighborhoods.filter(n => n.state === filterState);
      console.log(`[ingest-zillow] Filtered to ${neighborhoods.length} records for state: ${filterState}`);
    }

    // Apply index range if specified
    const startIndex = body.startIndex || 0;
    const endIndex = body.endIndex || neighborhoods.length;
    neighborhoods = neighborhoods.slice(startIndex, endIndex);
    
    const concurrency = body.concurrency || 5;
    
    console.log(`[ingest-zillow] Processing ${neighborhoods.length} neighborhoods (index ${startIndex}-${endIndex}) with concurrency ${concurrency}...`);

    // Log state distribution
    const stateDistribution: Record<string, number> = {};
    for (const n of neighborhoods) {
      stateDistribution[n.state] = (stateDistribution[n.state] || 0) + 1;
    }
    console.log('[ingest-zillow] State distribution:', stateDistribution);

    const result = await processNeighborhoodsConcurrent(supabase, neighborhoods, concurrency);

    // Get current counts by state
    const { data: stateCounts } = await supabase
      .from('neighborhood_catalog')
      .select('state')
      .in('state', ['Arizona', 'California', 'Colorado', 'Florida', 'New York', 'Texas']);

    const countByState: Record<string, number> = {};
    for (const row of stateCounts || []) {
      countByState[row.state] = (countByState[row.state] || 0) + 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${neighborhoods.length} Zillow neighborhoods`,
        stats: {
          inputCount: neighborhoods.length,
          inserted: result.inserted,
          updated: result.updated,
          errors: result.errors,
          startIndex,
          endIndex: startIndex + neighborhoods.length,
          filterState: filterState || 'all',
          countByState,
          errorMessages: result.errorMessages.slice(0, 10),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[ingest-zillow] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
