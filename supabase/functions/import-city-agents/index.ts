import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_AGENTS_REQUIRED = 10;
const MIN_REVIEWS = 10; // Lowered from 200 to match Outscraper filter
const MIN_RATING = 4.9; // Lowered from 5.0 to match Outscraper filter

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

    // Need fresh data - run Outscraper Google Maps scraper
    console.log(`Starting Outscraper import (max ${maxResults} agents)...`);

    const outscraperResult = await supabase.functions.invoke('fetch-outscraper-agents', {
      body: { cityId, categoryId, maxResults }
    });

    if (outscraperResult.error) {
      console.error('Outscraper error:', outscraperResult.error);
      // Surface a non-fatal response to the frontend instead of a 500
      return new Response(
        JSON.stringify({
          success: false,
          cached: false,
          imported: 0,
          skipped: 0,
          error: 'Outscraper import failed; please try again later.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const outscraperData = outscraperResult.data;
    console.log(`Outscraper completed: ${outscraperData?.imported || 0} agents imported`);

    // Background filtering to deactivate non-qualifying agents
    const backgroundFiltering = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('Filtering agents by rating and reviews...');

        // Filter and keep only qualifying agents
        const { data: allAgents } = await supabase
          .from('professionals')
          .select('id, name, review_stars_rating, num_total_reviews')
          .eq('city_id', cityId)
          .eq('category_id', categoryId);

        if (allAgents) {
          const qualifyingAgents = allAgents.filter(a => 
            a.review_stars_rating && a.review_stars_rating >= MIN_RATING &&
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
        }
      } catch (bgError) {
        console.error('Background enrichment failed:', bgError);
      }
    };

    // @ts-ignore - EdgeRuntime is provided by the Edge environment
    EdgeRuntime.waitUntil(backgroundFiltering());

    return new Response(
      JSON.stringify({
        success: true,
        agentsImported: outscraperData?.imported || 0,
        agentsSkipped: outscraperData?.skipped || 0,
        message: `Imported ${outscraperData?.imported || 0} agents with Outscraper (${outscraperData?.skipped || 0} skipped). Filtering for ${MIN_RATING}★ ratings and ${MIN_REVIEWS}+ reviews.`
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
