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
    const actorId = 'memo23/apify-zillow-agents-cheerio';
    const actorInput: {
      startUrls: Array<{ url: string }>;
      maxConcurrency: number;
      proxyConfiguration: { useApifyProxy: boolean };
    } = {
      startUrls: [], // Will be populated with agent URLs
      maxConcurrency: 5,
      proxyConfiguration: {
        useApifyProxy: true
      }
    };

    // First, get agent URLs from agenscrape or existing profiles
    const { data: existingProfiles } = await supabase
      .from('professionals')
      .select('zillow_profile_url')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .not('zillow_profile_url', 'is', null);

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

    // Use existing profile URLs as input
    actorInput.startUrls = existingProfiles
      .filter(p => p.zillow_profile_url)
      .map(p => ({ url: p.zillow_profile_url }));

    console.log(`Processing ${actorInput.startUrls.length} agent profiles with memo23`);

    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput)
      }
    );

    if (!runResponse.ok) {
      throw new Error(`Failed to start Apify actor: ${runResponse.statusText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Apify run started: ${runId}`);

    // Poll for completion (max 5 minutes)
    let runStatus = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 60;

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      console.log(`Run status: ${runStatus}, attempt ${attempts + 1}`);
      attempts++;
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Apify run did not complete successfully: ${runStatus}`);
    }

    // Fetch the results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
    );

    if (!resultsResponse.ok) {
      throw new Error('Failed to fetch results from Apify');
    }

    const agents = await resultsResponse.json();
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
        
        // Check if agent already exists
        const { data: existing } = await supabase
          .from('professionals')
          .select('id')
          .eq('zillow_profile_url', profileUrl)
          .eq('city_id', cityId)
          .eq('category_id', categoryId)
          .maybeSingle();

        // Map all memo23 fields
        const professionalData: any = {
          name: agent.name || 'Unknown Agent',
          screen_name: agent.screenName,
          encoded_zuid: agent.encodedZuid,
          zuid: agent.encodedZuid, // Also store in zuid for compatibility
          in_canada: agent.inCanada || false,
          profile_type_ids: agent.profileTypeIds,
          profile_types: agent.profileTypes,
          sidebar_video_url: agent.sidebarVideoUrl,
          business_address: agent.businessAddress,
          business_name: agent.businessName,
          company: agent.businessName, // Also map to company field
          cpd_user_pronouns: agent.cpdUserPronouns,
          is_top_agent: agent.isTopAgent || false,
          profile_image_id: agent.profileImageId,
          image_url: agent.profilePhotoSrc,
          is_premier_agent: agent.isPremierAgent || false,
          ratings: agent.ratings,
          phone_numbers: agent.phoneNumbers,
          email: agent.email,
          professional_data: agent.professional,
          get_to_know_me: agent.getToKnowMe?.text || agent.getToKnowMe,
          agent_licenses: agent.agentLicenses,
          agent_sales_stats: agent.agentSalesStats,
          past_sales: agent.pastSales,
          professional_information: agent.professionalInformation,
          reviews_data: agent.reviewsData,
          team_display_information: agent.teamDisplayInformation,
          zillow_profile_url: profileUrl,
          zillow_data_fetched_at: new Date().toISOString(),
          city_id: cityId,
          category_id: categoryId,
          type: 'individual',
          active: true
        };

        // Extract additional fields
        if (agent.ratings) {
          professionalData.review_stars_rating = agent.ratings.averageRating;
          professionalData.num_total_reviews = agent.ratings.count;
        }

        if (agent.agentSalesStats) {
          professionalData.total_sales = agent.agentSalesStats.countAllTime || agent.agentSalesStats.countLastYear || 0;
          professionalData.current_listings = 0; // memo23 doesn't provide current listings
        }

        if (agent.phoneNumbers) {
          professionalData.phone = agent.phoneNumbers.cell || agent.phoneNumbers.business || agent.phoneNumbers.brokerage;
        }

        if (agent.businessAddress) {
          const addr = agent.businessAddress;
          professionalData.address = [addr.address1, addr.address2, addr.city, addr.state, addr.postalCode]
            .filter(Boolean)
            .join(', ');
          professionalData.zip_code = addr.postalCode;
        }

        // Extract licenses
        if (agent.agentLicenses && agent.agentLicenses.length > 0) {
          professionalData.license_number = agent.agentLicenses[0].licenseNumber || agent.agentLicenses[0];
        }

        if (existing) {
          // Update existing professional with memo23 data
          const { error: updateError } = await supabase
            .from('professionals')
            .update(professionalData)
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Error updating agent ${agent.name}:`, updateError);
          } else {
            console.log(`Updated agent: ${agent.name}`);
            imported++;
          }
        } else {
          // Insert new professional
          professionalData.rank = nextRank++;
          
          const { error: insertError } = await supabase
            .from('professionals')
            .insert(professionalData);

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
