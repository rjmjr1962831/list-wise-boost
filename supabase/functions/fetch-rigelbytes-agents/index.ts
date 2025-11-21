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
    const { cityId, categoryId, maxResults = 50 } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Get city and category details
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

    if (!city || !category) {
      throw new Error('City or category not found');
    }

    console.log(`Starting rigelbytes scrape for ${city.name}, ${city.state} - ${category.name}`);

    // Use rigelbytes actor
    const actorId = 'rigelbytes/zillow-agents';
    const actorInput = {
      location: `${city.name}, ${city.state}`,
      maxItems: maxResults,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };

    console.log('Starting rigelbytes actor with input:', JSON.stringify(actorInput, null, 2));

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
    const maxAttempts = 120; // 10 minutes max

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      
      console.log(`Attempt ${attempts + 1}: Actor status = ${runStatus}`);
      attempts++;
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Rigelbytes actor failed with status: ${runStatus}`);
    }

    // Get the dataset
    const datasetId = runData.data.defaultDatasetId;
    const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`);
    const agents = await datasetResponse.json();

    console.log(`Rigelbytes returned ${agents.length} agents`);

    // Get next available rank
    const { data: maxRankData } = await supabase
      .from('professionals')
      .select('rank')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .order('rank', { ascending: false })
      .limit(1);

    let nextRank = maxRankData && maxRankData.length > 0 ? maxRankData[0].rank + 1 : 1;

    const imported: any[] = [];
    const skipped: any[] = [];

    for (const agent of agents) {
      try {
        // Filter by rating (4.9+) and reviews (minimum 10)
        const rating = agent.ratings?.average || agent.review_average || 0;
        const reviewCount = agent.ratings?.count || 0;
        
        if (rating < 4.9 || reviewCount < 10) {
          skipped.push({
            name: agent.name,
            reason: `Rating ${rating} or reviews ${reviewCount} below threshold`,
          });
          continue;
        }

        // Check if agent already exists by profile URL
        const profileUrl = agent.link;
        const { data: existing } = await supabase
          .from('professionals')
          .select('id, rank')
          .eq('zillow_profile_url', profileUrl)
          .maybeSingle();

        // Extract ZUID from profile URL
        const zuidMatch = profileUrl?.match(/profile\/([^\/]+)/);
        const zuid = zuidMatch ? zuidMatch[1] : null;

        // Map rigelbytes data to our schema
        const professionalData: any = {
          name: agent.name,
          company: agent.business_name,
          email: agent.email,
          phone: agent.phone_numbers?.cell || agent.phone_numbers?.business,
          website: agent.know_me?.websiteUrl,
          zillow_profile_url: profileUrl,
          zuid: zuid,
          encoded_zuid: agent.encoded_zuid,
          address: agent.business_address ? 
            `${agent.business_address.address1}, ${agent.business_address.city}, ${agent.business_address.state} ${agent.business_address.postalCode}` : null,
          business_address: agent.business_address,
          business_name: agent.business_name,
          phone_numbers: agent.phone_numbers,
          
          // Stats
          current_listings: agent.for_sale_listings?.listing_count || 0,
          total_sales: agent.agent_sales_stats?.countAllTime || 0,
          review_stars_rating: agent.ratings?.average || agent.review_average,
          num_total_reviews: agent.ratings?.count || 0,
          years_experience: agent.know_me?.yearsInIndustry,
          
          // Premium status
          is_premier_agent: agent.is_premier_agent || false,
          is_top_agent: agent.top_agent || false,
          
          // JSON data
          agent_sales_stats: agent.agent_sales_stats,
          agent_licenses: agent.licenses,
          ratings: agent.ratings,
          reviews_data: agent.reviews_data,
          past_sales: agent.past_sales,
          professional_information: [agent], // Store full rigelbytes data
          
          // Bio
          get_to_know_me: agent.know_me?.description?.replace(/<[^>]*>/g, ''), // Strip HTML
          description: agent.know_me?.description?.replace(/<[^>]*>/g, ''),
          
          // Specialties
          specialty: agent.know_me?.specialties || [],
          
          // Images
          image_url: agent.profile_photo || agent.image_url,
          
          // Location
          in_canada: agent.in_canada || false,
          
          // Timestamps
          zillow_data_fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          // Update existing agent
          const { error: updateError } = await supabase
            .from('professionals')
            .update(professionalData)
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Failed to update agent ${agent.name}:`, updateError);
            skipped.push({ name: agent.name, reason: updateError.message });
          } else {
            console.log(`Updated existing agent: ${agent.name}`);
            imported.push({
              id: existing.id,
              name: agent.name,
              profileUrl,
              updated: true,
            });
          }
        } else {
          // Insert new agent
          professionalData.city_id = cityId;
          professionalData.category_id = categoryId;
          professionalData.rank = nextRank;
          professionalData.type = 'agent';
          professionalData.active = true;
          professionalData.created_at = new Date().toISOString();

          const { data: inserted, error: insertError } = await supabase
            .from('professionals')
            .insert(professionalData)
            .select('id')
            .single();

          if (insertError) {
            console.error(`Failed to insert agent ${agent.name}:`, insertError);
            skipped.push({ name: agent.name, reason: insertError.message });
          } else {
            console.log(`Inserted new agent: ${agent.name} at rank ${nextRank}`);
            imported.push({
              id: inserted.id,
              name: agent.name,
              profileUrl,
              updated: false,
            });
            nextRank++;
          }
        }
      } catch (error) {
        console.error(`Error processing agent ${agent.name}:`, error);
        skipped.push({ name: agent.name, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: imported.length,
        skipped: skipped.length,
        agents: imported,
        skippedAgents: skipped,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-rigelbytes-agents:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
