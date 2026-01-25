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

async function processNeighborhoods(
  supabase: any,
  neighborhoods: ZillowNeighborhoodInput[],
  batchSize: number = 25
): Promise<{ inserted: number; updated: number; errors: number; errorMessages: string[] }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (let i = 0; i < neighborhoods.length; i += batchSize) {
    const batch = neighborhoods.slice(i, i + batchSize);
    
    for (const item of batch) {
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
          errors++;
          errorMessages.push(`Update ${item.state}/${item.city_area_slug}/${item.neighborhood_slug}: ${updateError.message}`);
        } else {
          updated++;
        }
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
          errors++;
          errorMessages.push(`Insert ${item.state}/${item.city_area_slug}/${item.neighborhood_slug}: ${insertError.message}`);
        } else {
          inserted++;
        }
      }
    }

    // Progress logging every 10 batches
    if ((i + batchSize) % (batchSize * 10) === 0 || i + batchSize >= neighborhoods.length) {
      console.log(`[ingest-zillow] Progress: ${Math.min(i + batchSize, neighborhoods.length)}/${neighborhoods.length} (inserted: ${inserted}, updated: ${updated}, errors: ${errors})`);
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
    const neighborhoods: ZillowNeighborhoodInput[] = body.data;
    const batchSize = body.batchSize || 25;
    const startIndex = body.startIndex || 0;
    const endIndex = body.endIndex || neighborhoods.length;

    if (!neighborhoods || !Array.isArray(neighborhoods)) {
      throw new Error('Invalid request. Expected { data: [...], batchSize?: number, startIndex?: number, endIndex?: number }');
    }

    // Slice to requested range
    const subset = neighborhoods.slice(startIndex, endIndex);
    console.log(`[ingest-zillow] Processing ${subset.length} neighborhoods (index ${startIndex}-${endIndex}) in batches of ${batchSize}...`);

    // Log state distribution
    const stateDistribution: Record<string, number> = {};
    for (const n of subset) {
      stateDistribution[n.state] = (stateDistribution[n.state] || 0) + 1;
    }
    console.log('[ingest-zillow] State distribution:', stateDistribution);

    const result = await processNeighborhoods(supabase, subset, batchSize);

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
        message: `Processed ${subset.length} Zillow neighborhoods`,
        stats: {
          inputCount: subset.length,
          inserted: result.inserted,
          updated: result.updated,
          errors: result.errors,
          startIndex,
          endIndex,
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
