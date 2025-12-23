import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔄 Cron: Checking for active pipeline...');

  try {
    // Check for an active, non-paused pipeline
    const { data: pipeline, error: fetchError } = await supabase
      .from('pipeline_state')
      .select('*')
      .eq('is_running', true)
      .eq('is_paused', false)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching pipeline state:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pipeline) {
      console.log('✅ No active pipeline to process');
      return new Response(JSON.stringify({ message: 'No active pipeline' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📍 Processing ${pipeline.state} at index ${pipeline.current_index}`);

    // Update last_run_at
    await supabase
      .from('pipeline_state')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', pipeline.id);

    // Call the process-state-licenses function
    const { data: result, error: processError } = await supabase.functions.invoke('process-state-licenses', {
      body: {
        state: pipeline.state,
        stateAbbr: pipeline.state_abbr,
        startIndex: pipeline.current_index,
        batchSize: pipeline.batch_size,
        concurrency: pipeline.concurrency,
      },
    });

    if (processError) {
      console.error('❌ Process error:', processError);
      
      // Update pipeline with error
      await supabase
        .from('pipeline_state')
        .update({
          error_message: processError.message,
          total_errors: pipeline.total_errors + 1,
        })
        .eq('id', pipeline.id);

      return new Response(JSON.stringify({ error: processError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Batch complete:`, result?.stats);

    // Update pipeline state with results
    const stats = result?.stats || {};
    const newIndex = result?.nextIndex ?? pipeline.current_index + pipeline.batch_size;
    const hasMore = result?.hasMore ?? false;

    const updateData: Record<string, unknown> = {
      current_index: newIndex,
      total_processed: pipeline.total_processed + (stats.processed || 0),
      total_qualified: pipeline.total_qualified + (stats.qualified || 0),
      total_not_qualified: pipeline.total_not_qualified + (stats.notQualified || 0),
      total_duplicates: pipeline.total_duplicates + (stats.duplicates || 0),
      total_no_results: pipeline.total_no_results + (stats.noResults || 0),
      total_errors: pipeline.total_errors + (stats.errors || 0),
      error_message: null,
    };

    // Check if we're done
    if (!hasMore) {
      updateData.is_running = false;
      updateData.completed_at = new Date().toISOString();
      console.log(`🎉 Pipeline complete for ${pipeline.state}!`);
    }

    await supabase
      .from('pipeline_state')
      .update(updateData)
      .eq('id', pipeline.id);

    return new Response(JSON.stringify({
      success: true,
      state: pipeline.state,
      processedBatch: stats.processed || 0,
      nextIndex: newIndex,
      hasMore,
      totalProcessed: pipeline.total_processed + (stats.processed || 0),
      totalQualified: pipeline.total_qualified + (stats.qualified || 0),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
