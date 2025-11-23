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
    const { batchSize = 100 } = await req.json().catch(() => ({ batchSize: 100 }));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 Processing up to ${batchSize} agents from queue...`);

    // Get pending items from queue
    const { data: queueItems, error: queueError } = await supabase
      .from('contact_enrichment_queue')
      .select('*, professionals(name, zillow_profile_url)')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (queueError) {
      throw new Error(`Failed to fetch queue: ${queueError.message}`);
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('✅ Queue is empty');
      return new Response(
        JSON.stringify({ message: 'Queue is empty', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 Processing ${queueItems.length} agents`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      agents: [] as any[]
    };

    // Process each item
    for (const item of queueItems) {
      try {
        // Mark as processing
        await supabase
          .from('contact_enrichment_queue')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString(),
            attempts: item.attempts + 1
          })
          .eq('id', item.id);

        console.log(`🔄 Processing ${item.professionals?.name}...`);

        // Call fetch-single-memo23-agent
        const { data: enrichData, error: enrichError } = await supabase.functions.invoke(
          'fetch-single-memo23-agent',
          { body: { professionalId: item.professional_id } }
        );

        if (enrichError) {
          throw new Error(enrichError.message);
        }

        // Mark as completed
        await supabase
          .from('contact_enrichment_queue')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', item.id);

        console.log(`✅ Completed ${item.professionals?.name}`);
        results.succeeded++;
        results.agents.push({
          name: item.professionals?.name,
          status: 'completed'
        });

      } catch (error: any) {
        console.error(`❌ Failed ${item.professionals?.name}:`, error.message);
        
        // Mark as failed if max attempts reached, otherwise back to pending
        const newStatus = item.attempts + 1 >= 3 ? 'failed' : 'pending';
        await supabase
          .from('contact_enrichment_queue')
          .update({ 
            status: newStatus,
            error_message: error.message
          })
          .eq('id', item.id);

        results.failed++;
        results.agents.push({
          name: item.professionals?.name,
          status: newStatus,
          error: error.message
        });
      }

      results.processed++;

      // Small delay between agents
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`📊 Batch complete: ${results.succeeded} succeeded, ${results.failed} failed`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Process queue error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
