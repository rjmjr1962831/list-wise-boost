import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLOUDFLARE_ZONE_ID = Deno.env.get("CLOUDFLARE_ZONE_ID")!;
const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Bot detection patterns
const BOT_PATTERNS: Record<string, RegExp> = {
  googlebot: /googlebot|google-inspectiontool|googleother/i,
  claudebot: /claudebot|claude-web|anthropic-ai/i,
  gptbot: /gptbot|chatgpt-user|oai-searchbot/i,
  bingbot: /bingbot|msnbot/i,
  perplexitybot: /perplexitybot/i,
  slurp: /slurp/i,
  duckduckbot: /duckduckbot/i,
  baiduspider: /baiduspider/i,
  yandexbot: /yandexbot/i,
  facebookbot: /facebookexternalhit/i,
  twitterbot: /twitterbot/i,
  linkedinbot: /linkedinbot/i,
};

function detectBot(userAgent: string | null): { isBot: boolean; botType: string | null } {
  if (!userAgent) return { isBot: false, botType: null };
  
  const ua = userAgent.toLowerCase();
  
  for (const [botName, pattern] of Object.entries(BOT_PATTERNS)) {
    if (pattern.test(ua)) {
      return { isBot: true, botType: botName };
    }
  }
  
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
    return { isBot: true, botType: 'unknown_bot' };
  }
  
  return { isBot: false, botType: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔄 Starting Cloudflare Logpull...");
    
    // Debug: Log environment variables
    console.log("Debug - CLOUDFLARE_ZONE_ID:", CLOUDFLARE_ZONE_ID);
    console.log("Debug - CLOUDFLARE_API_TOKEN:", CLOUDFLARE_API_TOKEN ? "Present (redacted)" : "Missing");
    console.log("Debug - Available env vars:", Object.keys(Deno.env.toObject()).filter(k => k.includes('CLOUDFLARE')));
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get the timestamp of the last log we fetched
    const { data: lastLog } = await supabase
      .from("cloudflare_request_logs")
      .select("timestamp")
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();
    
    // Default to 1 hour ago if no logs exist (Cloudflare Logpull max range is 1 hour)
    let startTime = lastLog 
      ? new Date(lastLog.timestamp)
      : new Date(Date.now() - 60 * 60 * 1000);
    
    // End time must be at least 1 minute in the past
    const endTime = new Date(Date.now() - 60 * 1000);
    
    // Ensure we don't exceed 1 hour range
    const maxStartTime = new Date(endTime.getTime() - 60 * 60 * 1000);
    if (startTime < maxStartTime) {
      startTime = maxStartTime;
    }
    
    console.log(`Fetching logs from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    
    // Use Cloudflare GraphQL Analytics API (available on Pro plans)
    const startUnix = Math.floor(startTime.getTime() / 1000);
    const endUnix = Math.floor(endTime.getTime() / 1000);
    
    const graphqlQuery = `
      query {
        viewer {
          zones(filter: { zoneTag: "${CLOUDFLARE_ZONE_ID}" }) {
            httpRequests1mGroups(
              limit: 10000,
              filter: {
                datetime_geq: "${startTime.toISOString()}",
                datetime_lt: "${endTime.toISOString()}"
              }
            ) {
              sum {
                requests
              }
              dimensions {
                datetime
                clientRequestHTTPHost
                clientRequestPath
                clientRequestHTTPMethodName
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: graphqlQuery }),
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`Cloudflare API error: ${response.status}`);
      console.error(`Response: ${responseText}`);
      throw new Error(`Cloudflare API error: ${response.status} - ${responseText}`);
    }
    
    const graphqlData = JSON.parse(responseText);
    
    if (graphqlData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(graphqlData.errors)}`);
    }
    
    const httpRequests = graphqlData.data?.viewer?.zones?.[0]?.httpRequests1mGroups || [];
    
    console.log(`📊 Received ${httpRequests.length} request groups from Cloudflare`);
    
    if (httpRequests.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No new logs to process",
          timeRange: { start: startTime.toISOString(), end: endTime.toISOString() }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const logsToInsert = [];
    
    for (const request of httpRequests) {
      const dims = request.dimensions;
      const userAgent = null; // Not available in aggregated data
      const url = dims.clientRequestPath || null;
      const timestamp = dims.datetime || new Date().toISOString();
      
      // Can't detect bots without user agent
      const { isBot, botType } = { isBot: false, botType: null };
      
      logsToInsert.push({
        timestamp,
        client_ip: null,
        user_agent: null,
        url: `https://${dims.clientRequestHTTPHost || ''}${url || ''}`,
        path: url,
        method: dims.clientRequestHTTPMethodName || null,
        cache_status: 'UNKNOWN', // Not available in this dataset
        cache_response_status: null,
        country: null,
        ray_id: null,
        bot_type: null,
        is_bot: false,
        raw_log: request,
      });
    }
    
    if (logsToInsert.length > 0) {
      const { error } = await supabase
        .from("cloudflare_request_logs")
        .insert(logsToInsert);
      
      if (error && error.code !== '23505') {
        throw error;
      }
    }
    
    const botLogs = logsToInsert.filter(log => log.is_bot);
    console.log(`✅ Inserted ${logsToInsert.length} logs (${botLogs.length} bots)`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${logsToInsert.length} logs`,
        bot_requests: botLogs.length,
        bot_types: [...new Set(botLogs.map(l => l.bot_type))],
        timeRange: { start: startTime.toISOString(), end: endTime.toISOString() }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Error:", errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
