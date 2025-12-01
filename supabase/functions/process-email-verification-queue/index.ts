import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify a single email item
async function verifyEmail(queueItem: any, clearoutApiKey: string, supabaseClient: any) {
  console.log(`Processing verification for: ${queueItem.name} (${queueItem.email})`);

  try {
    // Apply delay if configured
    if (queueItem.delay_seconds > 0) {
      console.log(`Applying ${queueItem.delay_seconds}s delay before verification`);
      await new Promise(resolve => setTimeout(resolve, queueItem.delay_seconds * 1000));
    }

    // Call Clearout API
    const clearoutResponse = await fetch('https://api.clearout.io/v2/email_verify/instant', {
      method: 'POST',
      headers: {
        'Authorization': clearoutApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: queueItem.email,
        timeout: 3000,
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

      return {
        success: false,
        rateLimited: true,
        queueItemId: queueItem.id,
        email: queueItem.email,
        name: queueItem.name,
      };
    }

    let status = 'unknown';
    let safeToSend = false;

    // Parse the nested Clearout response
    if (clearoutData.status === 'success' && clearoutData.data) {
      status = clearoutData.data.status || 'unknown';
      const safeToSendValue = clearoutData.data.safe_to_send;
      safeToSend = safeToSendValue === 'yes' || safeToSendValue === 'risky';
    } else if (clearoutData.status === 'failed') {
      status = 'failed';
    } else {
      status = clearoutData.status || 'unknown';
      const safeToSendValue = clearoutData.safe_to_send;
      safeToSend = safeToSendValue === 'yes' || safeToSendValue === 'risky';
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
      const { error: updateError } = await supabaseClient
        .from('professionals')
        .update({
          email_verified_at: new Date().toISOString()
        })
        .eq('id', queueItem.professional_id);

      if (updateError) {
        console.error(`❌ Failed to update professional ${queueItem.name}: ${updateError.message}`);
      } else {
        console.log(`✅ Verified email for ${queueItem.name}: ${queueItem.email}`);
      }
    } else {
      console.log(`⚠️ Email not verified for ${queueItem.name}: ${queueItem.email} (${status})`);
    }

    return {
      success: true,
      queueItemId: queueItem.id,
      email: queueItem.email,
      name: queueItem.name,
      status,
      safeToSend,
      result: clearoutData
    };

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

    return {
      success: false,
      error: verificationError.message,
      willRetry: shouldRetry,
      queueItemId: queueItem.id,
      email: queueItem.email,
      name: queueItem.name,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { concurrency = 5 } = await req.json().catch(() => ({}));
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const clearoutApiKey = Deno.env.get('CLEAROUT_API_KEY');
    if (!clearoutApiKey) {
      throw new Error('CLEAROUT_API_KEY not configured');
    }

    // Get multiple pending items from queue with atomic locking
    const { data: queueItems, error: fetchError } = await supabaseClient
      .from('email_verification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(concurrency);

    if (fetchError) {
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'Queue is empty',
        queueEmpty: true,
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔄 Processing ${queueItems.length} emails concurrently...`);

    // Atomically mark all items as processing (prevents other instances from picking them up)
    const itemIds = queueItems.map(item => item.id);
    const { error: lockError } = await supabaseClient
      .from('email_verification_queue')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString() 
      })
      .in('id', itemIds)
      .eq('status', 'pending'); // Only update if still pending (atomic check)

    if (lockError) {
      console.error('Failed to lock queue items:', lockError);
      throw lockError;
    }

    // Process all items concurrently using Promise.allSettled
    const results = await Promise.allSettled(
      queueItems.map(item => verifyEmail(item, clearoutApiKey, supabaseClient))
    );

    // Analyze results
    const processed = results.length;
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const rateLimited = results.some(r => r.status === 'fulfilled' && r.value.rateLimited);
    const errors = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    console.log(`✅ Processed ${processed} emails: ${successful} successful, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      successful,
      errors,
      rateLimited,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' })
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in process-email-verification-queue:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
