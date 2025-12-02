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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting review refresh for Mesa agents...');

    // Get Mesa city
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id, name')
      .eq('slug', 'mesa')
      .eq('state', 'Arizona')
      .single();

    if (cityError || !city) {
      throw new Error('Mesa city not found');
    }

    // Get top 10 Mesa agents that need review updates
    const { data: agents, error: agentsError } = await supabase
      .from('professionals')
      .select('id, name, zillow_profile_url')
      .eq('city_id', city.id)
      .eq('active', true)
      .gte('review_stars_rating', 4.8)
      .gte('num_total_reviews', 50)
      .not('professional_information', 'is', null)
      .order('rank')
      .limit(10);

    if (agentsError) {
      throw new Error(`Error fetching agents: ${agentsError.message}`);
    }

    console.log(`Found ${agents?.length || 0} Mesa agents to refresh reviews`);

    let queued = 0;

    for (const agent of agents || []) {
      try {
        // Check if already in queue
        const { data: existing } = await supabase
          .from('contact_enrichment_queue')
          .select('id')
          .eq('professional_id', agent.id)
          .eq('status', 'pending')
          .single();

        if (!existing) {
          // Add to enrichment queue
          const { error: queueError } = await supabase
            .from('contact_enrichment_queue')
            .insert({
              professional_id: agent.id,
              reason: 'Mesa review refresh - updating has_recent_review flags',
              status: 'pending',
              attempts: 0,
              max_attempts: 3
            });

          if (queueError) {
            console.error(`Error queuing ${agent.name}:`, queueError);
          } else {
            console.log(`✅ Queued ${agent.name} for review refresh`);
            queued++;
          }
        } else {
          console.log(`⏭️ ${agent.name} already in queue`);
        }
      } catch (error) {
        console.error(`Error processing ${agent.name}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Review refresh queued for Mesa agents`,
        stats: {
          total: agents?.length || 0,
          queued
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in refresh-mesa-reviews:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
