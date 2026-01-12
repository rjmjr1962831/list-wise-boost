import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log(`Running batch. Remaining: ${remaining}, Consecutive errors: ${cronState.consecutive_errors}`);

    // Call the exa-ca-zillow-search function
    const { data: result, error } = await supabase.functions.invoke('exa-ca-zillow-search', {
      body: { 
        batch_size: 10, 
        delay_ms: 1500 
      }
    });

    if (error) {
      console.error('Error invoking exa-ca-zillow-search:', error);
      await supabase.from('cron_state').update({
        consecutive_errors: cronState.consecutive_errors + 1,
        last_error: error.message,
        last_run_at: new Date().toISOString()
      }).eq('job_name', 'exa-ca-zillow');

      return new Response(JSON.stringify({ 
        error: error.message,
        consecutive_errors: cronState.consecutive_errors + 1 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const summary = result?.summary || {};
    const hasErrors = summary.errors > 0;

    // Update cron state
    await supabase.from('cron_state').update({
      consecutive_errors: hasErrors ? cronState.consecutive_errors + 1 : 0,
      total_processed: cronState.total_processed + (summary.total || 0),
      total_found: cronState.total_found + (summary.found || 0),
      total_not_found: cronState.total_not_found + (summary.notFound || 0),
      total_errors: cronState.total_errors + (summary.errors || 0),
      last_run_at: new Date().toISOString(),
      last_error: hasErrors ? `${summary.errors} errors in batch` : null,
      remaining_count: result?.remaining || remaining
    }).eq('job_name', 'exa-ca-zillow');

    console.log(`Batch complete: ${summary.found} found, ${summary.notFound} not found, ${summary.errors} errors. Remaining: ${result?.remaining}`);

    return new Response(JSON.stringify({
      message: 'Batch processed',
      summary,
      remaining: result?.remaining,
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
