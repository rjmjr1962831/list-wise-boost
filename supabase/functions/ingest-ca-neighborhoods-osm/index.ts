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

// Hardcoded OSM California neighborhoods data
const CA_NEIGHBORHOODS: NeighborhoodInput[] = [
  {"name":"Bay Farm Island","city":"Alameda","state":"CA","lat":37.738564,"lon":-122.243993,"slug":"bay-farm-island","city_slug":"alameda"},
  {"name":"Centre Court","city":"Alameda","state":"CA","lat":37.746167,"lon":-122.238352,"slug":"centre-court","city_slug":"alameda"},
  {"name":"East End","city":"Alameda","state":"CA","lat":37.756956,"lon":-122.234154,"slug":"east-end","city_slug":"alameda"},
  {"name":"Fernside","city":"Alameda","state":"CA","lat":37.765206,"lon":-122.228857,"slug":"fernside","city_slug":"alameda"},
  {"name":"Gold Coast","city":"Alameda","state":"CA","lat":37.76665,"lon":-122.264238,"slug":"gold-coast","city_slug":"alameda"},
  {"name":"South Shore","city":"Alameda","state":"CA","lat":37.759651,"lon":-122.257747,"slug":"south-shore","city_slug":"alameda"},
  {"name":"West End","city":"Alameda","state":"CA","lat":37.772429,"lon":-122.281081,"slug":"west-end","city_slug":"alameda"},
  {"name":"Woodstock","city":"Alameda","state":"CA","lat":37.776318,"lon":-122.285803,"slug":"woodstock","city_slug":"alameda"},
];

async function processNeighborhoods(
  supabase: any,
  neighborhoods: NeighborhoodInput[]
): Promise<{ inserted: number; errors: number; errorMessages: string[]; deduped: number }> {
  const seen = new Map<string, NeighborhoodInput>();
  for (const n of neighborhoods) {
    const key = `${n.city_slug}|${n.slug}`;
    const existing = seen.get(key);
    if (!existing || (n.lat && n.lon && (!existing.lat || !existing.lon))) {
      seen.set(key, n);
    }
  }

  const uniqueNeighborhoods = Array.from(seen.values());
  console.log(`[ingest-ca] After deduplication: ${uniqueNeighborhoods.length} unique`);

  const batchSize = 100;
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
      console.error(`[ingest-ca] Batch error:`, upsertError);
      errors += batch.length;
      errorMessages.push(upsertError.message);
    } else {
      inserted += upsertedData?.length || batch.length;
    }

    if ((i + batchSize) % 500 === 0 || i + batchSize >= uniqueNeighborhoods.length) {
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
    
    let neighborhoods: NeighborhoodInput[];
    
    if (body.useBuiltIn) {
      // Use the hardcoded data (for testing)
      neighborhoods = CA_NEIGHBORHOODS;
    } else if (body.data) {
      neighborhoods = body.data;
    } else {
      throw new Error('Invalid request. Expected { data: [...] } or { useBuiltIn: true }');
    }

    console.log(`[ingest-ca] Processing ${neighborhoods.length} neighborhoods...`);

    const result = await processNeighborhoods(supabase, neighborhoods);

    const { count } = await supabase
      .from('neighborhood_catalog')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'California');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Ingested ${result.inserted} California neighborhoods`,
        stats: {
          inputCount: neighborhoods.length,
          afterDedup: result.deduped,
          processed: result.inserted,
          errors: result.errors,
          totalCaliforniaNeighborhoods: count,
          errorMessages: result.errorMessages.slice(0, 5),
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
