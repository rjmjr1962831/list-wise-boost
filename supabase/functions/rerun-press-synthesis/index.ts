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

    // Step 3: Sync to Pipedrive
    if (dryRun) {
      console.log(`[DRY RUN] Would sync to Pipedrive for ${professional.name}`);
    } else {
      console.log(`📤 [PIPEDRIVE] Syncing ${professional.name}...`);
      
      const { error: syncError } = await supabase.functions.invoke('sync-single-professional', {
        body: { professional_id: professional.id }
      });
      
      if (syncError) {
        console.error(`⚠️ Pipedrive sync failed for ${professional.name}:`, syncError.message);
        // Don't fail the whole process for sync errors
      } else {
        console.log(`✅ [PIPEDRIVE] Synced ${professional.name}`);
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
  supabaseKey: string,
  stateFilter?: string,
  targetShortBios: boolean = false
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const stateLabel = stateFilter ? ` for ${stateFilter}` : '';
  const modeLabel = targetShortBios ? ' [SHORT/MISSING BIOS]' : '';
  console.log(`🔄 [PRESS-ONLY RE-ENRICHMENT${stateLabel}${modeLabel}] Starting from offset ${offset}, batch ${batchSize}, concurrency ${concurrency}`);
  if (dryRun) console.log(`⚠️ DRY RUN MODE - No AI calls will be made`);

  try {
    // If state filter provided, get city IDs for that state first
    let cityIds: string[] = [];
    if (stateFilter) {
      const { data: cities, error: cityError } = await supabase
        .from('cities')
        .select('id')
        .eq('state', stateFilter);
      
      if (cityError) {
        throw new Error(`Failed to fetch cities for ${stateFilter}: ${cityError.message}`);
      }
      cityIds = cities?.map(c => c.id) || [];
      console.log(`📍 Found ${cityIds.length} cities in ${stateFilter}`);
      
      if (cityIds.length === 0) {
        return { message: `No cities found for state: ${stateFilter}`, processed: 0 };
      }
    }

    // Build query for professionals
    // If targetShortBios is true, only get agents with short bios (≤600 chars) or no bios
    // Otherwise, use the old date-based filter
    let query = supabase
      .from('professionals')
      .select('id, name, company, business_name, city_id, synthesized_bio, profile_last_synthesized_at')
      .eq('active', true)
      .gte('review_stars_rating', 4.8)
      .gte('num_total_reviews', 20);
    
    // Apply state filter if provided
    if (stateFilter && cityIds.length > 0) {
      query = query.in('city_id', cityIds);
    }
    
    // Fetch all candidates first, then filter in memory for short bios
    const { data: allProfessionals, error: fetchError } = await query
      .order('profile_last_synthesized_at', { ascending: true, nullsFirst: true })
      .limit(1000);

    if (fetchError) {
      throw new Error(`Failed to fetch professionals: ${fetchError.message}`);
    }

    // Filter based on mode
    let filteredProfessionals = allProfessionals || [];
    
    if (targetShortBios) {
      // Filter to only agents with short bios (≤600 chars) or no bios
      filteredProfessionals = filteredProfessionals.filter(p => {
        const bioLength = p.synthesized_bio?.length || 0;
        return bioLength === 0 || bioLength <= 600;
      });
      console.log(`📊 Found ${filteredProfessionals.length} agents with short/missing bios`);
    } else {
      // Original date-based filter (for backwards compatibility)
      filteredProfessionals = filteredProfessionals.filter(p => {
        const lastSynthesized = p.profile_last_synthesized_at;
        return !lastSynthesized || new Date(lastSynthesized as string) < new Date('2025-12-21');
      });
    }

    // Apply pagination
    const professionals = filteredProfessionals.slice(offset, offset + batchSize);

    if (!professionals || professionals.length === 0) {
      console.log(`✅ All agents processed${stateLabel}`);
      return { message: `All agents processed${stateLabel}`, processed: 0, total_offset: offset };
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

    // Check if there are more professionals to process (with old synthesis or NULL)
    let countQuery = supabase
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .or('profile_last_synthesized_at.lt.2025-12-21,profile_last_synthesized_at.is.null');
    
    if (stateFilter && cityIds.length > 0) {
      countQuery = countQuery.in('city_id', cityIds);
    }
    
    const { count: totalCount } = await countQuery;

    if (nextOffset < (totalCount || 0)) {
      console.log(`🔄 ${(totalCount || 0) - nextOffset} agents remaining${stateLabel}, triggering next batch...`);
      
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
          offset: nextOffset,
          state: stateFilter
        })
      }).catch(err => console.log('Next batch triggered'));
    } else {
      console.log(`🎉 All agents processed${stateLabel}!`);
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
      offset = 0,
      state = undefined,
      targetShortBios = false
    } = await req.json().catch(() => ({
      batchSize: 20, 
      concurrency: 3,
      dryRun: false,
      offset: 0,
      state: undefined,
      targetShortBios: false
    }));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use EdgeRuntime.waitUntil for background processing
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      const stateLabel = state ? ` for ${state}` : '';
      const modeLabel = targetShortBios ? ' [SHORT/MISSING BIOS]' : '';
      console.log(`🚀 Starting press-only re-enrichment${stateLabel}${modeLabel} in background...`);
      // @ts-ignore
      EdgeRuntime.waitUntil(processAllAgents(batchSize, concurrency, dryRun, offset, supabaseUrl, supabaseKey, state, targetShortBios));
      
      return new Response(
        JSON.stringify({ 
          message: `Press-only re-enrichment${stateLabel}${modeLabel} started in background`,
          batchSize,
          concurrency,
          dryRun,
          offset,
          state,
          targetShortBios
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Fallback to synchronous processing
      const stateLabel = state ? ` for ${state}` : '';
      const modeLabel = targetShortBios ? ' [SHORT/MISSING BIOS]' : '';
      console.log(`⚠️ EdgeRuntime not available, running synchronously${stateLabel}${modeLabel}...`);
      const results = await processAllAgents(batchSize, concurrency, dryRun, offset, supabaseUrl, supabaseKey, state, targetShortBios);
      
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
