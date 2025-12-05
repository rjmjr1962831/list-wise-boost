import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRERENDER_TOKEN = Deno.env.get('PRERENDER_TOKEN');
const PRERENDER_API = 'https://api.prerender.io/recache';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BASE_URL = "https://www.top10lists.us";
const STATIC_PAGES = [
  "/", "/about", "/about/ranking-methodology", "/privacy", "/terms", "/sms-terms", "/agent-info", "/check-profile"
];
const DELAY_MS = 500;
const BATCH_SIZE = 50;

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
      
      const result = await processBatch(job.id);
      
      if (!result.completed) {
        triggerNextBatch(job.id);
      }

      return new Response(JSON.stringify({ success: true, jobId: job.id, totalUrls: urls.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: continue - Continue processing (self-triggered)
    if (action === 'continue' && jobId) {
      console.log(`Continuing job ${jobId}`);
      const result = await processBatch(jobId);
      if (!result.completed) {
        triggerNextBatch(jobId);
      }
      return new Response(JSON.stringify({ success: true, completed: result.completed, processed: result.processed }), {
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
      const result = await processBatch(jobId);
      if (!result.completed) {
        triggerNextBatch(jobId);
      }
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

async function processBatch(jobId: string): Promise<{ completed: boolean; processed: number }> {
  const { data: job } = await supabase
    .from('prerender_recache_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (!job || job.status !== 'running') {
    return { completed: true, processed: 0 };
  }

  const urls = job.urls as string[];
  const startIndex = job.processed_urls || 0;
  const endIndex = Math.min(startIndex + BATCH_SIZE, urls.length);
  let successCount = job.successful_urls || 0;
  let failCount = job.failed_urls || 0;

  for (let i = startIndex; i < endIndex; i++) {
    const url = urls[i];
    const success = await recacheUrl(url);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Check if job was stopped every 10 URLs
    if ((i - startIndex) % 10 === 0 && i > startIndex) {
      const { data: currentJob } = await supabase
        .from('prerender_recache_jobs')
        .select('status')
        .eq('id', jobId)
        .single();
      
      if (currentJob?.status !== 'running') {
        await supabase
          .from('prerender_recache_jobs')
          .update({
            processed_urls: i + 1,
            successful_urls: successCount,
            failed_urls: failCount
          })
          .eq('id', jobId);
        return { completed: true, processed: i - startIndex + 1 };
      }
    }

    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  const completed = endIndex >= urls.length;
  
  await supabase
    .from('prerender_recache_jobs')
    .update({
      processed_urls: endIndex,
      successful_urls: successCount,
      failed_urls: failCount,
      status: completed ? 'completed' : 'running',
      completed_at: completed ? new Date().toISOString() : null
    })
    .eq('id', jobId);

  return { completed, processed: endIndex - startIndex };
}

async function triggerNextBatch(jobId: string) {
  const functionUrl = `${SUPABASE_URL}/functions/v1/process-prerender-recache`;
  
  try {
    await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ action: 'continue', jobId })
    });
  } catch (err) {
    console.error('Error triggering next batch:', err);
  }
}
