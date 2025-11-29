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

    const clearoutApiKey = Deno.env.get('CLEAROUT_API_KEY');
    if (!clearoutApiKey) {
      throw new Error('CLEAROUT_API_KEY not configured');
    }

    // Get next pending item from queue
    const { data: queueItem, error: fetchError } = await supabaseClient
      .from('email_verification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return new Response(JSON.stringify({ 
          message: 'Queue is empty',
          queueEmpty: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw fetchError;
    }

    console.log(`Processing verification for: ${queueItem.name} (${queueItem.email})`);

    // Mark as processing
    await supabaseClient
      .from('email_verification_queue')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString() 
      })
      .eq('id', queueItem.id);

    // Apply delay if configured
    if (queueItem.delay_seconds > 0) {
      console.log(`Applying ${queueItem.delay_seconds}s delay before verification`);
      await new Promise(resolve => setTimeout(resolve, queueItem.delay_seconds * 1000));
    }

    try {
      // Call Clearout API
      const clearoutResponse = await fetch('https://api.clearout.io/v2/email_verify/instant', {
        method: 'POST',
        headers: {
          'Authorization': clearoutApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: queueItem.email,
          timeout: 10,
        }),
      });

      const clearoutData = await clearoutResponse.json();
      console.log(`Clearout response for ${queueItem.email}:`, clearoutData);

      // Check if we hit rate limit
      if (clearoutData.status === 'failed' && clearoutData.error?.code === 1030) {
        // Rate limit - mark as pending to retry later
        await supabaseClient
          .from('email_verification_queue')
          .update({
            status: 'pending',
            error_message: 'Rate limit reached - will retry',
            attempts: queueItem.attempts + 1,
            started_at: null
          })
          .eq('id', queueItem.id);

        return new Response(JSON.stringify({
          message: 'Rate limit reached',
          rateLimited: true,
          retryAfter: clearoutData.error?.message
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let status = 'unknown';
      let safeToSend = false;

      if (clearoutData.status === 'valid') {
        status = 'valid';
        safeToSend = clearoutData.safe_to_send || false;
      } else if (clearoutData.status === 'invalid') {
        status = 'invalid';
      } else if (clearoutData.status === 'catch_all') {
        status = 'catch_all';
      } else if (clearoutData.status === 'unknown') {
        status = 'unknown';
      }

      // Update queue item as completed
      await supabaseClient
        .from('email_verification_queue')
        .update({
          status: 'completed',
          verification_result: clearoutData,
          completed_at: new Date().toISOString(),
          attempts: queueItem.attempts + 1
        })
        .eq('id', queueItem.id);

      // If valid, update professional record
      if (status === 'valid' && safeToSend) {
        await supabaseClient
          .from('professionals')
          .update({
            email_verified_at: new Date().toISOString()
          })
          .eq('id', queueItem.professional_id);

        console.log(`✅ Verified email for ${queueItem.name}: ${queueItem.email}`);
      } else {
        console.log(`⚠️ Email not verified for ${queueItem.name}: ${queueItem.email} (${status})`);
      }

      return new Response(JSON.stringify({
        success: true,
        queueItemId: queueItem.id,
        email: queueItem.email,
        name: queueItem.name,
        status,
        safeToSend,
        result: clearoutData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (verificationError: any) {
      console.error(`Error verifying ${queueItem.email}:`, verificationError);

      // Mark as failed or retry
      const shouldRetry = queueItem.attempts < queueItem.max_attempts;
      
      await supabaseClient
        .from('email_verification_queue')
        .update({
          status: shouldRetry ? 'pending' : 'failed',
          error_message: verificationError.message,
          attempts: queueItem.attempts + 1,
          started_at: null,
          completed_at: shouldRetry ? null : new Date().toISOString()
        })
        .eq('id', queueItem.id);

      return new Response(JSON.stringify({
        success: false,
        error: verificationError.message,
        willRetry: shouldRetry
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('Error in process-email-verification-queue:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
