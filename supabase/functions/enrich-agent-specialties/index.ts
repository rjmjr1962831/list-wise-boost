import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zipCode, professionalId } = await req.json();
    
    if (!zipCode && !professionalId) {
      throw new Error('Either zipCode or professionalId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Get proxy credentials
    const proxyEndpoint = Deno.env.get('ROTATING_PROXY_ENDPOINT');
    const proxyUsername = Deno.env.get('ROTATING_PROXY_USERNAME');
    const proxyPassword = Deno.env.get('ROTATING_PROXY_PASSWORD');

    let searchKeyword = zipCode;
    let targetProfessional = null;

    // If professionalId is provided, get the agent's zip code
    if (professionalId) {
      const { data: prof } = await supabase
        .from('professionals')
        .select('zip_code, name, zillow_profile_url')
        .eq('id', professionalId)
        .single();

      if (!prof) {
        throw new Error('Professional not found');
      }

      targetProfessional = prof;
      searchKeyword = prof.zip_code || zipCode;

      if (!searchKeyword) {
        throw new Error('No zip code available for this professional');
      }
    }

    console.log(`Starting rigelbytes specialty scrape for zip: ${searchKeyword}`);

    // Configure rigelbytes actor with specialty filters enabled
    const actorId = 'rigelbytes~zillow-agents';
    const actorInput: any = {
      search_keywords: [searchKeyword],
      detailed_profiles: true,
      proxyConfiguration: proxyEndpoint && proxyUsername && proxyPassword ? {
        useApifyProxy: false,
        proxyUrls: [`http://${proxyUsername}:${proxyPassword}@${proxyEndpoint}`]
      } : {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      },
      // Enable specialty detection - these are the boolean flags from rigelbytes
      buying: true,
      selling: true,
      relocation: true,
      first_time_home_buyers: true,
      foreclosure: true,
      investment_properties: true,
      luxury_homes: true,
      lot_land: true,
      military_veterans: true,
      new_construction: true,
      property_management: true,
      rentals: true,
      senior_communities: true,
      vacation_short_term_rentals: true,
      // Language specialties
      spanish: true,
      french: true,
      german: true,
      italian: true,
      portuguese: true,
      russian: true,
      chinese: true,
      japanese: true,
      korean: true,
      vietnamese: true,
      arabic: true,
      hindi: true,
      bengali: true,
      farsi: true,
      hebrew: true,
      greek: true,
      polish: true,
      tagalog: true,
      thai: true,
      turkish: true,
      hungarian: true,
      cantonese: true,
      mandarin: true,
    };

    console.log('Starting rigelbytes actor with specialty detection enabled');

    // Start the actor
    const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start rigelbytes actor:', errorText);
      throw new Error(`Failed to start rigelbytes actor: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Rigelbytes actor started with run ID: ${runId}`);

    // Poll for completion
    let runStatus = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 180; // 15 minutes max

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      
      attempts++;
      if (attempts % 12 === 0) {
        console.log(`Still running after ${attempts * 5} seconds...`);
      }
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Actor ended with status: ${runStatus}`);
    }

    // Get the dataset
    const datasetId = runData.data.defaultDatasetId;
    const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`);
    const agents = await datasetResponse.json();

    console.log(`Rigelbytes returned ${agents.length} agents with specialty data`);

    let enrichedCount = 0;
    const enrichmentResults = [];

    for (const agent of agents) {
      try {
        // Match agent by profile URL or name
        const profileUrl = agent.link;
        
        let query = supabase
          .from('professionals')
          .select('id, name, specialty, zillow_profile_url');

        if (targetProfessional) {
          query = query.eq('id', professionalId);
        } else if (profileUrl) {
          query = query.eq('zillow_profile_url', profileUrl);
        } else {
          continue; // Skip if we can't match
        }

        const { data: existing } = await query.maybeSingle();

        if (!existing) {
          continue;
        }

        // Extract specialties from agent data
        const specialties = new Set<string>(existing.specialty || []);
        
        // Map rigelbytes fields to specialty names
        const specialtyMap: Record<string, string> = {
          buying: 'Buyer\'s Agent',
          selling: 'Listing Agent',
          relocation: 'Relocation',
          first_time_home_buyers: 'First-Time Buyers',
          foreclosure: 'Foreclosure',
          investment_properties: 'Investment Properties',
          luxury_homes: 'Luxury Homes',
          lot_land: 'Lot/Land',
          military_veterans: 'Military/Veterans',
          new_construction: 'New Construction',
          property_management: 'Property Management',
          rentals: 'Rentals',
          senior_communities: 'Senior Housing',
          vacation_short_term_rentals: 'Vacation Rentals',
        };

        // Add detected specialties
        for (const [field, label] of Object.entries(specialtyMap)) {
          if (agent[field] === true) {
            specialties.add(label);
          }
        }

        // Add language specialties
        const languageFields = [
          'spanish', 'french', 'german', 'italian', 'portuguese', 'russian',
          'chinese', 'japanese', 'korean', 'vietnamese', 'arabic', 'hindi',
          'bengali', 'farsi', 'hebrew', 'greek', 'polish', 'tagalog', 'thai',
          'turkish', 'hungarian', 'cantonese', 'mandarin'
        ];

        for (const lang of languageFields) {
          if (agent[lang] === true) {
            const langLabel = lang.charAt(0).toUpperCase() + lang.slice(1);
            specialties.add(langLabel);
          }
        }

        // Update if we found new specialties
        if (specialties.size > (existing.specialty?.length || 0)) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({
              specialty: Array.from(specialties),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Failed to update ${existing.name}:`, updateError);
          } else {
            enrichedCount++;
            enrichmentResults.push({
              name: existing.name,
              addedSpecialties: Array.from(specialties).filter(s => !existing.specialty?.includes(s)),
              totalSpecialties: specialties.size,
            });
            console.log(`✅ Updated ${existing.name} with ${specialties.size} specialties`);
          }
        }
      } catch (error) {
        console.error('Error processing agent:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        enrichedCount,
        totalProcessed: agents.length,
        results: enrichmentResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enrich-agent-specialties:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
