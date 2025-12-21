import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_REVIEWS = 50; // Require 50+ reviews
const MIN_RATING = 4.8; // Require 4.8+ rating

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      cityId, 
      categoryId, 
      maxResults = 200, 
      forceRefresh = false,
      fullEnrichment = false,
      maxQualifiedAgents = 999,
      // Cost control options
      dryRun = false,
      skipRecentlyEnriched = true,
      skipGenericBios = true,
      skipIfNoPress = true
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
    
    // DRY RUN MODE: Return estimates without doing any actual work
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - Estimating what would happen...');
      
      // Estimate how many agents would be imported
      const estimatedImport = Math.min(maxResults, maxQualifiedAgents);
      
      // Calculate estimated credits using new formula
      const baseCreditsPerAgent = 2; // 1 for bio + 1 for synthesis
      let creditsPerAgent = baseCreditsPerAgent;
      
      if (skipGenericBios) creditsPerAgent -= 0.5;
      if (skipIfNoPress) creditsPerAgent -= 0.5;
      if (skipRecentlyEnriched) creditsPerAgent *= 0.5;
      
      const estimatedCredits = Math.max(0.1, creditsPerAgent);
      const totalCredits = (estimatedCredits * estimatedImport).toFixed(1);
      const savingsPercent = ((1 - creditsPerAgent / baseCreditsPerAgent) * 100).toFixed(0);
      
      console.log(`📊 DRY RUN RESULTS:
        - Would import: ~${estimatedImport} agents
        - Would queue: ~${estimatedImport} for enrichment
        - Estimated credits: ${estimatedCredits} per agent (${savingsPercent}% savings)
        - Total credits: ~${totalCredits}
        - Cost controls: skipRecent=${skipRecentlyEnriched}, skipGeneric=${skipGenericBios}, skipNoPress=${skipIfNoPress}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          cached: false,
          wouldImport: estimatedImport,
          wouldQueue: estimatedImport,
          creditsPerAgent: parseFloat(estimatedCredits.toFixed(1)),
          totalCredits: parseFloat(totalCredits),
          savingsPercent: parseInt(savingsPercent),
          message: `DRY RUN: Would import ~${estimatedImport} agents and queue for enrichment. Est. ${totalCredits} credits (${savingsPercent}% savings with cost controls).`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine target based on mode
    const targetAgents = maxQualifiedAgents; // Always get all agents
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

    // Loop until we have enough imported agents (enrichment happens during loop)
    let totalImported = 0;
    let totalQueued = 0;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // Check how many agents we currently have linked to this city
      const { count: currentCount } = await supabase
        .from('professional_cities')
        .select('*', { count: 'exact', head: true })
        .eq('city_id', cityId)
        .eq('active', true);

      console.log(`Attempt ${attempts}: Currently have ${currentCount || 0}/${targetAgents} agents imported`);

      if (currentCount && currentCount >= targetAgents) {
        console.log(`✅ Target already met! City has ${currentCount} agents linked (target: ${targetAgents})`);
        
        // Return immediately with "already met" flag
        return new Response(
          JSON.stringify({
            success: true,
            alreadyMet: true,
            count: currentCount,
            message: `${city?.name} already has ${currentCount} qualified agents linked (target: ${targetAgents}). No import needed.`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      const batchImported = agenscrapeData?.imported || 0;
      totalImported += batchImported;
      console.log(`Batch ${attempts} completed: ${batchImported} agents imported (${totalImported} total)`);
      
      // IMMEDIATELY queue newly imported agents for enrichment (via professional_cities junction)
      console.log('Queuing newly imported agents for enrichment...');
      
      const { data: agentsToEnrich } = await supabase
        .from('professionals')
        .select('id, name')
        .in('id', (
          await supabase
            .from('professional_cities')
            .select('professional_id')
            .eq('city_id', cityId)
            .eq('active', true)
        ).data?.map(pc => pc.professional_id) || [])
        .eq('category_id', categoryId)
        .eq('active', true)
        .is('zillow_data_fetched_at', null);

      if (agentsToEnrich && agentsToEnrich.length > 0) {
        console.log(`Queuing ${agentsToEnrich.length} unenriched agents...`);
        
        // Insert into enrichment queue with unique constraint
        const queueItems = agentsToEnrich.map(agent => ({
          professional_id: agent.id,
          status: 'pending',
          reason: 'auto-import'
        }));
        
        const { error: queueError } = await supabase
          .from('contact_enrichment_queue')
          .upsert(queueItems, { onConflict: 'professional_id' });

        if (queueError) {
          console.error('Error queuing agents:', queueError);
        } else {
          totalQueued += agentsToEnrich.length;
          console.log(`✅ Queued ${agentsToEnrich.length} agents for enrichment (${totalQueued} total queued)`);
          
          // Fire-and-forget: trigger queue processor with Firecrawl enrichment
          supabase.functions.invoke('process-contact-enrichment-queue', {
            body: { 
              batchSize: 100, 
              concurrency: 10,
              useFirecrawl: true, // Use Firecrawl instead of memo23
              dryRun,
              skipRecentlyEnriched,
              skipGenericBios,
              skipIfNoPress
            }
          }).catch(err => console.log('Queue processor triggered'));
        }
      } else {
        console.log('No new agents need enrichment in this batch');
      }
      
      // Small delay before next batch
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log(`Import phase complete: ${totalImported} total agents imported, ${totalQueued} queued for enrichment`);

    // Return immediately with import summary
    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        imported: totalImported,
        queued: totalQueued,
        message: `Successfully imported ${totalImported} agents. ${totalQueued} agents queued for automatic enrichment with Firecrawl, Perplexity press research, and profile synthesis.`
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
