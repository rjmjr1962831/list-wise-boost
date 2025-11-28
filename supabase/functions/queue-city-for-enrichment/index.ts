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
    const { cityId } = await req.json();
    
    if (!cityId) {
      throw new Error('cityId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 Queueing agents for re-enrichment in city: ${cityId}`);

    // Get city name for logging
    const { data: city } = await supabase
      .from('cities')
      .select('name')
      .eq('id', cityId)
      .single();

    // Find all active agents in this city that need enrichment
    // (zillow_data_fetched_at IS NULL means they need to be enriched)
    const { data: agents, error: agentsError } = await supabase
      .from('professionals')
      .select('id, name, zillow_profile_url')
      .eq('city_id', cityId)
      .eq('active', true)
      .is('zillow_data_fetched_at', null)
      .not('zillow_profile_url', 'is', null);

    if (agentsError) {
      throw new Error(`Failed to fetch agents: ${agentsError.message}`);
    }

    if (!agents || agents.length === 0) {
      console.log(`✅ No agents need enrichment in ${city?.name || cityId}`);
      return new Response(
        JSON.stringify({ 
          message: 'No agents need enrichment',
          city: city?.name,
          queued: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 Found ${agents.length} agents needing enrichment in ${city?.name}`);

    // Check which agents are already in the queue
    const { data: existingQueue } = await supabase
      .from('contact_enrichment_queue')
      .select('professional_id')
      .in('professional_id', agents.map(a => a.id))
      .in('status', ['pending', 'processing']);

    const existingIds = new Set(existingQueue?.map(q => q.professional_id) || []);
    const agentsToQueue = agents.filter(a => !existingIds.has(a.id));

    if (agentsToQueue.length === 0) {
      console.log(`✅ All agents already in queue for ${city?.name}`);
      return new Response(
        JSON.stringify({ 
          message: 'All agents already in queue',
          city: city?.name,
          total: agents.length,
          queued: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert agents into the queue
    const queueItems = agentsToQueue.map(agent => ({
      professional_id: agent.id,
      reason: 're_enrichment',
      status: 'pending'
    }));

    const { error: insertError } = await supabase
      .from('contact_enrichment_queue')
      .insert(queueItems);

    if (insertError) {
      throw new Error(`Failed to queue agents: ${insertError.message}`);
    }

    console.log(`✅ Queued ${agentsToQueue.length} agents for re-enrichment in ${city?.name}`);

    return new Response(
      JSON.stringify({
        message: 'Agents queued successfully',
        city: city?.name,
        total: agents.length,
        queued: agentsToQueue.length,
        skipped: existingIds.size,
        agents: agentsToQueue.map(a => ({ id: a.id, name: a.name }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Queue city error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
