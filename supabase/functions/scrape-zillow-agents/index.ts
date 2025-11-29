import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, state } = await req.json();
    console.log(`Starting Zillow scrape for ${city}, ${state}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyApiKey = Deno.env.get('APIFY_API_KEY');
    
    if (!apifyApiKey) {
      throw new Error('APIFY_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create scrape job record
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .insert({
        city,
        state,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      throw jobError;
    }

    console.log(`Created scrape job: ${job.id}`);

    // Start Apify actor run (synchronous)
    const actorId = 'getdataforme/zillow-real-state-agents-scraper';
    const apifyInput = {
      location: `${city}, ${state}`,
      maxResults: 100,
    };

    console.log('Starting Apify actor with input:', apifyInput);

    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyInput),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Apify API error:', errorText);
      throw new Error(`Apify API error: ${runResponse.statusText}`);
    }

    const agents = await runResponse.json();
    console.log(`Apify returned ${agents.length} agents`);

    // Update scrape job with Apify run details
    const runId = runResponse.headers.get('x-apify-run-id') || 'unknown';
    await supabase
      .from('scrape_jobs')
      .update({ 
        apify_run_id: runId,
        agents_found: agents.length 
      })
      .eq('id', job.id);

    const totalAgents = agents.length;
    let savedCount = 0;

    // Process each agent
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      
      const zillowPosition = i + 1;
      const zillowPage = Math.ceil(zillowPosition / 15);
      const agentsAhead = zillowPosition - 1;

      // Extract profile ID from URL
      const profileMatch = agent.profileUrl?.match(/\/profile\/([^\/]+)/);
      const profileId = profileMatch ? profileMatch[1] : null;

      if (!profileId) {
        console.warn(`No profile ID found for agent at position ${zillowPosition}`);
        continue;
      }

      // Prepare prospect data
      const prospectData = {
        zillow_profile_id: profileId,
        name: agent.name || 'Unknown',
        email: agent.email || null,
        phone: agent.phone || null,
        company: agent.brokerageName || null,
        city,
        state,
        zillow_profile_url: agent.profileUrl || null,
        zillow_position: zillowPosition,
        zillow_page: zillowPage,
        agents_ahead: agentsAhead,
        zillow_total_agents: totalAgents,
        zillow_rating: agent.rating || null,
        zillow_reviews: agent.reviewCount || null,
        zillow_scraped_at: new Date().toISOString(),
        zillow_sales_count: agent.salesCount || null,
        zillow_sales_volume: agent.salesVolume || null,
        zillow_photo_url: agent.photoUrl || null,
        hubspot_synced: false,
        status: 'new',
      };

      // Upsert prospect (on conflict update zillow data)
      const { error: upsertError } = await supabase
        .from('prospects')
        .upsert(prospectData, {
          onConflict: 'zillow_profile_id',
        });

      if (upsertError) {
        console.error(`Error upserting prospect ${agent.name}:`, upsertError);
      } else {
        savedCount++;
        console.log(`Saved prospect ${zillowPosition}/${totalAgents}: ${agent.name}`);
      }
    }

    // Update scrape job as completed
    await supabase
      .from('scrape_jobs')
      .update({
        status: 'completed',
        agents_saved: savedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    console.log(`Scrape job completed: ${savedCount}/${totalAgents} agents saved`);

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        agentsFound: totalAgents,
        agentsSaved: savedCount,
        city,
        state,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in scrape-zillow-agents:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
