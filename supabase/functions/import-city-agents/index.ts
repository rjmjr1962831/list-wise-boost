import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_REVIEWS = 50; // Require 50+ reviews
const MIN_RATING = 4.5; // Require 4.5+ rating

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      cityId, 
      categoryId, 
      maxResults = 100, 
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
      
      // Call unified scraper in dry run mode to get actual count
      const { data: dryRunData, error: dryRunError } = await supabase.functions.invoke('import-agents-unified', {
        body: { 
          cityId, 
          categoryId, 
          maxAgents: maxResults,
          minRating: MIN_RATING,
          minReviews: MIN_REVIEWS,
          dryRun: true
        }
      });

      if (dryRunError) {
        console.error('Dry run error:', dryRunError);
      }

      const agentUrlsFound = dryRunData?.agentUrlsFound || maxResults;
      const estimatedImport = Math.min(agentUrlsFound, maxQualifiedAgents);
      const estimatedCredits = dryRunData?.estimatedFirecrawlCredits || estimatedImport + 1;
      
      console.log(`📊 DRY RUN RESULTS:
        - Agent URLs found: ${agentUrlsFound}
        - Would import: ~${estimatedImport} agents
        - Estimated Firecrawl credits: ${estimatedCredits}
        - Using unified Firecrawl scraper (no Apify costs)`);
      
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          cached: false,
          agentUrlsFound,
          wouldImport: estimatedImport,
          firecrawlCredits: estimatedCredits,
          apifyCosts: 0,
          message: `DRY RUN: Found ${agentUrlsFound} agent URLs. Would import ~${estimatedImport} agents using ${estimatedCredits} Firecrawl credits.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine target based on mode
    const targetAgents = maxQualifiedAgents;
    console.log(`Target: ${targetAgents} qualified agents`);

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

    // Check how many agents we currently have linked to this city
    const { count: currentCount } = await supabase
      .from('professional_cities')
      .select('*', { count: 'exact', head: true })
      .eq('city_id', cityId)
      .eq('active', true);

    console.log(`Currently have ${currentCount || 0}/${targetAgents} agents linked`);

    if (currentCount && currentCount >= targetAgents && !forceRefresh) {
      console.log(`✅ Target already met! City has ${currentCount} agents linked (target: ${targetAgents})`);
      
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

    // Run unified Firecrawl import (replaces agenscrape + memo23)
    console.log(`Running unified Firecrawl import (max ${maxResults} agents)...`);

    const { data: importData, error: importError } = await supabase.functions.invoke('import-agents-unified', {
      body: { 
        cityId, 
        categoryId, 
        maxAgents: maxResults,
        minRating: MIN_RATING,
        minReviews: MIN_REVIEWS,
        triggerEnrichment: fullEnrichment
      }
    });

    if (importError) {
      console.error('Unified import error:', importError);
      return new Response(
        JSON.stringify({
          success: false,
          cached: false,
          imported: 0,
          error: 'Firecrawl import failed; please try again later.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = importData?.results || { imported: 0, updated: 0, skipped: 0, failed: 0 };
    const totalImported = results.imported + results.updated;
    
    console.log(`Import complete: ${results.imported} new, ${results.updated} updated, ${results.skipped} skipped, ${results.failed} failed`);
    console.log(`Firecrawl credits used: ${importData?.firecrawlCreditsUsed || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        imported: results.imported,
        updated: results.updated,
        skipped: results.skipped,
        failed: results.failed,
        firecrawlCreditsUsed: importData?.firecrawlCreditsUsed || 0,
        message: `Successfully imported ${results.imported} new agents and updated ${results.updated} existing agents for ${city?.name}. Used ${importData?.firecrawlCreditsUsed || 0} Firecrawl credits.`
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
