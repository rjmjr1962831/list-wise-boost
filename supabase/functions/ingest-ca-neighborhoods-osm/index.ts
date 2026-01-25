import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NeighborhoodInput {
  name: string;
  slug: string;
  city: string;
  city_slug: string;
  state: string;
  lat?: number;
  lon?: number;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function processNeighborhoods(
  supabase: any,
  neighborhoods: NeighborhoodInput[],
  batchSize: number = 25
): Promise<{ inserted: number; errors: number; errorMessages: string[]; deduped: number }> {
  // Internal deduplication - prefer records with lat/lon
  const seen = new Map<string, NeighborhoodInput>();
  for (const n of neighborhoods) {
    const key = `${n.city_slug}|${n.slug}`;
    const existing = seen.get(key);
    if (!existing || (n.lat && n.lon && (!existing.lat || !existing.lon))) {
      seen.set(key, n);
    }
  }

  const uniqueNeighborhoods = Array.from(seen.values());
  console.log(`[ingest-ca] After deduplication: ${uniqueNeighborhoods.length} unique neighborhoods`);

  let inserted = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (let i = 0; i < uniqueNeighborhoods.length; i += batchSize) {
    const batch = uniqueNeighborhoods.slice(i, i + batchSize);
    
    const records = batch.map((item) => ({
      state: 'California',
      city_area: item.city,
      city_area_slug: item.city_slug || generateSlug(item.city),
      neighborhood: item.name,
      neighborhood_slug: item.slug || generateSlug(item.name),
      lat: item.lat || null,
      lon: item.lon || null,
      tier: 'Main',
      is_verified: true,
      is_active: true,
      zips: [],
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError, data: upsertedData } = await supabase
      .from('neighborhood_catalog')
      .upsert(records, { 
        onConflict: 'state,city_area_slug,neighborhood_slug',
        ignoreDuplicates: false 
      })
      .select('id');

    if (upsertError) {
      console.error(`[ingest-ca] Batch ${Math.floor(i/batchSize) + 1} error:`, upsertError);
      errors += batch.length;
      errorMessages.push(`Batch ${Math.floor(i/batchSize) + 1}: ${upsertError.message}`);
    } else {
      inserted += upsertedData?.length || batch.length;
    }

    // Progress logging every 10 batches
    if ((i + batchSize) % (batchSize * 10) === 0 || i + batchSize >= uniqueNeighborhoods.length) {
      console.log(`[ingest-ca] Progress: ${Math.min(i + batchSize, uniqueNeighborhoods.length)}/${uniqueNeighborhoods.length}`);
    }
  }

  return { inserted, errors, errorMessages, deduped: uniqueNeighborhoods.length };
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
    const neighborhoods: NeighborhoodInput[] = body.data;
    const batchSize = body.batchSize || 25;
    const startIndex = body.startIndex || 0;
    const endIndex = body.endIndex || neighborhoods.length;

    if (!neighborhoods || !Array.isArray(neighborhoods)) {
      throw new Error('Invalid request. Expected { data: [...], batchSize?: number, startIndex?: number, endIndex?: number }');
    }

    // Slice to requested range
    const subset = neighborhoods.slice(startIndex, endIndex);
    console.log(`[ingest-ca] Processing ${subset.length} neighborhoods (index ${startIndex}-${endIndex}) in batches of ${batchSize}...`);

    const result = await processNeighborhoods(supabase, subset, batchSize);

    const { count } = await supabase
      .from('neighborhood_catalog')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'California');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Ingested ${result.inserted} California neighborhoods`,
        stats: {
          inputCount: subset.length,
          afterDedup: result.deduped,
          processed: result.inserted,
          errors: result.errors,
          totalCaliforniaNeighborhoods: count,
          startIndex,
          endIndex,
          errorMessages: result.errorMessages.slice(0, 10),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[ingest-ca] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
