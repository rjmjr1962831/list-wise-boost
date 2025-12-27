import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process a single agent - press research + synthesis only (NO Firecrawl)
async function processAgent(
  supabase: any, 
  professional: any,
  dryRun: boolean
) {
  try {
    console.log(`📰 [PRESS] Processing ${professional.name}...`);

    // Get city data for press search
    const { data: cityData } = await supabase
      .from('cities')
      .select('name, state')
      .eq('id', professional.city_id)
      .single();

    // Step 1: Press research with Claude
    if (dryRun) {
      console.log(`[DRY RUN] Would search press for ${professional.name}`);
    } else {
      const { data: pressResult, error: pressError } = await supabase.functions.invoke('search-agent-press-claude', {
        body: {
          agentName: professional.name,
          company: professional.company,
          businessName: professional.business_name,
          city: cityData?.name,
          state: cityData?.state,
          professionalId: professional.id
        }
      });

      if (pressError) {
        console.error(`⚠️ Press search failed for ${professional.name}:`, pressError.message);
      } else {
        console.log(`✅ [PRESS] Complete for ${professional.name}`);
      }
    }

    // Step 2: Synthesis
    if (dryRun) {
      console.log(`[DRY RUN] Would synthesize profile for ${professional.name}`);
    } else {
      console.log(`🤖 [SYNTHESIS] Running for ${professional.name}...`);
      
      const { error: synthesisError } = await supabase.functions.invoke('synthesize-agent-profile', {
        body: { professionalId: professional.id }
      });
      
      if (synthesisError) {
        console.error(`⚠️ Synthesis failed for ${professional.name}:`, synthesisError.message);
        return { name: professional.name, status: 'synthesis_failed', error: synthesisError.message, success: false };
      } else {
        console.log(`✅ [SYNTHESIS] Complete for ${professional.name}`);
      }
    }

    return { name: professional.name, status: 'completed', success: true };

  } catch (error: any) {
    console.error(`❌ Failed ${professional.name}:`, error.message);
    return { name: professional.name, status: 'failed', error: error.message, success: false };
  }
}

// Main background processing function
async function processAllAgents(
  batchSize: number,
  concurrency: number,
  dryRun: boolean,
  offset: number,
  supabaseUrl: string,
  supabaseKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log(`🔄 [PRESS-ONLY RE-ENRICHMENT] Starting from offset ${offset}, batch ${batchSize}, concurrency ${concurrency}`);
  if (dryRun) console.log(`⚠️ DRY RUN MODE - No AI calls will be made`);

  try {
    // Get active professionals with old synthesis dates (before 12/21/2025)
    const { data: professionals, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, company, business_name, city_id')
      .eq('active', true)
      .lt('profile_last_synthesized_at', '2025-12-21')
      .order('profile_last_synthesized_at', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch professionals: ${fetchError.message}`);
    }

    if (!professionals || professionals.length === 0) {
      console.log('✅ All agents processed');
      return { message: 'All agents processed', processed: 0, total_offset: offset };
    }

    console.log(`📦 Processing ${professionals.length} agents (offset ${offset})`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      agents: [] as any[]
    };

    // Process in parallel batches
    const totalBatches = Math.ceil(professionals.length / concurrency);
    
    for (let i = 0; i < totalBatches; i++) {
      const batchStart = i * concurrency;
      const batchEnd = Math.min((i + 1) * concurrency, professionals.length);
      const batch = professionals.slice(batchStart, batchEnd);
      
      console.log(`📦 Batch ${i + 1}/${totalBatches}: Processing ${batch.length} agents in parallel`);

      // Process all agents in batch concurrently
      const batchResults = await Promise.allSettled(
        batch.map(agent => processAgent(supabase, agent, dryRun))
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

      console.log(`✅ Batch ${i + 1}/${totalBatches} complete`);

      // Rate limit between batches
      if (i < totalBatches - 1) {
        console.log('⏸️ Waiting 2s before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`📊 Batch complete: ${results.succeeded} succeeded, ${results.failed} failed`);

    // Calculate next offset
    const nextOffset = offset + professionals.length;

    // Check if there are more professionals to process (with old synthesis)
    const { count: totalCount } = await supabase
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .lt('profile_last_synthesized_at', '2025-12-21');

    if (nextOffset < (totalCount || 0)) {
      console.log(`🔄 ${(totalCount || 0) - nextOffset} agents remaining, triggering next batch...`);
      
      // Fire-and-forget: trigger next batch
      fetch(`${supabaseUrl}/functions/v1/rerun-press-synthesis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          batchSize, 
          concurrency,
          dryRun,
          offset: nextOffset
        })
      }).catch(err => console.log('Next batch triggered'));
    } else {
      console.log('🎉 All agents processed!');
    }

    return {
      ...results,
      offset,
      nextOffset,
      totalActive: totalCount,
      remaining: Math.max(0, (totalCount || 0) - nextOffset)
    };
  } catch (error: any) {
    console.error('❌ Process error:', error);
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
      batchSize = 20, 
      concurrency = 3,
      dryRun = false,
      offset = 0
    } = await req.json().catch(() => ({
      batchSize: 20, 
      concurrency: 3,
      dryRun: false,
      offset: 0
    }));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use EdgeRuntime.waitUntil for background processing
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      console.log('🚀 Starting press-only re-enrichment in background...');
      // @ts-ignore
      EdgeRuntime.waitUntil(processAllAgents(batchSize, concurrency, dryRun, offset, supabaseUrl, supabaseKey));
      
      return new Response(
        JSON.stringify({ 
          message: 'Press-only re-enrichment started in background',
          batchSize,
          concurrency,
          dryRun,
          offset
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Fallback to synchronous processing
      console.log('⚠️ EdgeRuntime not available, running synchronously...');
      const results = await processAllAgents(batchSize, concurrency, dryRun, offset, supabaseUrl, supabaseKey);
      
      return new Response(
        JSON.stringify(results),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
