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
    const apifyActorId = Deno.env.get('APIFY_ACTOR_ID') || 'memo23~apify-zillow-agents-cheerio';
    
    if (!apifyApiKey) {
      throw new Error('APIFY_API_KEY not configured');
    }
    
    console.log(`Using Apify actor: ${apifyActorId}`);

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
    const apifyInput = {
      startUrls: [{
        url: `https://www.zillow.com/professionals/real-estate-agent-reviews/${city.toLowerCase()}-${state.toLowerCase()}/`
      }],
      maxItems: 100,
      proxyConfiguration: {
        useApifyProxy: true
      }
    };

    console.log('Starting Apify actor with input:', apifyInput);

    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${apifyActorId}/run-sync-get-dataset-items?token=${apifyApiKey}`,
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

      // Extract profile ID from URL (memo23 format)
      const profileUrl = agent.url || agent.profileUrl || '';
      const profileMatch = profileUrl.match(/\/profile\/([^\/]+)/);
      const profileId = profileMatch ? profileMatch[1] : `${city}-${state}-${i}`;

      // Prepare prospect data (memo23 actor format)
      const prospectData = {
        zillow_profile_id: profileId,
        name: agent.name || agent.fullName || 'Unknown',
        email: agent.email || null,
        phone: agent.phone || agent.phoneNumber || null,
        company: agent.companyName || agent.brokerageName || null,
        city,
        state,
        zillow_profile_url: profileUrl || null,
        zillow_position: zillowPosition,
        zillow_page: zillowPage,
        agents_ahead: agentsAhead,
        zillow_total_agents: totalAgents,
        zillow_rating: agent.rating || agent.reviewStars || null,
        zillow_reviews: agent.reviewCount || agent.numberOfReviews || null,
        zillow_scraped_at: new Date().toISOString(),
        zillow_sales_count: agent.salesLast12Months || agent.transactionCount || null,
        zillow_sales_volume: agent.salesVolume || null,
        zillow_photo_url: agent.photo || agent.photoUrl || agent.imageUrl || null,
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
