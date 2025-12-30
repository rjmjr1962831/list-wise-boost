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

    // Use rigelbytes actor - Apify API expects the tilde (`~`) separator
    const actorId = 'rigelbytes~zillow-agents';
    const actorInput = {
      // Rigelbytes actor required input per OpenAPI schema
      search_keywords: [`${city.name}, ${city.state}`],
      max_agents: maxResults,
      detailed_profiles: true,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
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

    // Poll for completion - Rigelbytes can take 15-20 minutes for large cities
    let runStatus = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 300; // 25 minutes max (300 * 5 seconds)

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      
      console.log(`Attempt ${attempts + 1}: Actor status = ${runStatus}`);
      attempts++;
    }

    if (runStatus !== 'SUCCEEDED') {
      console.error(`Rigelbytes actor ended with status: ${runStatus}`);
      return new Response(
        JSON.stringify({ success: false, imported: 0, skipped: 0, error: `Rigelbytes actor status: ${runStatus}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        // Rigelbytes actor returns different field names than memo23
        const rating = agent.review_average || 0;
        const reviewCount = typeof agent.review_count === 'string' 
          ? parseInt(agent.review_count.replace(/[()]/g, ''), 10) || 0
          : agent.review_count || 0;
        
        // Filter by rating (4.8+) and reviews (minimum 20)
        if (rating < 4.8 || reviewCount < 20) {
          skipped.push({
            name: agent.title,
            reason: `Rating ${rating} or reviews ${reviewCount} below threshold (need 4.8+ rating, 20+ reviews)`,
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

        // Parse profile_data array to extract stats
        const profileDataObj: any = {};
        if (Array.isArray(agent.profile_data)) {
          agent.profile_data.forEach((item: any) => {
            Object.assign(profileDataObj, item);
          });
        }

        const teamSalesLast12Months = profileDataObj['team sales last 12 months'];
        const teamSalesTotal = profileDataObj['team sales in Phoenix'] || profileDataObj['team sales in Scottsdale'];

        // Map rigelbytes data to our schema
        const professionalData: any = {
          name: agent.title,
          company: agent.secondary_title,
          zillow_profile_url: profileUrl,
          zuid: zuid,
          
          // Stats from profile_data
          current_listings: 0, // Not provided by rigelbytes
          total_sales: teamSalesTotal ? parseInt(String(teamSalesTotal).replace(/,/g, ''), 10) : 0,
          review_stars_rating: rating,
          num_total_reviews: reviewCount,
          
          // Premium status
          is_premier_agent: false, // Not provided
          is_top_agent: agent.top_agent || false,
          
          // JSON data - store full rigelbytes response
          professional_information: [agent],
          ratings: {
            average: rating,
            count: reviewCount
          },
          
          // Images
          image_url: agent.image_url,
          
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
          professionalData.type = 'individual'; // Fixed: must be 'individual' per DB constraint
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
