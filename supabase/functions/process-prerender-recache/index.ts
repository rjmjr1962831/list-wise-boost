import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRERENDER_TOKEN = Deno.env.get('PRERENDER_TOKEN');
const PRERENDER_API = 'https://api.prerender.io/recache';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BASE_URL = "https://top10lists.us";
const STATIC_PAGES = [
  "/", "/about", "/about/ranking-methodology", "/privacy", "/terms", "/sms-terms", "/agent-info", "/check-profile"
];
const DELAY_MS = 1000;
const BATCH_SIZE = 10; // Process 10 URLs per function call to avoid timeout

async function recacheUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(PRERENDER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prerenderToken: PRERENDER_TOKEN,
        urls: [url],
        adaptiveType: 'desktop'
      })
    });
    return response.ok;
  } catch (err) {
    console.error(`Error recaching ${url}:`, err);
    return false;
  }
}

async function buildUrls(): Promise<string[]> {
  const { data: cities, error } = await supabase
    .from('cities')
    .select('slug, state_slug')
    .eq('active', true)
    .order('name');

  if (error || !cities) {
    console.error('Error loading cities:', error);
    return [];
  }

  const urls: string[] = [];
  STATIC_PAGES.forEach(page => urls.push(`${BASE_URL}${page}`));
  urls.push(`${BASE_URL}/arizona`);
  
  cities.forEach(city => {
    const cityPath = `/${city.state_slug}/${city.slug}`;
    urls.push(`${BASE_URL}${cityPath}/top10realestateagents`);
    urls.push(`${BASE_URL}${cityPath}/best-real-estate-agents`);
    urls.push(`${BASE_URL}${cityPath}/best-real-estate-agents-2025`);
  });

  return urls;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, jobId } = await req.json();

    // Action: start - Create a new job
    if (action === 'start') {
      const urls = await buildUrls();
      
      const { data: job, error } = await supabase
        .from('prerender_recache_jobs')
        .insert({
          status: 'running',
          total_urls: urls.length,
          urls: urls,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`Created job ${job.id} with ${urls.length} URLs`);
      
      // Start processing in background
      EdgeRuntime.waitUntil(processJob(job.id));

      return new Response(JSON.stringify({ success: true, jobId: job.id, totalUrls: urls.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: stop - Stop a running job
    if (action === 'stop' && jobId) {
      await supabase
        .from('prerender_recache_jobs')
        .update({ status: 'stopped', completed_at: new Date().toISOString() })
        .eq('id', jobId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: resume - Resume a stopped job
    if (action === 'resume' && jobId) {
      await supabase
        .from('prerender_recache_jobs')
        .update({ status: 'running' })
        .eq('id', jobId);

      EdgeRuntime.waitUntil(processJob(jobId));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: status - Get current job status
    if (action === 'status') {
      const { data: job } = await supabase
        .from('prerender_recache_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return new Response(JSON.stringify({ success: true, job }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processJob(jobId: string) {
  console.log(`Processing job ${jobId}`);
  
  try {
    // Get job data
    const { data: job, error: fetchError } = await supabase
      .from('prerender_recache_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      console.error('Failed to fetch job:', fetchError);
      return;
    }

    const urls = job.urls as string[];
    let currentIndex = job.current_index;
    let successCount = job.success_count;
    let failCount = job.fail_count;
    const results = (job.results as any[]) || [];

    while (currentIndex < urls.length) {
      // Check if job was stopped
      const { data: currentJob } = await supabase
        .from('prerender_recache_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (currentJob?.status === 'stopped') {
        console.log('Job was stopped');
        return;
      }

      const url = urls[currentIndex];
      console.log(`Processing [${currentIndex + 1}/${urls.length}]: ${url}`);

      const success = await recacheUrl(url);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      results.push({ url, success, timestamp: new Date().toISOString() });
      currentIndex++;

      // Update progress every URL
      await supabase
        .from('prerender_recache_jobs')
        .update({
          current_index: currentIndex,
          processed_count: currentIndex,
          success_count: successCount,
          fail_count: failCount,
          results: results.slice(-100) // Keep last 100 results to avoid huge payload
        })
        .eq('id', jobId);

      // Delay between requests
      if (currentIndex < urls.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // Mark job as completed
    await supabase
      .from('prerender_recache_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`Job ${jobId} completed: ${successCount} success, ${failCount} failed`);
  } catch (error) {
    console.error('Error processing job:', error);
    await supabase
      .from('prerender_recache_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}
