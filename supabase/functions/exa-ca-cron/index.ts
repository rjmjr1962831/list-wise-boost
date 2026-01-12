import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Check if cron is enabled
    const { data: cronState } = await supabase
      .from('cron_state')
      .select('*')
      .eq('job_name', 'exa-ca-zillow')
      .single();

    if (!cronState || !cronState.is_running) {
      console.log('Cron job is not running or does not exist');
      return new Response(JSON.stringify({ 
        message: 'Cron job is disabled or not found',
        is_running: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check remaining agents
    const { count: remaining } = await supabase
      .from('state_licenses')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'CA')
      .is('zillow_url', null)
      .is('exa_searched_at', null);

    if (!remaining || remaining === 0) {
      console.log('All CA agents processed! Stopping cron.');
      await supabase.from('cron_state').update({
        is_running: false,
        completed_at: new Date().toISOString(),
        status: 'completed',
        message: 'All agents processed'
      }).eq('job_name', 'exa-ca-zillow');

      return new Response(JSON.stringify({ 
        message: 'All CA agents processed',
        remaining: 0,
        is_running: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check error threshold
    if (cronState.consecutive_errors >= 5) {
      console.log('Too many consecutive errors! Stopping cron.');
      await supabase.from('cron_state').update({
        is_running: false,
        status: 'stopped_errors',
        message: `Stopped due to ${cronState.consecutive_errors} consecutive errors`
      }).eq('job_name', 'exa-ca-zillow');

      return new Response(JSON.stringify({ 
        message: 'Stopped due to too many errors',
        consecutive_errors: cronState.consecutive_errors,
        is_running: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run 3 batches per minute (every ~20 seconds)
    const batchesPerMinute = 3;
    const delayBetweenBatches = 20000; // 20 seconds
    
    let totalProcessed = 0;
    let totalFound = 0;
    let totalNotFound = 0;
    let totalErrors = 0;
    let consecutiveErrors = cronState.consecutive_errors || 0;

    console.log(`Starting ${batchesPerMinute} batches. Remaining: ${remaining}`);

    for (let i = 0; i < batchesPerMinute; i++) {
      // Check if still running (in case manually stopped)
      if (i > 0) {
        const { data: currentState } = await supabase
          .from('cron_state')
          .select('is_running')
          .eq('job_name', 'exa-ca-zillow')
          .single();
        
        if (!currentState?.is_running) {
          console.log('Job was stopped during execution');
          break;
        }
      }

      console.log(`Running batch ${i + 1} of ${batchesPerMinute}`);

      // Call the exa-ca-zillow-search function
      const { data: result, error } = await supabase.functions.invoke('exa-ca-zillow-search', {
        body: { 
          batch_size: 10, 
          delay_ms: 1500 
        }
      });

      if (error) {
        console.error(`Batch ${i + 1} error:`, error);
        consecutiveErrors++;
        totalErrors++;
        
        if (consecutiveErrors >= 5) {
          await supabase.from('cron_state').update({
            is_running: false,
            status: 'stopped_errors',
            message: 'Stopped due to 5 consecutive errors',
            last_error: error.message,
            consecutive_errors: consecutiveErrors,
            total_errors: (cronState.total_errors || 0) + totalErrors
          }).eq('job_name', 'exa-ca-zillow');
          break;
        }
      } else {
        consecutiveErrors = 0; // Reset on success
        const summary = result?.summary || {};
        totalProcessed += summary.total || 0;
        totalFound += summary.found || 0;
        totalNotFound += summary.notFound || 0;
        totalErrors += summary.errors || 0;
        
        console.log(`Batch ${i + 1} result: ${summary.found} found, ${summary.notFound} not found`);
      }

      // Wait 20 seconds before next batch (except after last one)
      if (i < batchesPerMinute - 1) {
        console.log(`Waiting ${delayBetweenBatches / 1000}s before next batch...`);
        await sleep(delayBetweenBatches);
      }
    }

    // Get updated remaining count
    const { count: newRemaining } = await supabase
      .from('state_licenses')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'CA')
      .is('zillow_url', null)
      .is('exa_searched_at', null);

    // Update cron state with results
    await supabase.from('cron_state').update({
      consecutive_errors: consecutiveErrors,
      total_processed: (cronState.total_processed || 0) + totalProcessed,
      total_found: (cronState.total_found || 0) + totalFound,
      total_not_found: (cronState.total_not_found || 0) + totalNotFound,
      total_errors: (cronState.total_errors || 0) + totalErrors,
      last_run_at: new Date().toISOString(),
      remaining_count: newRemaining
    }).eq('job_name', 'exa-ca-zillow');

    console.log(`Minute complete: ${totalProcessed} processed, ${totalFound} found, ${newRemaining} remaining`);

    return new Response(JSON.stringify({
      message: 'Batches processed',
      batches_run: batchesPerMinute,
      processed: totalProcessed,
      found: totalFound,
      not_found: totalNotFound,
      errors: totalErrors,
      remaining: newRemaining,
      is_running: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cron error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});