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
    const { 
      stateSlug = 'arizona',
      batchSize = 5,
      offset = 0,
      skipRecentlyEnriched = false 
    } = await req.json();

    console.log(`🚀 Starting batch memo23 enrichment for ${stateSlug}`);
    console.log(`   Batch size: ${batchSize}, Offset: ${offset}, Skip recent: ${skipRecentlyEnriched}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get total count
    const { count: totalCount } = await supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .eq('state_slug', stateSlug)
      .not('zillow_profile_url', 'is', null);

    console.log(`📊 Total agents with Zillow URLs in ${stateSlug}: ${totalCount}`);

    // Fetch batch of agents ordered by zillow_data_fetched_at (nulls first = never enriched)
    const { data: agents, error: agentsError } = await supabase
      .from('professionals')
      .select('id, name, zillow_profile_url, zillow_data_fetched_at')
      .eq('active', true)
      .eq('state_slug', stateSlug)
      .not('zillow_profile_url', 'is', null)
      .order('zillow_data_fetched_at', { ascending: true, nullsFirst: true })
      .range(offset, offset + batchSize - 1);

    if (agentsError) {
      throw new Error(`Failed to fetch agents: ${agentsError.message}`);
    }

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          completed: true,
          message: 'No more agents to process',
          totalProcessed: offset,
          totalAgents: totalCount
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Processing batch of ${agents.length} agents (offset ${offset})`);

    const results: any[] = [];
    
    // Process agents concurrently
    const enrichPromises = agents.map(async (agent) => {
      try {
        console.log(`▶️ Starting enrichment for ${agent.name} (${agent.id})`);
        
        // Call fetch-single-memo23-agent internally
        const response = await fetch(`${supabaseUrl}/functions/v1/fetch-single-memo23-agent`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            professionalId: agent.id,
            skipRecentlyEnriched: skipRecentlyEnriched,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ ${agent.name}: ${result.success ? 'Success' : 'Failed'} - ${result.updatedFields?.length || 0} fields`);
        
        return {
          id: agent.id,
          name: agent.name,
          success: result.success,
          skipped: result.skipped,
          fieldsUpdated: result.updatedFields?.length || 0,
          error: null
        };
      } catch (error: any) {
        console.error(`❌ ${agent.name}: ${error.message}`);
        return {
          id: agent.id,
          name: agent.name,
          success: false,
          skipped: false,
          fieldsUpdated: 0,
          error: error.message
        };
      }
    });

    const batchResults = await Promise.all(enrichPromises);
    
    const successCount = batchResults.filter(r => r.success && !r.skipped).length;
    const skippedCount = batchResults.filter(r => r.skipped).length;
    const errorCount = batchResults.filter(r => !r.success && !r.skipped).length;

    console.log(`📊 Batch complete: ${successCount} success, ${skippedCount} skipped, ${errorCount} errors`);

    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < (totalCount || 0);

    return new Response(
      JSON.stringify({ 
        success: true,
        completed: !hasMore,
        batchResults,
        stats: {
          batchSuccess: successCount,
          batchSkipped: skippedCount,
          batchErrors: errorCount,
          processed: nextOffset,
          total: totalCount,
          remaining: Math.max(0, (totalCount || 0) - nextOffset)
        },
        nextOffset: hasMore ? nextOffset : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Batch enrichment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
