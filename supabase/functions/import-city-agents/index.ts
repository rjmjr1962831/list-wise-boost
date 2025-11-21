import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_AGENTS_REQUIRED = 50; // Target 50 agents per city
const MIN_REVIEWS = 200; // Require 200+ reviews
const MIN_RATING = 4.9; // Require 4.9+ rating

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cityId, categoryId, maxResults = 50, forceRefresh = false } = await req.json();

    if (!cityId || !categoryId) {
      throw new Error('cityId and categoryId are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get city and category info
    const { data: city } = await supabase
      .from('cities')
      .select('name, state')
      .eq('id', cityId)
      .single();

    const { data: category } = await supabase
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    console.log(`Import request for ${city?.name}, ${city?.state} - ${category?.name}`);

    // Check if we have sufficient cached data (unless force refresh)
    if (!forceRefresh) {
      const { data: existingAgents, count } = await supabase
        .from('professionals')
        .select('*', { count: 'exact' })
        .eq('city_id', cityId)
        .eq('category_id', categoryId)
        .eq('active', true)
        .gte('review_stars_rating', MIN_RATING)
        .gte('num_total_reviews', MIN_REVIEWS)
        .not('zillow_data_fetched_at', 'is', null);

      console.log(`Found ${count || 0} qualifying agents in database`);

      // Check if we have enough agents and if they're fresh
      if (count && count >= MIN_AGENTS_REQUIRED && existingAgents && existingAgents.length > 0) {
        // Find the oldest fetch date
        const oldestFetchDate = existingAgents
          .map(a => a.zillow_data_fetched_at ? new Date(a.zillow_data_fetched_at).getTime() : 0)
          .reduce((min, date) => date < min ? date : min, Date.now());

        const ageInMs = Date.now() - oldestFetchDate;
        
        if (ageInMs < THIRTY_DAYS_MS) {
          console.log(`Using cached data (${Math.floor(ageInMs / (24 * 60 * 60 * 1000))} days old)`);
          return new Response(
            JSON.stringify({
              success: true,
              cached: true,
              count: count,
              message: `Using ${count} cached agents (last updated ${Math.floor(ageInMs / (24 * 60 * 60 * 1000))} days ago)`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log(`Data is stale (${Math.floor(ageInMs / (24 * 60 * 60 * 1000))} days old), refreshing...`);
        }
      } else {
        console.log(`Insufficient qualifying agents (need ${MIN_AGENTS_REQUIRED}, have ${count || 0})`);
      }
    } else {
      console.log('Force refresh requested, skipping cache check');
    }

    // Loop until we have enough qualifying agents
    let totalImported = 0;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // Check how many qualifying agents we currently have
      const { count: currentCount } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .eq('city_id', cityId)
        .eq('category_id', categoryId)
        .eq('active', true)
        .gte('review_stars_rating', MIN_RATING)
        .gte('num_total_reviews', MIN_REVIEWS);

      console.log(`Attempt ${attempts}: Currently have ${currentCount || 0}/${MIN_AGENTS_REQUIRED} qualifying agents`);

      if (currentCount && currentCount >= MIN_AGENTS_REQUIRED) {
        console.log(`Target reached! Have ${currentCount} qualifying agents.`);
        break;
      }

      // Run getdataforme agenscrape to get more agents
      console.log(`Running agenscrape import (batch ${attempts}, max ${maxResults} agents)...`);

      const agenscrapeResult = await supabase.functions.invoke('fetch-agenscrape-agents', {
        body: { 
          cityId, 
          categoryId, 
          maxResults: maxResults * attempts // Increase batch size with each attempt
        }
      });

      if (agenscrapeResult.error) {
        console.error('Agenscrape error:', agenscrapeResult.error);
        if (attempts === 1) {
          // Only fail on first attempt
          return new Response(
            JSON.stringify({
              success: false,
              cached: false,
              imported: 0,
              error: 'Agenscrape import failed; please try again later.'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // On later attempts, just log and continue
        console.log('Continuing with agents imported so far...');
        break;
      }

      const agenscrapeData = agenscrapeResult.data;
      totalImported += agenscrapeData?.imported || 0;
      console.log(`Batch ${attempts} completed: ${agenscrapeData?.imported || 0} agents imported (${totalImported} total)`);
      
      // Small delay before next batch
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log(`Import phase complete: ${totalImported} total agents imported across ${attempts} batches`);

    // Background enrichment: filter + memo23 enrichment for Zillow data
    const backgroundEnrichment = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`Filtering agents for ${MIN_RATING} stars and ${MIN_REVIEWS}+ reviews...`);

        // Filter and keep only qualifying agents
        const { data: allAgents } = await supabase
          .from('professionals')
          .select('id, name, zillow_profile_url, review_stars_rating, num_total_reviews')
          .eq('city_id', cityId)
          .eq('category_id', categoryId);

        if (allAgents) {
          const qualifyingAgents = allAgents.filter(a => 
            a.review_stars_rating && a.review_stars_rating >= MIN_RATING && // 4.9 or higher
            a.num_total_reviews && a.num_total_reviews >= MIN_REVIEWS
          );

          const nonQualifyingAgents = allAgents.filter(a => 
            !a.review_stars_rating || a.review_stars_rating < MIN_RATING ||
            !a.num_total_reviews || a.num_total_reviews < MIN_REVIEWS
          );

          console.log(`Qualifying agents: ${qualifyingAgents.length}, Non-qualifying: ${nonQualifyingAgents.length}`);

          // Deactivate non-qualifying agents
          if (nonQualifyingAgents.length > 0) {
            const { error: deactivateError } = await supabase
              .from('professionals')
              .update({ active: false })
              .in('id', nonQualifyingAgents.map(a => a.id));

            if (deactivateError) {
              console.error('Error deactivating non-qualifying agents:', deactivateError);
            } else {
              console.log(`Deactivated ${nonQualifyingAgents.length} non-qualifying agents`);
            }
          }

          // Enrich qualifying agents - check for existing data first
          console.log(`Starting enrichment for ${qualifyingAgents.length} agents...`);
          
          let reusedCount = 0;
          let enrichedCount = 0;
          
          for (const agent of qualifyingAgents) {
            if (agent.zillow_profile_url) {
              try {
                // Check if this agent already exists in another city with enriched data
                const { data: existingAgent } = await supabase
                  .from('professionals')
                  .select('*')
                  .eq('zillow_profile_url', agent.zillow_profile_url)
                  .neq('id', agent.id) // Don't match self
                  .not('zillow_data_fetched_at', 'is', null)
                  .not('professional_information', 'is', null)
                  .limit(1)
                  .maybeSingle();

                if (existingAgent) {
                  console.log(`Reusing enriched data for ${agent.name} from existing record`);
                  
                  // Copy enriched fields from existing agent
                  const { error: updateError } = await supabase
                    .from('professionals')
                    .update({
                      professional_information: existingAgent.professional_information,
                      agent_sales_stats: existingAgent.agent_sales_stats,
                      agent_licenses: existingAgent.agent_licenses,
                      business_address: existingAgent.business_address,
                      phone_numbers: existingAgent.phone_numbers,
                      reviews_data: existingAgent.reviews_data,
                      ratings: existingAgent.ratings,
                      get_to_know_me: existingAgent.get_to_know_me,
                      sidebar_video_url: existingAgent.sidebar_video_url,
                      years_experience: existingAgent.years_experience,
                      email: existingAgent.email,
                      phone: existingAgent.phone,
                      website: existingAgent.website,
                      company: existingAgent.company,
                      title: existingAgent.title,
                      specialty: existingAgent.specialty,
                      image_url: existingAgent.image_url,
                      zillow_data_fetched_at: new Date().toISOString()
                    })
                    .eq('id', agent.id);

                  if (updateError) {
                    console.error(`Failed to copy data for ${agent.name}:`, updateError);
                  } else {
                    reusedCount++;
                  }
                } else {
                  // No existing data found, fetch from memo23
                  console.log(`Enriching ${agent.name} with memo23...`);
                  
                  const enrichResult = await supabase.functions.invoke('fetch-single-memo23-agent', {
                    body: { 
                      professionalId: agent.id,
                      profileUrl: agent.zillow_profile_url 
                    }
                  });
                  
                  if (enrichResult.error) {
                    console.error(`Memo23 enrichment failed for ${agent.name}:`, enrichResult.error);
                  } else {
                    console.log(`Successfully enriched ${agent.name}`);
                    enrichedCount++;
                  }
                  
                  // Small delay between requests to avoid rate limits
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } catch (enrichError) {
                console.error(`Failed to process ${agent.name}:`, enrichError);
              }
            }
          }
          
          console.log(`Enrichment completed: ${reusedCount} reused, ${enrichedCount} newly enriched`);
        }
      } catch (bgError) {
        console.error('Background enrichment failed:', bgError);
      }
    };

    // @ts-ignore - EdgeRuntime is provided by the Edge environment
    EdgeRuntime.waitUntil(backgroundEnrichment());

    return new Response(
      JSON.stringify({
        success: true,
        agenscrapeImported: totalImported,
        attempts: attempts,
        message: `Imported ${totalImported} agents with agenscrape across ${attempts} batches. Filtering for ${MIN_RATING}★ ratings and ${MIN_REVIEWS}+ reviews. Enriching with memo23 in background (reusing existing enriched data where possible).`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in import-city-agents:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
