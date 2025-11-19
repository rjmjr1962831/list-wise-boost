import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, state, maxPages = 3, cityId, categoryId } = await req.json();
    
    if (!city || !state || !cityId || !categoryId) {
      throw new Error('city, state, cityId, and categoryId are required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    console.log(`Starting Zillow bulk scraper for ${city}, ${state}`);

    // Prepare Apify actor input for agenscrape
    const actorInput = {
      search_query: `${city}, ${state}`,
      category: "real-estate-agents",
      locationText: `${city}, ${state}`,
      name: "",
      language: "en",
      specialty: "",
      maxResults: maxPages * 10,
      startPage: 1
    };

    console.log('Apify actor input:', JSON.stringify(actorInput, null, 2));

    // Start the Apify actor - using agenscrape
    const startResponse = await fetch(
      'https://api.apify.com/v2/acts/getdataforme~agenscrape/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
        body: JSON.stringify(actorInput),
      }
    );

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(`Failed to start scraper: ${startResponse.status} - ${errorText}`);
    }

    const { data: runData } = await startResponse.json();
    const runId = runData.id;
    console.log(`Actor started with run ID: ${runId}`);
    
    const startTime = Date.now();

    // Poll for completion
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${APIFY_API_TOKEN}`,
          },
        }
      );

      const statusResult = await statusResponse.json();
      status = statusResult.data.status;
      attempts++;
      
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`Run status: ${status}, attempt ${attempts}/${maxAttempts}, elapsed: ${elapsed}s`);
      
      if (statusResult.data.stats) {
        console.log('Apify stats:', JSON.stringify(statusResult.data.stats, null, 2));
      }
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Scraper did not complete successfully. Final status: ${status}`);
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`Apify run completed successfully after ${totalTime} seconds`);

    // Get results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
      {
        headers: {
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
      }
    );

    const agents = await resultsResponse.json();
    console.log(`Retrieved ${agents.length} agents from Apify`);
    console.log('Raw Apify response:', JSON.stringify(agents).substring(0, 500));

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No agents found for this location',
          imported: 0
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Save agents to database
    let imported = 0;
    const errors: string[] = [];

    for (const agent of agents) {
      try {
        // Map Zillow agent data to our schema
        const badges: string[] = [];
        
        // Add badges based on stats
        if (agent.rating >= 4.5) {
          badges.push('5-Star Rated');
        }
        if (agent.sales && agent.sales >= 100) {
          badges.push('100+ Sales');
        }

        const professionalData = {
          city_id: cityId,
          category_id: categoryId,
          name: agent.name || 'Unknown Agent',
          company: agent.brokerage || null,
          phone: agent.phone || null,
          email: agent.email || null,
          website: agent.website || null,
          zillow_profile_url: agent.profileUrl || null,
          image_url: agent.photo || null,
          description: agent.bio || null,
          specialty: agent.specialties ? [agent.specialties] : null,
          type: 'individual',
          rank: imported + 1,
          active: true,
          total_sales: agent.sales || null,
          current_listings: agent.listings || null,
          years_experience: agent.yearsOfExperience || null,
          badges,
        };

        const insertResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/professionals`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY!,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(professionalData)
          }
        );

        if (insertResponse.ok) {
          imported++;
          console.log(`✅ Imported ${agent.name}`);
        } else {
          const errorText = await insertResponse.text();
          errors.push(`Failed to import ${agent.name}: ${errorText}`);
          console.error(`❌ Failed to import ${agent.name}:`, errorText);
        }
      } catch (error: any) {
        errors.push(`Error processing ${agent.name || 'unknown'}: ${error.message}`);
        console.error(`Error processing agent:`, error);
      }
    }

    console.log(`Import complete: ${imported}/${agents.length} agents imported`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total: agents.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in fetch-zillow-agents-bulk:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
