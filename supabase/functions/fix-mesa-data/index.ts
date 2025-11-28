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

    console.log('🚀 Starting Mesa data fixes...');

    const results = {
      specialties: { updated: 0, skipped: 0, errors: 0 },
      reviews: { queued: 0, skipped: 0, errors: 0 }
    };

    // Step 1: Extract and populate specialties
    console.log('\n📋 Step 1: Extracting specialties from professional_information...');
    
    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', 'mesa')
      .eq('state', 'Arizona')
      .single();

    if (!city) {
      throw new Error('Mesa city not found');
    }

    const { data: agents } = await supabase
      .from('professionals')
      .select('id, name, professional_information, specialty')
      .eq('city_id', city.id)
      .eq('active', true)
      .not('professional_information', 'is', null);

    console.log(`Found ${agents?.length || 0} agents to process`);

    for (const agent of agents || []) {
      try {
        const profInfo = agent.professional_information as any;
        let extractedSpecialties: string[] = [];

        if (Array.isArray(profInfo)) {
          for (const info of profInfo) {
            if (info.agentSpecialties && Array.isArray(info.agentSpecialties)) {
              extractedSpecialties = [...extractedSpecialties, ...info.agentSpecialties];
            }
            if (info.specialties && Array.isArray(info.specialties)) {
              extractedSpecialties = [...extractedSpecialties, ...info.specialties];
            }
          }
        } else if (profInfo && typeof profInfo === 'object') {
          if (profInfo.agentSpecialties && Array.isArray(profInfo.agentSpecialties)) {
            extractedSpecialties = [...extractedSpecialties, ...profInfo.agentSpecialties];
          }
          if (profInfo.specialties && Array.isArray(profInfo.specialties)) {
            extractedSpecialties = [...extractedSpecialties, ...profInfo.specialties];
          }
        }

        extractedSpecialties = [...new Set(extractedSpecialties)]
          .filter(s => s && typeof s === 'string' && s.trim().length > 0)
          .map(s => s.trim());

        if (extractedSpecialties.length > 0) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({ specialty: extractedSpecialties })
            .eq('id', agent.id);

          if (updateError) {
            console.error(`❌ ${agent.name}: ${updateError.message}`);
            results.specialties.errors++;
          } else {
            console.log(`✅ ${agent.name}: ${extractedSpecialties.join(', ')}`);
            results.specialties.updated++;
          }
        } else {
          results.specialties.skipped++;
        }
      } catch (error) {
        console.error(`Error processing ${agent.name}:`, error);
        results.specialties.errors++;
      }
    }

    // Step 2: Queue review refreshes
    console.log('\n🔄 Step 2: Queuing agents for review refresh...');
    
    const { data: topAgents } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('city_id', city.id)
      .eq('active', true)
      .gte('review_stars_rating', 4.8)
      .gte('num_total_reviews', 100)
      .not('professional_information', 'is', null)
      .order('rank')
      .limit(10);

    for (const agent of topAgents || []) {
      try {
        const { data: existing } = await supabase
          .from('contact_enrichment_queue')
          .select('id')
          .eq('professional_id', agent.id)
          .eq('status', 'pending')
          .single();

        if (!existing) {
          const { error: queueError } = await supabase
            .from('contact_enrichment_queue')
            .insert({
              professional_id: agent.id,
              reason: 'Mesa review refresh',
              status: 'pending'
            });

          if (queueError) {
            console.error(`❌ ${agent.name}: ${queueError.message}`);
            results.reviews.errors++;
          } else {
            console.log(`✅ Queued: ${agent.name}`);
            results.reviews.queued++;
          }
        } else {
          console.log(`⏭️ Already queued: ${agent.name}`);
          results.reviews.skipped++;
        }
      } catch (error) {
        console.error(`Error queuing ${agent.name}:`, error);
        results.reviews.errors++;
      }
    }

    console.log('\n✨ Mesa data fixes complete!');
    console.log(`Specialties: ${results.specialties.updated} updated, ${results.specialties.skipped} skipped, ${results.specialties.errors} errors`);
    console.log(`Reviews: ${results.reviews.queued} queued, ${results.reviews.skipped} skipped, ${results.reviews.errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Mesa data fixes completed',
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in fix-mesa-data:', error);
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
