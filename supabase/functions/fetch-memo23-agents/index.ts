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
    const { cityId, categoryId } = await req.json();

    if (!cityId || !categoryId) {
      throw new Error('cityId and categoryId are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get city info
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('*')
      .eq('id', cityId)
      .single();

    if (cityError || !city) {
      throw new Error(`City not found: ${cityError?.message}`);
    }

    // Get category info
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (categoryError || !category) {
      throw new Error(`Category not found: ${categoryError?.message}`);
    }

    console.log(`Fetching agents for ${city.name}, ${city.state} - ${category.name}`);

    // Get Apify API token
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Prepare location for search
    const searchLocation = `${city.name}, ${city.state}`;

    // Start the memo23 Apify actor for detailed agent data
    const actorId = 'memo23~apify-zillow-agents-cheerio';

    // First, get agent URLs from existing profiles
    const { data: existingProfiles } = await supabase
      .from('professionals')
      .select('zillow_profile_url')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .not('zillow_profile_url', 'is', null)
      .limit(50); // Process up to 50 agents concurrently

    if (!existingProfiles || existingProfiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No existing profiles found. Please run agenscrape first to get profile URLs.',
          imported: 0,
          total: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentUrls = existingProfiles
      .filter(p => p.zillow_profile_url)
      .map(p => p.zillow_profile_url);

    console.log(`Processing ${agentUrls.length} agent profiles with memo23 (1 URL per concurrent session)`);

    // Start concurrent actor runs (one URL per run for maximum speed)
    const runPromises = agentUrls.map(async (url) => {
      try {
        const actorInput = {
          startUrls: [{ url }], // Single URL per run
          maxConcurrency: 1,
          proxyConfiguration: { useApifyProxy: true }
        };

        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(actorInput)
          }
        );

        if (!runResponse.ok) {
          console.error(`Failed to start run for ${url}`);
          return null;
        }

        const runData = await runResponse.json();
        return { runId: runData.data.id, url };
      } catch (error) {
        console.error(`Error starting run for ${url}:`, error);
        return null;
      }
    });

    const runs = (await Promise.all(runPromises)).filter(r => r !== null);
    console.log(`Started ${runs.length} concurrent actor runs`);

    // Poll all runs for completion concurrently
    const resultPromises = runs.map(async ({ runId, url }) => {
      try {
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max per run
        let runStatus = 'RUNNING';

        while (runStatus === 'RUNNING' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          attempts++;

          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
          );
          
          if (!statusResponse.ok) {
            console.error(`Failed to check run status for ${url}`);
            return null;
          }

          const statusData = await statusResponse.json();
          runStatus = statusData.data.status;

          if (runStatus === 'SUCCEEDED') {
            // Fetch results for this run
            const resultsResponse = await fetch(
              `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
            );

            if (!resultsResponse.ok) {
              console.error(`Failed to fetch results for ${url}`);
              return null;
            }

            const results = await resultsResponse.json();
            return results[0]; // Return first (and only) result
          }
        }

        console.error(`Timeout or failed for ${url}, status: ${runStatus}`);
        return null;
      } catch (error) {
        console.error(`Error processing run for ${url}:`, error);
        return null;
      }
    });

    const agents = (await Promise.all(resultPromises)).filter(r => r !== null);
    console.log(`Retrieved ${agents.length} agent profiles from memo23`);

    // Get next rank for this city/category
    const { data: existingPros } = await supabase
      .from('professionals')
      .select('rank')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .order('rank', { ascending: false })
      .limit(1);

    let nextRank = existingPros && existingPros.length > 0 ? existingPros[0].rank + 1 : 1;

    // Process and store each agent with full memo23 data
    let imported = 0;
    
    for (const agent of agents) {
      try {
        const profileUrl = agent.url;
        
        // Fetch existing record to check for updates
        const { data: existingRecord } = await supabase
          .from('professionals')
          .select('*')
          .eq('zillow_profile_url', profileUrl)
          .eq('city_id', cityId)
          .eq('category_id', categoryId)
          .maybeSingle();

        // Map all memo23 fields, only including non-null/non-undefined values
        const memo23Data: any = {};
        
        // Basic fields - memo23 is authoritative when it has data
        if (agent.name) memo23Data.name = agent.name;
        if (agent.screenName) memo23Data.screen_name = agent.screenName;
        if (agent.encodedZuid) {
          memo23Data.encoded_zuid = agent.encodedZuid;
          memo23Data.zuid = agent.encodedZuid; // Also store in zuid for compatibility
        }
        if (agent.inCanada !== undefined) memo23Data.in_canada = agent.inCanada;
        if (agent.profileTypeIds) memo23Data.profile_type_ids = agent.profileTypeIds;
        if (agent.profileTypes) memo23Data.profile_types = agent.profileTypes;
        if (agent.sidebarVideoUrl) memo23Data.sidebar_video_url = agent.sidebarVideoUrl;
        if (agent.businessAddress) memo23Data.business_address = agent.businessAddress;
        if (agent.businessName) {
          memo23Data.business_name = agent.businessName;
          memo23Data.company = agent.businessName; // Also map to company field
        }
        if (agent.cpdUserPronouns) memo23Data.cpd_user_pronouns = agent.cpdUserPronouns;
        if (agent.isTopAgent !== undefined) memo23Data.is_top_agent = agent.isTopAgent;
        if (agent.profileImageId) memo23Data.profile_image_id = agent.profileImageId;
        if (agent.profilePhotoSrc) memo23Data.image_url = agent.profilePhotoSrc;
        if (agent.isPremierAgent !== undefined) memo23Data.is_premier_agent = agent.isPremierAgent;
        if (agent.ratings) memo23Data.ratings = agent.ratings;
        if (agent.phoneNumbers) memo23Data.phone_numbers = agent.phoneNumbers;
        if (agent.email) memo23Data.email = agent.email;
        if (agent.professional) memo23Data.professional_data = agent.professional;
        if (agent.getToKnowMe) {
          memo23Data.get_to_know_me = agent.getToKnowMe?.text || agent.getToKnowMe;
        }
        if (agent.agentLicenses) memo23Data.agent_licenses = agent.agentLicenses;
        if (agent.agentSalesStats) memo23Data.agent_sales_stats = agent.agentSalesStats;
        if (agent.teamDisplayInformation) memo23Data.team_display_information = agent.teamDisplayInformation;
        if (agent.pastSales) memo23Data.past_sales = agent.pastSales;
        if (agent.professionalInformation) memo23Data.professional_information = agent.professionalInformation;
        
        // Extract phone from phoneNumbers array if available
        if (agent.phoneNumbers && agent.phoneNumbers.length > 0) {
          const primaryPhone = agent.phoneNumbers.find((p: any) => p.primary) || agent.phoneNumbers[0];
          if (primaryPhone?.formattedPhoneNumber) {
            memo23Data.phone = primaryPhone.formattedPhoneNumber;
          }
        }
        
        // Extract review data
        if (agent.ratings) {
          if (agent.ratings.starRating) memo23Data.review_stars_rating = agent.ratings.starRating;
          if (agent.ratings.totalReviews) memo23Data.num_total_reviews = agent.ratings.totalReviews;
        }
        
        // Extract sales data from agentSalesStats
        if (agent.agentSalesStats?.totalTransactionSides) {
          memo23Data.total_sales = agent.agentSalesStats.totalTransactionSides;
        }
        
        // Set zillow data fetch timestamp
        memo23Data.zillow_data_fetched_at = new Date().toISOString();
        memo23Data.zillow_profile_url = profileUrl;

        if (existingRecord) {
          // Update existing professional using its ID
          const { error: updateError } = await supabase
            .from('professionals')
            .update(memo23Data)
            .eq('id', existingRecord.id);

          if (updateError) {
            console.error(`Error updating agent ${agent.name}:`, updateError);
          } else {
            console.log(`Updated agent: ${agent.name}`);
            imported++;
          }
        } else {
          // Insert new professional with rank
          memo23Data.rank = nextRank++;
          memo23Data.city_id = cityId;
          memo23Data.category_id = categoryId;
          memo23Data.type = 'individual';
          memo23Data.active = true;
          
          const { error: insertError } = await supabase
            .from('professionals')
            .insert(memo23Data);

          if (insertError) {
            console.error(`Error inserting agent ${agent.name}:`, insertError);
          } else {
            console.log(`Inserted agent: ${agent.name}`);
            imported++;
          }
        }
      } catch (error) {
        console.error(`Error processing agent:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total: agents.length,
        message: `Successfully processed ${imported} out of ${agents.length} agents with memo23 data`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-memo23-agents:', error);
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
