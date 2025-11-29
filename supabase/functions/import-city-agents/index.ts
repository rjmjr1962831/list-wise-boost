import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_REVIEWS = 100; // Require 100+ reviews
const MIN_RATING = 4.8; // Require 4.8+ rating

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      cityId, 
      categoryId, 
      maxResults = 50, 
      forceRefresh = false,
      fullEnrichment = false,  // NEW: enables full pipeline with press + synthesis
      maxQualifiedAgents = 999  // NEW: target number of qualified agents (effectively unlimited)
    } = await req.json();

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

    // Determine target based on mode
    const targetAgents = fullEnrichment ? maxQualifiedAgents : 50;
    console.log(`Target: ${targetAgents} qualified agents (fullEnrichment: ${fullEnrichment})`);

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
      if (count && count >= targetAgents && existingAgents && existingAgents.length > 0) {
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
        console.log(`Insufficient qualifying agents (need ${targetAgents}, have ${count || 0})`);
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

      console.log(`Attempt ${attempts}: Currently have ${currentCount || 0}/${targetAgents} qualifying agents`);

      if (currentCount && currentCount >= targetAgents) {
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

        console.log(`Filtering agents for ${MIN_RATING} stars (will check reviews AFTER enrichment)...`);

        // Filter agents - ONLY by rating at this stage
        // We'll check review count AFTER memo23 enrichment provides the real data
        const { data: allAgents } = await supabase
          .from('professionals')
          .select('id, name, zillow_profile_url, review_stars_rating, num_total_reviews, zillow_data_fetched_at, professional_information')
          .eq('city_id', cityId)
          .eq('category_id', categoryId);

        if (allAgents) {
          // Step 1: Filter by rating only - agenscrape doesn't have review counts yet
          const goodRatingAgents = allAgents.filter(a => 
            a.review_stars_rating && a.review_stars_rating >= MIN_RATING // 4.9 or higher
          );

          // Deactivate agents with low ratings immediately (no need to enrich these)
          const lowRatingAgents = allAgents.filter(a => 
            !a.review_stars_rating || a.review_stars_rating < MIN_RATING
          );

          console.log(`Rating filter: ${goodRatingAgents.length} agents with ${MIN_RATING}+ stars, ${lowRatingAgents.length} with lower ratings`);

          if (lowRatingAgents.length > 0) {
            const { error: deactivateError } = await supabase
              .from('professionals')
              .update({ active: false })
              .in('id', lowRatingAgents.map(a => a.id));

            if (deactivateError) {
              console.error('Error deactivating low-rating agents:', deactivateError);
            } else {
              console.log(`Deactivated ${lowRatingAgents.length} low-rating agents`);
            }
          }

          // Enrich all good-rating agents - we'll filter by reviews AFTER enrichment
          console.log(`Starting enrichment for ${goodRatingAgents.length} agents with good ratings...`);
          
          let reusedCount = 0;
          let enrichedCount = 0;
          let error403Count = 0;
          let totalEnrichAttempts = 0;
          
          for (const agent of goodRatingAgents) {
            if (agent.zillow_profile_url) {
              try {
                // With junction table, agents should already be unique globally
                // No need to check for duplicates - fetch-agenscrape-agents handles that
                // Just enrich agents that need it
                if (!agent.zillow_data_fetched_at || !agent.professional_information) {
                  totalEnrichAttempts++;
                  console.log(`📋 [${enrichedCount + 1}/${goodRatingAgents.length}] Enriching ${agent.name} with memo23...`);
                  console.log(`   Profile URL: ${agent.zillow_profile_url}`);
                  
                  const enrichStartTime = Date.now();
                  const enrichResult = await supabase.functions.invoke('fetch-single-memo23-agent', {
                    body: { 
                      professionalId: agent.id,
                      profileUrl: agent.zillow_profile_url 
                    }
                  });
                  const enrichDuration = ((Date.now() - enrichStartTime) / 1000).toFixed(1);
                  
                  if (enrichResult.error) {
                    console.error(`❌ Memo23 enrichment failed for ${agent.name} (${enrichDuration}s):`, enrichResult.error);
                    
                    // Check for specific error types
                    const errorMsg = enrichResult.error.message || JSON.stringify(enrichResult.error);
                    if (errorMsg.includes('403')) {
                      error403Count++;
                      console.error(`🚫 403 ERROR detected for ${agent.name} - possible proxy block`);
                      
                      // Check if we've exceeded 50% 403 error rate
                      const error403Rate = (error403Count / totalEnrichAttempts) * 100;
                      console.error(`⚠️ 403 Error Rate: ${error403Rate.toFixed(1)}% (${error403Count}/${totalEnrichAttempts})`);
                      
                      if (totalEnrichAttempts >= 10 && error403Rate > 50) {
                        // Stop the enrichment and alert admin
                        const diagnostics = {
                          timestamp: new Date().toISOString(),
                          city: city?.name,
                          state: city?.state,
                          totalAttempts: totalEnrichAttempts,
                          error403Count: error403Count,
                          error403Rate: error403Rate.toFixed(1) + '%',
                          enrichedCount: enrichedCount,
                          reusedCount: reusedCount,
                          remainingAgents: goodRatingAgents.length - (enrichedCount + reusedCount),
                          lastFailedAgent: agent.name
                        };
                        
                        console.error('🛑 STOPPING ENRICHMENT - 403 error rate exceeded 50%');
                        console.error('Diagnostics:', JSON.stringify(diagnostics, null, 2));
                        
                        // Store alert in marketing_content table
                        await supabase.from('marketing_content').insert({
                          page: 'admin',
                          section: 'enrichment_alert',
                          key: `alert_${Date.now()}`,
                          type: 'error',
                          value: JSON.stringify(diagnostics)
                        });
                        
                        // Exit the enrichment loop
                        throw new Error(`Enrichment stopped: ${error403Rate.toFixed(1)}% 403 error rate (${error403Count}/${totalEnrichAttempts}). ${JSON.stringify(diagnostics)}`);
                      }
                    } else if (errorMsg.includes('429')) {
                      console.error(`⏱️ 429 RATE LIMIT for ${agent.name} - slowing down...`);
                      // Add extra delay on rate limit
                      await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                  } else {
                    const data = enrichResult.data || {};
                    console.log(`✅ Successfully enriched ${agent.name} (${enrichDuration}s)`);
                    if (data.http403Count > 0 || data.http429Count > 0) {
                      console.warn(`   ⚠️ Encountered ${data.http403Count || 0} 403s, ${data.http429Count || 0} 429s during enrichment`);
                    }
                    enrichedCount++;
                    
                    // Fetch and cache reviews immediately after enrichment
                    try {
                      console.log(`📝 Fetching reviews for ${agent.name}...`);
                      const reviewsResult = await supabase.functions.invoke('fetch-external-reviews', {
                        body: {
                          agentName: agent.name,
                          company: data.company || '',
                          location: `${city?.name}, ${city?.state}`,
                          professionalId: agent.id
                        }
                      });
                      
                      if (reviewsResult.error) {
                        console.warn(`⚠️ Failed to fetch reviews for ${agent.name}:`, reviewsResult.error);
                      } else {
                        const reviewData = reviewsResult.data || {};
                        console.log(`✅ Cached ${reviewData.reviews?.length || 0} reviews from ${reviewData.sources?.join(', ') || 'unknown sources'}`);
                      }
                    } catch (reviewError) {
                      console.warn(`⚠️ Error fetching reviews for ${agent.name}:`, reviewError);
                    }
                  }
                  
                  // Progressive delay: increase wait time as we process more agents
                  const baseDelay = 2000;
                  const progressiveDelay = baseDelay + Math.floor(enrichedCount / 10) * 1000; // +1s per 10 agents
                  console.log(`⏱️ Waiting ${progressiveDelay / 1000}s before next agent...`);
                  await new Promise(resolve => setTimeout(resolve, progressiveDelay));
                }
              } catch (enrichError) {
                console.error(`Failed to process ${agent.name}:`, enrichError);
              }
            }
          }
          
          console.log(`Enrichment phase completed: ${reusedCount} reused, ${enrichedCount} newly enriched`);

          // Step 2: NOW filter by review count using the enriched data
          console.log(`Applying review count filter (${MIN_REVIEWS}+ reviews)...`);
          
          const { data: enrichedAgents } = await supabase
            .from('professionals')
            .select('id, name, num_total_reviews, zillow_data_fetched_at')
            .eq('city_id', cityId)
            .eq('category_id', categoryId)
            .gte('review_stars_rating', MIN_RATING)
            .not('zillow_data_fetched_at', 'is', null); // Only check enriched agents

          if (enrichedAgents) {
            const lowReviewAgents = enrichedAgents.filter(a => 
              !a.num_total_reviews || a.num_total_reviews < MIN_REVIEWS
            );

            console.log(`Review filter: ${lowReviewAgents.length} agents have <${MIN_REVIEWS} reviews and will be deactivated`);

            if (lowReviewAgents.length > 0) {
              const { error: deactivateError } = await supabase
                .from('professionals')
                .update({ active: false })
                .in('id', lowReviewAgents.map(a => a.id));

              if (deactivateError) {
                console.error('Error deactivating low-review agents:', deactivateError);
              } else {
                console.log(`✅ Deactivated ${lowReviewAgents.length} agents with <${MIN_REVIEWS} reviews`);
              }
            }

            const finalCount = enrichedAgents.length - lowReviewAgents.length;
            console.log(`🎉 Final result: ${finalCount} qualifying agents with ${MIN_RATING}+ stars and ${MIN_REVIEWS}+ reviews`);
          }

          // Phase 3: Press Research + Auto-Synthesis (only if fullEnrichment enabled)
          if (fullEnrichment) {
            console.log('🔍 Starting Phase 3: Press Research & Profile Synthesis...');
            
            // Get agents that need synthesis (no synthesized_bio yet, but are enriched and active)
            const { data: agentsNeedingSynthesis } = await supabase
              .from('professionals')
              .select('id, name, company, business_name')
              .eq('city_id', cityId)
              .eq('category_id', categoryId)
              .eq('active', true)
              .is('synthesized_bio', null)  // Only agents without synthesis
              .not('zillow_data_fetched_at', 'is', null)  // Must be enriched first
              .gte('review_stars_rating', MIN_RATING)
              .gte('num_total_reviews', MIN_REVIEWS);

            console.log(`Found ${agentsNeedingSynthesis?.length || 0} agents needing press research & synthesis`);

            if (agentsNeedingSynthesis && agentsNeedingSynthesis.length > 0) {
              for (const agent of agentsNeedingSynthesis) {
                try {
                  console.log(`📰 [${agentsNeedingSynthesis.indexOf(agent) + 1}/${agentsNeedingSynthesis.length}] Running press search for ${agent.name}...`);
                  
                  const pressResult = await supabase.functions.invoke('search-agent-press-claude', {
                    body: {
                      agentName: agent.name,
                      company: agent.company,
                      businessName: agent.business_name,
                      city: city?.name,
                      state: city?.state,
                      professionalId: agent.id  // Triggers auto-synthesis
                    }
                  });

                  if (pressResult.error) {
                    console.error(`❌ Press search failed for ${agent.name}:`, pressResult.error);
                  } else {
                    console.log(`✅ Press search completed for ${agent.name}`);
                  }
                  
                  // Rate limit: 5 seconds between Claude calls to avoid rate limits
                  await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (pressError) {
                  console.error(`Failed to process press search for ${agent.name}:`, pressError);
                }
              }
              
              console.log(`🎉 Phase 3 complete: Processed ${agentsNeedingSynthesis.length} agents for press & synthesis`);
            }
          }
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
        fullEnrichment: fullEnrichment,
        targetAgents: targetAgents,
        message: fullEnrichment 
          ? `Imported ${totalImported} agents. Target: ${targetAgents}. Running full enrichment (memo23 + press + synthesis) in background.`
          : `Imported ${totalImported} agents with agenscrape across ${attempts} batches. Filtering for ${MIN_RATING}★ ratings and ${MIN_REVIEWS}+ reviews. Enriching with memo23 in background (reusing existing enriched data where possible).`
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
