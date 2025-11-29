import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to process a single agent
async function processAgent(supabase: any, item: any) {
  try {
    // Mark as processing - starting with memo23
    await supabase
      .from('contact_enrichment_queue')
      .update({ 
        status: 'processing',
        stage: 'memo23',
        started_at: new Date().toISOString(),
        attempts: item.attempts + 1
      })
      .eq('id', item.id);

    console.log(`🔄 [MEMO23] Processing ${item.professionals?.name}...`);

    // Step 1: memo23 enrichment
    const { error: enrichError } = await supabase.functions.invoke(
      'fetch-single-memo23-agent',
      { body: { professionalId: item.professional_id } }
    );

    if (enrichError) {
      throw new Error(`memo23 failed: ${enrichError.message}`);
    }
    console.log(`✅ [MEMO23] Complete for ${item.professionals?.name}`);

    // Step 2: Check review count qualification
    const { data: agent } = await supabase
      .from('professionals')
      .select('num_total_reviews, name, company, business_name, city_id')
      .eq('id', item.professional_id)
      .single();

    if (!agent?.num_total_reviews || agent.num_total_reviews < 100) {
      console.log(`⚠️ ${agent?.name} has ${agent?.num_total_reviews || 0} reviews - deactivating`);
      await supabase.from('professionals')
        .update({ active: false })
        .eq('id', item.professional_id);
      
      await supabase.from('contact_enrichment_queue')
        .update({ 
          status: 'completed', 
          stage: 'completed',
          completed_at: new Date().toISOString() 
        })
        .eq('id', item.id);
      
      return { name: agent?.name, status: 'deactivated', reason: 'low_reviews', success: true };
    }

    // Step 3: Press research with Perplexity (auto-triggers synthesis)
    await supabase
      .from('contact_enrichment_queue')
      .update({ stage: 'press_research' })
      .eq('id', item.id);

    console.log(`📰 [PRESS] Running Perplexity press search for ${agent.name}...`);
    
    const { data: cityData } = await supabase
      .from('cities')
      .select('name, state')
      .eq('id', agent.city_id)
      .single();

    await supabase.functions.invoke('search-agent-press', {
      body: {
        agentName: agent.name,
        company: agent.company,
        businessName: agent.business_name,
        city: cityData?.name,
        state: cityData?.state,
        professionalId: item.professional_id
      }
    });

    console.log(`✅ [PRESS] Complete for ${agent.name}`);

    // Update to synthesis stage
    await supabase
      .from('contact_enrichment_queue')
      .update({ stage: 'synthesis' })
      .eq('id', item.id);

    console.log(`🤖 [SYNTHESIS] Auto-triggered for ${agent.name}`);

    // Mark as completed
    await supabase.from('contact_enrichment_queue')
      .update({ 
        status: 'completed', 
        stage: 'completed',
        completed_at: new Date().toISOString() 
      })
      .eq('id', item.id);

    return { name: agent.name, status: 'completed', success: true };

  } catch (error: any) {
    console.error(`❌ Failed ${item.professionals?.name}:`, error.message);
    
    const newStatus = item.attempts + 1 >= 3 ? 'failed' : 'pending';
    await supabase.from('contact_enrichment_queue')
      .update({ status: newStatus, error_message: error.message })
      .eq('id', item.id);

    return { name: item.professionals?.name, status: newStatus, error: error.message, success: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 100, concurrency = 10 } = await req.json().catch(() => ({ 
      batchSize: 100, 
      concurrency: 10 
    }));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 Processing up to ${batchSize} agents with ${concurrency} concurrent sessions...`);

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

    console.log(`📦 Processing ${queueItems.length} agents in batches of ${concurrency}`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      agents: [] as any[]
    };

    // Process in parallel batches
    const totalBatches = Math.ceil(queueItems.length / concurrency);
    
    for (let i = 0; i < totalBatches; i++) {
      const batchStart = i * concurrency;
      const batchEnd = Math.min((i + 1) * concurrency, queueItems.length);
      const batch = queueItems.slice(batchStart, batchEnd);
      
      console.log(`📦 Batch ${i + 1}/${totalBatches}: Processing ${batch.length} agents in parallel`);

      // Process all agents in batch concurrently
      const batchResults = await Promise.allSettled(
        batch.map(item => processAgent(supabase, item))
      );

      // Collect results
      batchResults.forEach((result) => {
        results.processed++;
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.succeeded++;
          } else {
            results.failed++;
          }
          results.agents.push(result.value);
        } else {
          results.failed++;
          results.agents.push({
            name: 'Unknown',
            status: 'failed',
            error: result.reason
          });
        }
      });

      console.log(`✅ Batch ${i + 1}/${totalBatches} complete: ${batch.length} agents processed`);

      // Wait between batches (but not after the last one)
      if (i < totalBatches - 1) {
        console.log('⏸️ Waiting 3s before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`📊 All batches complete: ${results.succeeded} succeeded, ${results.failed} failed`);

    // Check for remaining items and self-continue
    const { count: remainingCount } = await supabase
      .from('contact_enrichment_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('attempts', 3);

    if (remainingCount && remainingCount > 0) {
      console.log(`🔄 ${remainingCount} items remaining, triggering next batch...`);
      
      // Fire-and-forget: trigger next batch
      fetch(`${supabaseUrl}/functions/v1/process-contact-enrichment-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchSize, concurrency })
      }).catch(err => console.log('Next batch triggered'));
    }

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
