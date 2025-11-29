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
      maxResults = 200, 
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

    // Queue all unenriched agents for background enrichment
    console.log('Queuing agents for enrichment...');
    
    const { data: agentsToEnrich } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .eq('active', true)
      .gte('review_stars_rating', MIN_RATING)
      .is('zillow_data_fetched_at', null);

    if (agentsToEnrich && agentsToEnrich.length > 0) {
      console.log(`Queuing ${agentsToEnrich.length} agents for enrichment...`);
      
      // Insert into enrichment queue
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
        console.log(`✅ Queued ${agentsToEnrich.length} agents for enrichment`);
        
        // Fire-and-forget: trigger queue processor with concurrency 10
        supabase.functions.invoke('process-contact-enrichment-queue', {
          body: { batchSize: 100, concurrency: 10 }
        }).catch(err => console.log('Queue processor triggered'));
      }
    } else {
      console.log('No agents need enrichment');
    }

    // Return immediately with import summary
    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        imported: totalImported,
        queued: agentsToEnrich?.length || 0,
        message: `Successfully imported ${totalImported} agents. ${agentsToEnrich?.length || 0} agents queued for automatic enrichment with memo23, Perplexity press research, and profile synthesis.`
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
