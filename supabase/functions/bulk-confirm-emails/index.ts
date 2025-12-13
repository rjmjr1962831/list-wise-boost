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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Starting bulk email confirmation...');

    // Find all active professionals with emails but no email_verified_at
    const { data: professionals, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, email')
      .eq('active', true)
      .not('email', 'is', null)
      .is('email_verified_at', null);

    if (fetchError) {
      throw new Error(`Failed to fetch professionals: ${fetchError.message}`);
    }

    console.log(`Found ${professionals?.length || 0} professionals with unconfirmed emails`);

    if (!professionals || professionals.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No unconfirmed emails found',
          confirmed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();
    let confirmed = 0;
    const errors: string[] = [];

    // Batch update all emails as confirmed
    for (const professional of professionals) {
      const { error: updateError } = await supabase
        .from('professionals')
        .update({ 
          email_verified_at: now,
          updated_at: now 
        })
        .eq('id', professional.id);

      if (updateError) {
        errors.push(`${professional.name}: ${updateError.message}`);
        console.error(`Failed to confirm email for ${professional.name}:`, updateError);
      } else {
        confirmed++;
        console.log(`✓ Confirmed email for ${professional.name} (${professional.email})`);
      }
    }

    console.log(`Bulk confirmation complete: ${confirmed}/${professionals.length} emails confirmed`);

    // Trigger Pipedrive sync for all confirmed professionals
    console.log('Queueing Pipedrive sync for confirmed professionals...');
    
    const professionalIds = professionals.filter((_, idx) => idx < confirmed).map(p => p.id);
    
    const { error: queueError } = await supabase
      .from('pipedrive_sync_queue')
      .upsert(
        professionalIds.map(id => ({
          professional_id: id,
          status: 'pending',
          attempts: 0,
          next_retry_at: now,
        })),
        { onConflict: 'professional_id' }
      );

    if (queueError) {
      console.error('Failed to queue Pipedrive sync:', queueError);
    } else {
      console.log(`✓ Queued ${professionalIds.length} professionals for Pipedrive sync`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: professionals.length,
        confirmed,
        errors: errors.length > 0 ? errors : undefined,
        pipedriveQueued: professionalIds.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in bulk-confirm-emails:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
