import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NeighborhoodRecord {
  state?: string;
  city_area?: string;
  metro?: string; // California format uses metro
  neighborhood: string;
  zips?: string | string[];
  primary_zip?: string; // California format
  nearby_zips?: string[]; // California format
  lat?: number;
  lon?: number;
  median_income?: number;
  median_home_value?: number;
  tier?: string;
  income_pct?: number;
  value_pct?: number;
  score?: number;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseZips(zips: string | string[] | null | undefined): string[] {
  if (!zips) return [];
  if (Array.isArray(zips)) return zips.map(z => z.toString().trim()).filter(Boolean);
  return zips.split(',').map(z => z.trim()).filter(Boolean);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, data, state, clearExisting } = await req.json();

    console.log(`[setup-neighborhood-catalog] Action: ${action}, State: ${state || 'all'}`);

    if (action === 'ingest') {
      // Validate data
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid data format. Expected array of neighborhoods.');
      }

      console.log(`[setup-neighborhood-catalog] Processing ${data.length} neighborhoods...`);

      // Optionally clear existing data for the state
      if (clearExisting && state) {
        const { error: deleteError } = await supabase
          .from('neighborhood_catalog')
          .delete()
          .eq('state', state);
        
        if (deleteError) {
          console.error(`[setup-neighborhood-catalog] Error clearing existing data:`, deleteError);
        } else {
          console.log(`[setup-neighborhood-catalog] Cleared existing data for state: ${state}`);
        }
      }

      // Process records in batches
      const batchSize = 100;
      let inserted = 0;
      let errors = 0;
      const errorMessages: string[] = [];

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        const records = batch.map((item: NeighborhoodRecord) => {
          // Handle both Arizona format (city_area, zips) and California format (metro, primary_zip)
          const cityArea = item.city_area || item.metro || 'Unknown';
          const zipsArray = item.zips 
            ? parseZips(item.zips) 
            : item.primary_zip 
              ? [item.primary_zip, ...(item.nearby_zips || [])]
              : [];
          
          return {
            state: item.state || state || 'AZ',
            city_area: cityArea,
            city_area_slug: generateSlug(cityArea),
            neighborhood: item.neighborhood,
            neighborhood_slug: generateSlug(item.neighborhood),
            zips: zipsArray,
            lat: item.lat || null,
            lon: item.lon || null,
            median_income: item.median_income || null,
            median_home_value: item.median_home_value || null,
            tier: item.tier || 'Main',
            income_pct: item.income_pct || null,
            value_pct: item.value_pct || null,
            score: item.score || null,
            is_verified: true,
            is_active: true,
          };
        });

        const { error: insertError, data: insertedData } = await supabase
          .from('neighborhood_catalog')
          .upsert(records, { 
            onConflict: 'state,city_area_slug,neighborhood_slug',
            ignoreDuplicates: false 
          })
          .select('id');

        if (insertError) {
          console.error(`[setup-neighborhood-catalog] Batch ${i / batchSize + 1} error:`, insertError);
          errors += batch.length;
          errorMessages.push(`Batch ${i / batchSize + 1}: ${insertError.message}`);
        } else {
          inserted += insertedData?.length || batch.length;
        }

        // Log progress every 500 records
        if ((i + batchSize) % 500 === 0 || i + batchSize >= data.length) {
          console.log(`[setup-neighborhood-catalog] Progress: ${Math.min(i + batchSize, data.length)}/${data.length}`);
        }
      }

      console.log(`[setup-neighborhood-catalog] Complete. Inserted: ${inserted}, Errors: ${errors}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Ingested ${inserted} neighborhoods`,
          stats: {
            total: data.length,
            inserted,
            errors,
            errorMessages: errorMessages.slice(0, 5), // First 5 errors
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'stats') {
      // Get stats by state and tier
      const { data: stats, error: statsError } = await supabase
        .from('neighborhood_catalog')
        .select('state, tier')
        .eq('is_active', true);

      if (statsError) {
        throw statsError;
      }

      const statsByState: Record<string, Record<string, number>> = {};
      stats?.forEach((row: { state: string; tier: string }) => {
        if (!statsByState[row.state]) {
          statsByState[row.state] = { Main: 0, Prime: 0, Luxury: 0, total: 0 };
        }
        statsByState[row.state][row.tier] = (statsByState[row.state][row.tier] || 0) + 1;
        statsByState[row.state].total += 1;
      });

      return new Response(
        JSON.stringify({ success: true, stats: statsByState }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'clear') {
      if (!state) {
        throw new Error('State is required for clear action');
      }

      const { error: deleteError, count } = await supabase
        .from('neighborhood_catalog')
        .delete()
        .eq('state', state);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(
        JSON.stringify({ success: true, message: `Cleared ${count || 'all'} records for ${state}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error('[setup-neighborhood-catalog] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
