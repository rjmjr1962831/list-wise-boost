import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');
const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface AgentProfile {
  canonical_slug: string;
  state_slug: string;
  name: string;
}

interface WarmResult {
  url: string;
  status: number;
  cache: string;
  rendered: string;
  ms: number;
  success: boolean;
}

function urlToCacheKey(url: string): string {
  const urlObj = new URL(url);
  let path = urlObj.pathname;
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return `html:${path}`;
}

async function deleteKeysFromKV(keys: string[]): Promise<{ success: boolean; deleted: number }> {
  if (keys.length === 0) {
    return { success: true, deleted: 0 };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/bulk`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(keys),
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to delete keys: ${JSON.stringify(data.errors)}`);
  }

  return { success: true, deleted: keys.length };
}

async function warmUrl(url: string, forceRefresh: boolean): Promise<WarmResult> {
  const headers: Record<string, string> = {
    "X-Cache-Warming": "true",
    "User-Agent": "Top10Lists-CacheWarmer/1.0"
  };
  
  if (forceRefresh) {
    headers["X-Force-Refresh"] = "true";
  }

  const startTime = Date.now();
  
  try {
    const response = await fetch(url, { headers });
    const elapsed = Date.now() - startTime;

    const cacheStatus = response.headers.get("X-Cache") || "unknown";
    const renderMethod = response.headers.get("X-Rendered") || "unknown";
    const success = response.status === 200;
    
    return {
      url,
      status: response.status,
      cache: cacheStatus,
      rendered: renderMethod,
      ms: elapsed,
      success
    };
  } catch {
    return {
      url,
      status: 0,
      cache: "error",
      rendered: "error",
      ms: Date.now() - startTime,
      success: false
    };
  }
}

async function fetchAllAgents(supabase: any, stateFilter: string | null, jobId: string): Promise<AgentProfile[]> {
  const allAgents: AgentProfile[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("professionals")
      .select("canonical_slug, state_slug, name")
      .eq("active", true)
      .not("canonical_slug", "is", null)
      .not("state_slug", "is", null)
      .range(from, to);

    if (stateFilter) {
      query = query.eq("state_slug", stateFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[${jobId}] Error fetching page ${page}:`, error.message);
      break;
    }

    if (data && data.length > 0) {
      allAgents.push(...data);
      console.log(`[${jobId}] Fetched page ${page + 1}: ${data.length} agents (total: ${allAgents.length})`);
    }

    hasMore = data && data.length === pageSize;
    page++;
  }

  return allAgents;
}

async function processAgentProfiles(options: {
  purgeOnly: boolean;
  warmOnly: boolean;
  stateFilter: string | null;
  concurrency: number;
  forceRefresh: boolean;
  jobId: string;
}) {
  const { purgeOnly, warmOnly, stateFilter, concurrency, forceRefresh, jobId } = options;
  
  console.log(`[${jobId}] Starting agent profile cache job...`);
  const startTime = Date.now();

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // Fetch all agents with pagination
  console.log(`[${jobId}] Fetching all active agents...`);
  const agents = await fetchAllAgents(supabase, stateFilter, jobId);

  if (agents.length === 0) {
    console.log(`[${jobId}] No agents found`);
    return;
  }

  console.log(`[${jobId}] Total agents to process: ${agents.length}`);

  // Build URLs and cache keys
  const agentUrls = agents.map((agent: AgentProfile) => 
    `https://www.top10lists.us/${agent.state_slug}/agents/${agent.canonical_slug}`
  );
  
  const cacheKeys = agentUrls.map(urlToCacheKey);

  let totalPurged = 0;
  let totalWarmed = 0;
  let warmSuccessful = 0;
  let warmFailed = 0;

  // Step 1: Purge cache entries
  if (!warmOnly) {
    console.log(`[${jobId}] Purging ${cacheKeys.length} cache keys...`);
    
    const batchSize = 10000;
    
    for (let i = 0; i < cacheKeys.length; i += batchSize) {
      const batch = cacheKeys.slice(i, i + batchSize);
      try {
        const result = await deleteKeysFromKV(batch);
        totalPurged += result.deleted;
        console.log(`[${jobId}] Purge batch ${Math.floor(i / batchSize) + 1}: ${batch.length} keys deleted`);
      } catch (err) {
        console.error(`[${jobId}] Purge batch failed:`, err);
      }
    }
    
    console.log(`[${jobId}] ✅ Purged ${totalPurged} cache keys`);
  }

  // Step 2: Re-warm cache entries
  if (!purgeOnly) {
    console.log(`[${jobId}] Warming ${agentUrls.length} URLs with concurrency ${concurrency}...`);
    
    for (let i = 0; i < agentUrls.length; i += concurrency) {
      const batch = agentUrls.slice(i, i + concurrency);
      const batchNum = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(agentUrls.length / concurrency);
      
      const batchResults = await Promise.all(
        batch.map(url => warmUrl(url, forceRefresh))
      );
      
      totalWarmed += batchResults.length;
      warmSuccessful += batchResults.filter(r => r.success).length;
      warmFailed += batchResults.filter(r => !r.success).length;
      
      // Log progress every 50 batches or at the end
      if (batchNum % 50 === 0 || batchNum === totalBatches) {
        console.log(`[${jobId}] Progress: ${batchNum}/${totalBatches} batches (${warmSuccessful} success, ${warmFailed} failed)`);
      }
      
      // Small delay between batches
      if (i + concurrency < agentUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`[${jobId}] ✅ Warmed ${totalWarmed} URLs (${warmSuccessful} success, ${warmFailed} failed)`);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[${jobId}] ✅ Job completed in ${elapsed}s - Purged: ${totalPurged}, Warmed: ${totalWarmed} (${warmSuccessful} success)`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate credentials
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID || !CLOUDFLARE_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Cloudflare credentials' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { 
      purgeOnly = false,
      warmOnly = false,
      stateFilter = null,
      concurrency = 10,
      forceRefresh = true
    } = body;

    const jobId = crypto.randomUUID().substring(0, 8);
    
    // Run in background using waitUntil
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      processAgentProfiles({
        purgeOnly,
        warmOnly,
        stateFilter,
        concurrency,
        forceRefresh,
        jobId
      })
    );

    // Get quick count for response
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { count } = await supabase
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .not("canonical_slug", "is", null)
      .not("state_slug", "is", null);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Agent profile cache job ${jobId} started in background`,
        job_id: jobId,
        agentCount: count || 0,
        options: { purgeOnly, warmOnly, stateFilter, concurrency, forceRefresh }
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
