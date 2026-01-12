import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[import-agent-zip-activity] Starting import...');

  try {
    const { records } = await req.json();
    
    if (!records || !Array.isArray(records)) {
      console.error('[import-agent-zip-activity] Invalid request: records array required');
      return new Response(
        JSON.stringify({ error: 'records array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-agent-zip-activity] Received ${records.length} records to import`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Import in batches of 100
    const batchSize = 100;
    let imported = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      // Transform records to match table schema
      const transformedBatch = batch.map((record: any) => ({
        license_number: record.license_number,
        state: record.state || 'AZ',
        zip_code: record.zip_code,
        transaction_count: record.transaction_count || 1,
        last_verified_at: record.last_verified_at || new Date().toISOString(),
      }));
      
      const { error } = await supabase
        .from('agent_zip_activity')
        .upsert(transformedBatch, {
          onConflict: 'license_number,state,zip_code'
        });

      if (error) {
        console.error(`[import-agent-zip-activity] Batch ${batchNum} error:`, error.message);
        errors += batch.length;
        errorDetails.push(`Batch ${batchNum}: ${error.message}`);
      } else {
        imported += batch.length;
        console.log(`[import-agent-zip-activity] Batch ${batchNum}: Imported ${batch.length} records`);
      }
    }

    console.log(`[import-agent-zip-activity] Complete. Imported: ${imported}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        errors,
        total: records.length,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[import-agent-zip-activity] Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
