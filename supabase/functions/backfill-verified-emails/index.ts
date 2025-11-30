import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Starting backfill of verified emails...');

    // Find all completed queue items with valid status
    const { data: queueItems, error: fetchError } = await supabaseClient
      .from('email_verification_queue')
      .select('*')
      .eq('status', 'completed')
      .not('verification_result', 'is', null);

    if (fetchError) throw fetchError;

    console.log(`Found ${queueItems?.length || 0} completed queue items to check`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const results = [];

    for (const item of queueItems || []) {
      try {
        // Check if professional already verified
        const { data: professional } = await supabaseClient
          .from('professionals')
          .select('email_verified_at')
          .eq('id', item.professional_id)
          .single();

        if (professional?.email_verified_at) {
          skipped++;
          continue;
        }

        // Parse verification result
        const result = item.verification_result;
        let status = 'unknown';
        let safeToSend = false;

        if (result?.status === 'success' && result?.data) {
          status = result.data.status || 'unknown';
          const safeToSendValue = result.data.safe_to_send;
          safeToSend = safeToSendValue === 'yes' || safeToSendValue === 'risky';
        } else if (result?.data) {
          status = result.data.status || 'unknown';
          const safeToSendValue = result.data.safe_to_send;
          safeToSend = safeToSendValue === 'yes' || safeToSendValue === 'risky';
        }

        // Update if valid
        if (status === 'valid' && safeToSend) {
          const { error: updateError } = await supabaseClient
            .from('professionals')
            .update({
              email_verified_at: new Date().toISOString()
            })
            .eq('id', item.professional_id);

          if (updateError) {
            console.error(`❌ Failed to update ${item.name}: ${updateError.message}`);
            errors++;
            results.push({
              name: item.name,
              email: item.email,
              status: 'error',
              message: updateError.message
            });
          } else {
            console.log(`✅ Backfilled: ${item.name} (${item.email})`);
            updated++;
            results.push({
              name: item.name,
              email: item.email,
              status: 'updated',
              verification_status: status,
              safe_to_send: safeToSend
            });
          }
        } else {
          skipped++;
        }
      } catch (error: any) {
        console.error(`Error processing ${item.name}:`, error);
        errors++;
        results.push({
          name: item.name,
          email: item.email,
          status: 'error',
          message: error.message
        });
      }
    }

    console.log(`✅ Backfill complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: queueItems?.length || 0,
        updated,
        skipped,
        errors
      },
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in backfill-verified-emails:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
