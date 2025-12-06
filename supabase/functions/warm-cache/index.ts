import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BASE_URL = "https://www.top10lists.us";
const BOT_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const STATIC_PAGES = [
  "/", "/about", "/about/ranking-methodology", "/privacy", "/terms", "/sms-terms", "/agent-info", "/check-profile"
];
const DELAY_MS = 300; // Reduced delay since we have timeout protection
const BATCH_SIZE = 20; // Reduced from 50 to complete within edge function timeout
const URL_TIMEOUT_MS = 5000; // 5 second timeout per URL

// Warm a single URL with timeout protection
async function warmCacheUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'User-Agent': BOT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log(`Warmed ${url}: ${response.status}`);
    return response.ok;
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      console.warn(`Timeout warming ${url} after ${URL_TIMEOUT_MS}ms - skipping`);
    } else {
      console.error(`Error warming ${url}:`, error.message || err);
    }
    return false;
  }
}

async function buildUrls(): Promise<string[]> {
  const { data: citiesWithAgents, error } = await supabase
    .from('cities')
    .select('id, slug, state_slug')
    .eq('active', true)
    .order('name');

  if (error || !citiesWithAgents) {
    console.error('Error loading cities:', error);
    return [];
  }

  const urls: string[] = [];
  STATIC_PAGES.forEach(page => urls.push(`${BASE_URL}${page}`));
  urls.push(`${BASE_URL}/arizona`);
  
  citiesWithAgents.forEach(city => {
    const cityPath = `/${city.state_slug}/${city.slug}`;
    urls.push(`${BASE_URL}${cityPath}/top10realestateagents`);
    urls.push(`${BASE_URL}${cityPath}/best-real-estate-agents`);
    urls.push(`${BASE_URL}${cityPath}/best-real-estate-agents-2025`);
  });

  console.log(`Built ${urls.length} URLs for ${citiesWithAgents.length} cities`);
  return urls;
}

// Background batch processor using EdgeRuntime.waitUntil pattern
async function processBatchInBackground(jobId: string) {
  try {
    const result = await processBatch(jobId);
    if (!result.completed) {
      await triggerNextBatch(jobId);
    }
  } catch (err) {
    console.error(`Background batch processing error for job ${jobId}:`, err);
  }
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

      console.log(`Created cache warming job ${job.id} with ${urls.length} URLs`);
      
      // Use EdgeRuntime.waitUntil for background processing
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(processBatchInBackground(job.id));
      } else {
        // Fallback: process inline if EdgeRuntime not available
        const result = await processBatch(job.id);
        if (!result.completed) {
          triggerNextBatch(job.id);
        }
      }

      return new Response(JSON.stringify({ success: true, jobId: job.id, totalUrls: urls.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: continue - Continue processing (self-triggered)
    if (action === 'continue' && jobId) {
      console.log(`Continuing cache warming job ${jobId}`);
      
      // Use EdgeRuntime.waitUntil for background processing
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(processBatchInBackground(jobId));
        return new Response(JSON.stringify({ success: true, message: 'Batch processing started in background' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        const result = await processBatch(jobId);
        if (!result.completed) {
          triggerNextBatch(jobId);
        }
        return new Response(JSON.stringify({ success: true, completed: result.completed, processed: result.processed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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
      
      // Use EdgeRuntime.waitUntil for background processing
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(processBatchInBackground(jobId));
        return new Response(JSON.stringify({ success: true, message: 'Resume started in background' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        const result = await processBatch(jobId);
        if (!result.completed) {
          triggerNextBatch(jobId);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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
  const startIndex = job.processed_count || 0;
  const endIndex = Math.min(startIndex + BATCH_SIZE, urls.length);
  let successCount = job.success_count || 0;
  let failCount = job.fail_count || 0;

  console.log(`Processing batch: URLs ${startIndex} to ${endIndex} of ${urls.length} (batch size: ${BATCH_SIZE})`);

  for (let i = startIndex; i < endIndex; i++) {
    const url = urls[i];
    const success = await warmCacheUrl(url);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Check if job was stopped every 5 URLs
    if ((i - startIndex + 1) % 5 === 0 || i === endIndex - 1) {
      const { data: currentJob } = await supabase
        .from('prerender_recache_jobs')
        .select('status')
        .eq('id', jobId)
        .single();
      
      if (currentJob?.status !== 'running') {
        await supabase
          .from('prerender_recache_jobs')
          .update({
            processed_count: i + 1,
            current_index: i + 1,
            success_count: successCount,
            fail_count: failCount
          })
          .eq('id', jobId);
        console.log(`Job stopped at URL ${i + 1}`);
        return { completed: true, processed: i - startIndex + 1 };
      }

      // Update progress in DB for real-time display
      await supabase
        .from('prerender_recache_jobs')
        .update({
          processed_count: i + 1,
          current_index: i + 1,
          success_count: successCount,
          fail_count: failCount
        })
        .eq('id', jobId);
    }

    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  const completed = endIndex >= urls.length;
  
  await supabase
    .from('prerender_recache_jobs')
    .update({
      processed_count: endIndex,
      current_index: endIndex,
      success_count: successCount,
      fail_count: failCount,
      status: completed ? 'completed' : 'running',
      completed_at: completed ? new Date().toISOString() : null
    })
    .eq('id', jobId);

  console.log(`Batch complete: ${endIndex}/${urls.length} URLs processed (${successCount} success, ${failCount} failed)`);
  return { completed, processed: endIndex - startIndex };
}

async function triggerNextBatch(jobId: string, retries = 3) {
  const functionUrl = `${SUPABASE_URL}/functions/v1/warm-cache`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Triggering next batch for job ${jobId} (attempt ${attempt})`);
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ action: 'continue', jobId })
      });
      
      if (response.ok) {
        console.log(`Successfully triggered next batch for job ${jobId}`);
        return;
      } else {
        console.error(`Trigger attempt ${attempt} failed with status ${response.status}`);
      }
    } catch (err) {
      console.error(`Error triggering next batch (attempt ${attempt}):`, err);
    }
    
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error(`All trigger attempts failed for job ${jobId} - job will need manual resume`);
}
