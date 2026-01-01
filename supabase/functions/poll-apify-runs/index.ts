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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Get category ID for real estate agents
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (!category) {
      throw new Error('Real estate agents category not found');
    }

    // Get all running scrape jobs
    const { data: runningJobs, error: jobsError } = await supabase
      .from('scrape_jobs')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: true })
      .limit(20);

    if (jobsError) {
      throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }

    if (!runningJobs || runningJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No running jobs to poll', completed: 0, stillRunning: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Polling ${runningJobs.length} running Apify jobs...`);

    const results: { city: string; status: string; imported?: number; skipped?: number; error?: string }[] = [];

    for (const job of runningJobs) {
      try {
        console.log(`[${job.city}] Checking run ${job.apify_run_id}...`);

        const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${job.apify_run_id}?token=${apifyToken}`);
        const statusData = await statusResponse.json();
        const runStatus = statusData.data.status;

        if (runStatus === 'RUNNING' || runStatus === 'READY') {
          console.log(`[${job.city}] Still running...`);
          results.push({ city: job.city, status: 'running' });
          continue;
        }

        if (runStatus !== 'SUCCEEDED') {
          console.error(`[${job.city}] Run ended with status: ${runStatus}`);
          await supabase.from('scrape_jobs').update({
            status: 'failed',
            error_message: `Run status: ${runStatus}`,
            completed_at: new Date().toISOString()
          }).eq('id', job.id);
          results.push({ city: job.city, status: 'failed', error: runStatus });
          continue;
        }

        // Get dataset and import agents
        console.log(`[${job.city}] Run succeeded, fetching dataset...`);
        const datasetId = statusData.data.defaultDatasetId;
        const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`);
        const agents = await datasetResponse.json();
        console.log(`[${job.city}] Got ${agents.length} agents from Apify`);

        // Get city record
        const { data: cityRecord } = await supabase
          .from('cities')
          .select('id')
          .eq('name', job.city)
          .eq('state', job.state)
          .maybeSingle();

        if (!cityRecord) {
          console.error(`[${job.city}] City record not found`);
          await supabase.from('scrape_jobs').update({
            status: 'failed',
            error_message: 'City record not found',
            completed_at: new Date().toISOString()
          }).eq('id', job.id);
          results.push({ city: job.city, status: 'failed', error: 'City not found' });
          continue;
        }

        // Get next available rank
        const { data: maxRankData } = await supabase
          .from('professionals')
          .select('rank')
          .eq('city_id', cityRecord.id)
          .eq('category_id', category.id)
          .order('rank', { ascending: false })
          .limit(1);

        let nextRank = maxRankData && maxRankData.length > 0 ? maxRankData[0].rank + 1 : 1;

        let imported = 0;
        let skipped = 0;
        const qualifiedAgentIds: string[] = [];

        for (const agent of agents) {
          const rating = agent.review_average || 0;
          const reviewCount = typeof agent.review_count === 'string'
            ? parseInt(agent.review_count.replace(/[()]/g, ''), 10) || 0
            : agent.review_count || 0;

          // Filter: 4.5+ rating, 20+ reviews
          if (rating < 4.5 || reviewCount < 20) {
            skipped++;
            continue;
          }

          const profileUrl = agent.link;
          const { data: existing } = await supabase
            .from('professionals')
            .select('id')
            .eq('zillow_profile_url', profileUrl)
            .maybeSingle();

          const zuidMatch = profileUrl?.match(/profile\/([^\/]+)/);
          const zuid = zuidMatch ? zuidMatch[1] : null;

          const profileDataObj: any = {};
          if (Array.isArray(agent.profile_data)) {
            agent.profile_data.forEach((item: any) => Object.assign(profileDataObj, item));
          }

          const teamSalesTotal = profileDataObj['team sales in Phoenix'] || profileDataObj['team sales in Scottsdale'] || profileDataObj['team sales'];

          const professionalData: any = {
            name: agent.title,
            company: agent.secondary_title,
            zillow_profile_url: profileUrl,
            zuid: zuid,
            total_sales: teamSalesTotal ? parseInt(String(teamSalesTotal).replace(/,/g, ''), 10) : 0,
            review_stars_rating: rating,
            num_total_reviews: reviewCount,
            is_top_agent: agent.top_agent || false,
            professional_information: [agent],
            ratings: { average: rating, count: reviewCount },
            image_url: agent.image_url,
            zillow_data_fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase.from('professionals').update(professionalData).eq('id', existing.id);
            qualifiedAgentIds.push(existing.id);
            imported++;
          } else {
            professionalData.city_id = cityRecord.id;
            professionalData.category_id = category.id;
            professionalData.rank = nextRank++;
            professionalData.type = 'individual';
            professionalData.active = true;

            const { data: inserted, error: insertError } = await supabase
              .from('professionals')
              .insert(professionalData)
              .select('id')
              .single();

            if (!insertError && inserted) {
              qualifiedAgentIds.push(inserted.id);
              imported++;
            } else {
              skipped++;
            }
          }
        }

        console.log(`[${job.city}] Imported ${imported}, skipped ${skipped}`);

        // Queue for enrichment
        if (qualifiedAgentIds.length > 0) {
          for (const id of qualifiedAgentIds) {
            await supabase.from('contact_enrichment_queue').upsert({
              professional_id: id,
              reason: `Auto-queued from ${job.city}, ${job.state} pipeline`,
              status: 'pending',
              stage: 'queued'
            }, { onConflict: 'professional_id' });
          }
          console.log(`[${job.city}] Queued ${qualifiedAgentIds.length} agents for enrichment`);
        }

        // Update job status
        await supabase.from('scrape_jobs').update({
          status: 'completed',
          agents_found: agents.length,
          agents_saved: imported,
          completed_at: new Date().toISOString()
        }).eq('id', job.id);

        results.push({ city: job.city, status: 'completed', imported, skipped });

      } catch (error) {
        console.error(`[${job.city}] Error polling:`, error);
        results.push({ city: job.city, status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    }

    const completed = results.filter(r => r.status === 'completed').length;
    const stillRunning = results.filter(r => r.status === 'running').length;
    const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
    const totalImported = results.reduce((sum, r) => sum + (r.imported || 0), 0);

    console.log(`\n=== POLL COMPLETE ===`);
    console.log(`Completed: ${completed}, Still running: ${stillRunning}, Failed: ${failed}`);
    console.log(`Total agents imported: ${totalImported}`);

    // If there are completed imports, trigger enrichment
    if (totalImported > 0) {
      console.log(`Triggering enrichment processor...`);
      supabase.functions.invoke('process-contact-enrichment-queue', {
        body: {
          batchSize: 10,
          concurrency: 5,
          dryRun: false,
          skipRecentlyEnriched: true,
          skipGenericBios: false,
          skipIfNoPress: false
        }
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        polled: runningJobs.length,
        completed,
        stillRunning,
        failed,
        totalImported,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in poll-apify-runs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
