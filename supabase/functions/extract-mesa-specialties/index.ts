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

    console.log('Starting specialty extraction for Mesa agents...');

    // Get Mesa city
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', 'mesa')
      .eq('state', 'Arizona')
      .single();

    if (cityError || !city) {
      throw new Error('Mesa city not found');
    }

    // Get all Mesa agents with professional_information
    const { data: agents, error: agentsError } = await supabase
      .from('professionals')
      .select('id, name, professional_information, specialty')
      .eq('city_id', city.id)
      .eq('active', true)
      .not('professional_information', 'is', null);

    if (agentsError) {
      throw new Error(`Error fetching agents: ${agentsError.message}`);
    }

    console.log(`Found ${agents?.length || 0} Mesa agents to process`);

    let updated = 0;
    let skipped = 0;

    for (const agent of agents || []) {
      try {
        const profInfo = agent.professional_information as any;
        
        // Extract specialties from various possible locations in professional_information
        let extractedSpecialties: string[] = [];

        // Check if it's an array (memo23 format)
        if (Array.isArray(profInfo)) {
          for (const info of profInfo) {
            if (info.agentSpecialties && Array.isArray(info.agentSpecialties)) {
              extractedSpecialties = [...extractedSpecialties, ...info.agentSpecialties];
            }
            if (info.specialties && Array.isArray(info.specialties)) {
              extractedSpecialties = [...extractedSpecialties, ...info.specialties];
            }
          }
        } 
        // Check if it's an object
        else if (profInfo && typeof profInfo === 'object') {
          if (profInfo.agentSpecialties && Array.isArray(profInfo.agentSpecialties)) {
            extractedSpecialties = [...extractedSpecialties, ...profInfo.agentSpecialties];
          }
          if (profInfo.specialties && Array.isArray(profInfo.specialties)) {
            extractedSpecialties = [...extractedSpecialties, ...profInfo.specialties];
          }
        }

        // Remove duplicates and clean up
        extractedSpecialties = [...new Set(extractedSpecialties)]
          .filter(s => s && typeof s === 'string' && s.trim().length > 0)
          .map(s => s.trim());

        // Only update if we found specialties and they're different from current
        if (extractedSpecialties.length > 0) {
          const currentSpecialties = agent.specialty || [];
          const isDifferent = JSON.stringify(extractedSpecialties.sort()) !== JSON.stringify(currentSpecialties.sort());

          if (isDifferent) {
            const { error: updateError } = await supabase
              .from('professionals')
              .update({ specialty: extractedSpecialties })
              .eq('id', agent.id);

            if (updateError) {
              console.error(`Error updating ${agent.name}:`, updateError);
            } else {
              console.log(`✅ Updated ${agent.name}: ${extractedSpecialties.join(', ')}`);
              updated++;
            }
          } else {
            console.log(`⏭️ Skipped ${agent.name}: specialties already up to date`);
            skipped++;
          }
        } else {
          console.log(`⚠️ No specialties found for ${agent.name}`);
          skipped++;
        }
      } catch (error) {
        console.error(`Error processing ${agent.name}:`, error);
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Specialty extraction complete for Mesa`,
        stats: {
          total: agents?.length || 0,
          updated,
          skipped
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in extract-mesa-specialties:', error);
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
