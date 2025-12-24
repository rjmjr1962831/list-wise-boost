import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to process a single agent
async function processAgent(
  supabase: any, 
  item: any, 
  options: {
    dryRun: boolean;
    skipRecentlyEnriched: boolean;
    skipGenericBios: boolean;
    skipIfNoPress: boolean;
    minReviews: number;
    minExperience: number | null;
  }
) {
  try {
    // Determine starting stage based on queue item's current stage
    const startingStage = item.stage || 'exa_search';
    
    // Mark as processing
    await supabase
      .from('contact_enrichment_queue')
      .update({ 
        status: 'processing',
        stage: startingStage,
        started_at: new Date().toISOString(),
        attempts: item.attempts + 1
      })
      .eq('id', item.id);

    // Get agent info
    const { data: agent } = await supabase
      .from('professionals')
      .select('num_total_reviews, years_experience, name, company, business_name, city_id, zillow_profile_url, zillow_data_fetched_at')
      .eq('id', item.professional_id)
      .single();

    if (!agent) {
      throw new Error('Professional not found');
    }

    // Check if agent was recently enriched (within 15 days) - skip Firecrawl
    let skipFirecrawl = false;
    if (options.skipRecentlyEnriched && agent.zillow_data_fetched_at) {
      const daysSinceEnrichment = (Date.now() - new Date(agent.zillow_data_fetched_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEnrichment < 15) {
        console.log(`⏭️ [SKIP FIRECRAWL] ${agent.name} enriched ${daysSinceEnrichment.toFixed(1)} days ago`);
        skipFirecrawl = true;
      }
    }

    // Stage 1: Firecrawl (if starting from firecrawl stage or agent needs it)
    if (startingStage === 'firecrawl' && !skipFirecrawl) {
      console.log(`🔥 [FIRECRAWL] Processing ${agent.name}...`);
      
      if (!options.dryRun && agent.zillow_profile_url) {
        const { data: firecrawlData, error: enrichError } = await supabase.functions.invoke(
          'scrape-zillow-firecrawl',
          { body: { 
            zillow_url: agent.zillow_profile_url, 
            professional_id: item.professional_id, 
            save_to_db: true 
          } }
        );

        if (enrichError) {
          throw new Error(`Firecrawl failed: ${enrichError.message}`);
        }
        if (!firecrawlData?.success) {
          throw new Error(`Firecrawl failed: ${firecrawlData?.error || 'Unknown error'}`);
        }
        console.log(`✅ [FIRECRAWL] Complete for ${agent.name}`);
      }
      
      // Move to next stage
      await supabase.from('contact_enrichment_queue')
        .update({ stage: 'exa_search' })
        .eq('id', item.id);
    }

    // Check review count and experience qualification
    const hasEnoughReviews = agent?.num_total_reviews && agent.num_total_reviews >= options.minReviews;
    const hasEnoughExperience = options.minExperience === null || 
      (agent?.years_experience && agent.years_experience >= options.minExperience);
    
    if (!hasEnoughReviews || !hasEnoughExperience) {
      const reasons = [];
      if (!hasEnoughReviews) reasons.push(`${agent?.num_total_reviews || 0} reviews (min: ${options.minReviews})`);
      if (!hasEnoughExperience && options.minExperience !== null) {
        reasons.push(`${agent?.years_experience || 0} years exp (min: ${options.minExperience})`);
      }
      
      console.log(`⚠️ ${agent?.name} - ${reasons.join(', ')} - deactivating`);
      
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
      
      return { name: agent?.name, status: 'deactivated', reason: reasons.join(', '), success: true };
    }

    // Get city data for press research
    const { data: cityData } = await supabase
      .from('cities')
      .select('name, state')
      .eq('id', agent.city_id)
      .single();

    // Stage 2: Exa Search (web search for press mentions, awards, etc.)
    const currentStage = item.stage || startingStage;
    if (currentStage === 'exa_search' || startingStage === 'exa_search') {
      await supabase.from('contact_enrichment_queue')
        .update({ stage: 'exa_search' })
        .eq('id', item.id);

      console.log(`🔍 [EXA] Running web search for ${agent.name}...`);
      
      if (!options.dryRun) {
        const { data: exaResult, error: exaError } = await supabase.functions.invoke('search-agent-exa', {
          body: {
            agentName: agent.name,
            company: agent.company,
            businessName: agent.business_name,
            city: cityData?.name,
            state: cityData?.state,
            professionalId: item.professional_id,
            skipAiProcessing: true // Just do the Exa search, skip DeepSeek for now
          }
        });

        if (exaError) {
          console.error(`⚠️ [EXA] Error for ${agent.name}:`, exaError.message);
        } else {
          console.log(`✅ [EXA] Complete for ${agent.name} - found ${exaResult?.resultsCount || 0} results`);
        }
      }
      
      // Move to DeepSeek analysis stage
      await supabase.from('contact_enrichment_queue')
        .update({ stage: 'deepseek_analysis' })
        .eq('id', item.id);
    }

    // Stage 3: DeepSeek Analysis (process Exa results with DeepSeek for cost efficiency)
    const updatedStage = (await supabase.from('contact_enrichment_queue').select('stage').eq('id', item.id).single()).data?.stage;
    if (updatedStage === 'deepseek_analysis') {
      console.log(`🤖 [DEEPSEEK] Analyzing press mentions for ${agent.name}...`);
      
      if (!options.dryRun) {
        // DeepSeek processes the raw Exa results stored in professionals.raw_scraper_data
        const { data: deepseekResult, error: deepseekError } = await supabase.functions.invoke('analyze-press-deepseek', {
          body: {
            professionalId: item.professional_id,
            agentName: agent.name,
            city: cityData?.name,
            state: cityData?.state
          }
        });

        if (deepseekError) {
          console.error(`⚠️ [DEEPSEEK] Error for ${agent.name}:`, deepseekError.message);
        } else {
          console.log(`✅ [DEEPSEEK] Complete for ${agent.name}`);
        }
      }
      
      // Move to Sonnet synthesis stage
      await supabase.from('contact_enrichment_queue')
        .update({ stage: 'sonnet_synthesis' })
        .eq('id', item.id);
    }

    // Check if we should skip synthesis based on press mentions
    if (options.skipIfNoPress && !options.dryRun) {
      const { data: updatedAgent } = await supabase
        .from('professionals')
        .select('press_mentions')
        .eq('id', item.professional_id)
        .single();
      
      if (!updatedAgent?.press_mentions || 
          (Array.isArray(updatedAgent.press_mentions) && updatedAgent.press_mentions.length === 0)) {
        console.log(`⏭️ [SKIP] No press mentions found for ${agent.name}, skipping Sonnet synthesis`);
        await supabase.from('contact_enrichment_queue')
          .update({ status: 'completed', stage: 'completed', completed_at: new Date().toISOString() })
          .eq('id', item.id);
        return { name: agent.name, status: 'completed', skipped_synthesis: true, success: true };
      }
    }

    // Stage 4: Sonnet Synthesis (final bio generation with Claude Sonnet)
    const finalStage = (await supabase.from('contact_enrichment_queue').select('stage').eq('id', item.id).single()).data?.stage;
    if (finalStage === 'sonnet_synthesis') {
      console.log(`✍️ [SONNET] Synthesizing profile for ${agent.name}...`);
      
      if (!options.dryRun) {
        const { error: synthesisError } = await supabase.functions.invoke('synthesize-agent-profile', {
          body: { professionalId: item.professional_id }
        });
        
        if (synthesisError) {
          console.error(`⚠️ [SONNET] Synthesis failed for ${agent.name}:`, synthesisError.message);
        } else {
          console.log(`✅ [SONNET] Complete for ${agent.name}`);
        }
      }
    }

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

// Main background processing function
async function processQueue(
  batchSize: number,
  concurrency: number,
  costOptions: {
    dryRun: boolean;
    skipRecentlyEnriched: boolean;
    skipGenericBios: boolean;
    skipIfNoPress: boolean;
    minReviews: number;
    minExperience: number | null;
  },
  supabaseUrl: string,
  supabaseKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log(`🔄 [BACKGROUND] Processing up to ${batchSize} agents with ${concurrency} concurrent sessions...`);
  console.log(`🔧 Scraper: Firecrawl (only)`);
  console.log(`📊 Thresholds: minReviews=${costOptions.minReviews}, minExperience=${costOptions.minExperience === null ? 'none' : costOptions.minExperience}`);
  if (costOptions.dryRun) console.log(`⚠️ DRY RUN MODE - No AI calls will be made`);
  console.log(`💰 Cost controls: skipRecent=${costOptions.skipRecentlyEnriched}, skipGeneric=${costOptions.skipGenericBios}, skipNoPress=${costOptions.skipIfNoPress}`);

  try {
    // Automatic timeout recovery: Reset stuck processing items (>5 minutes old)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: stuckItems } = await supabase
      .from('contact_enrichment_queue')
      .update({ 
        status: 'pending', 
        stage: 'queued',
        started_at: null 
      })
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo)
      .select('id');

    if (stuckItems && stuckItems.length > 0) {
      console.log(`🔄 Reset ${stuckItems.length} stuck items back to pending`);
    }

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
      return { message: 'Queue is empty', processed: 0 };
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
        batch.map(item => processAgent(supabase, item, costOptions))
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

      // Rate limit: ~2-3 RPS means wait ~1.5s per concurrent request processed
      // With concurrency=4, wait 1.5s between batches to average ~2.5 RPS
      if (i < totalBatches - 1) {
        console.log('⏸️ Waiting 1.5s before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1500));
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
      
      // Fire-and-forget: trigger next batch with same cost controls
      fetch(`${supabaseUrl}/functions/v1/process-contact-enrichment-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          batchSize, 
          concurrency,
          ...costOptions
        })
      }).catch(err => console.log('Next batch triggered'));
    }

    return results;
  } catch (error: any) {
    console.error('❌ Process queue error:', error);
    return { error: error.message };
  }
}

// Handle shutdown gracefully
addEventListener('beforeunload', (ev: any) => {
  console.log(`🛑 Function shutdown due to: ${ev.detail?.reason || 'unknown'}`);
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      batchSize = 30, 
      concurrency = 4,
      dryRun = false,
      skipRecentlyEnriched = true,
      skipGenericBios = true,
      skipIfNoPress = false,
      minReviews = 20,
      minExperience = null
    } = await req.json().catch(() => ({
      batchSize: 30, 
      concurrency: 4,
      dryRun: false,
      skipRecentlyEnriched: true,
      skipGenericBios: true,
      skipIfNoPress: false,
      minReviews: 20,
      minExperience: null
    }));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const costOptions = { dryRun, skipRecentlyEnriched, skipGenericBios, skipIfNoPress, minReviews, minExperience };
    
    // Use EdgeRuntime.waitUntil for background processing
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      console.log('🚀 Starting background processing...');
      // @ts-ignore
      EdgeRuntime.waitUntil(processQueue(batchSize, concurrency, costOptions, supabaseUrl, supabaseKey));
      
      return new Response(
        JSON.stringify({ 
          message: 'Enrichment started in background',
          batchSize,
          concurrency,
          thresholds: { minReviews, minExperience }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Fallback to synchronous processing if EdgeRuntime not available
      console.log('⚠️ EdgeRuntime not available, running synchronously...');
      const results = await processQueue(batchSize, concurrency, costOptions, supabaseUrl, supabaseKey);
      
      return new Response(
        JSON.stringify(results),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
