import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Bot detection patterns
const BOT_PATTERNS: Record<string, RegExp> = {
  googlebot: /googlebot|google-inspectiontool|googleother/i,
  claudebot: /claudebot|claude-web|anthropic-ai/i,
  gptbot: /gptbot|chatgpt-user|oai-searchbot/i,
  bingbot: /bingbot|msnbot/i,
  perplexitybot: /perplexitybot/i,
  slurp: /slurp/i, // Yahoo
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
  
  // Generic bot detection
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
    return { isBot: true, botType: 'unknown_bot' };
  }
  
  return { isBot: false, botType: null };
}

interface CloudflareLogEntry {
  ClientIP?: string;
  ClientRequestHost?: string;
  ClientRequestMethod?: string;
  ClientRequestURI?: string;
  ClientRequestUserAgent?: string;
  EdgeResponseStatus?: number;
  EdgeStartTimestamp?: number;
  RayID?: string;
  ClientCountry?: string;
  CacheResponseStatus?: number;
  OriginResponseStatus?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Cloudflare sends logs as newline-delimited JSON
    const body = await req.text();
    const logLines = body.trim().split('\n').filter(line => line.length > 0);
    
    if (logLines.length === 0) {
      console.log("No logs in request body");
      return new Response(
        JSON.stringify({ success: true, message: "No logs to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${logLines.length} log entries...`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const logsToInsert = [];

    for (const line of logLines) {
      try {
        const log: CloudflareLogEntry = JSON.parse(line);
        
        // Extract key fields
        const userAgent = log.ClientRequestUserAgent || null;
        const url = log.ClientRequestURI || null;
        const timestamp = log.EdgeStartTimestamp 
          ? new Date(log.EdgeStartTimestamp / 1000000).toISOString() // Cloudflare timestamps are in nanoseconds
          : new Date().toISOString();
        
        // Parse URL path
        let path = null;
        if (url) {
          try {
            const urlObj = new URL(url, `https://${log.ClientRequestHost || 'example.com'}`);
            path = urlObj.pathname;
          } catch {
            path = url;
          }
        }
        
        // Detect bot
        const { isBot, botType } = detectBot(userAgent);
        
        // Determine cache status
        let cacheStatus = 'UNKNOWN';
        if (log.CacheResponseStatus) {
          cacheStatus = log.CacheResponseStatus > 0 ? 'HIT' : 'MISS';
        }
        
        logsToInsert.push({
          timestamp,
          client_ip: log.ClientIP || null,
          user_agent: userAgent,
          url: url,
          path: path,
          method: log.ClientRequestMethod || null,
          cache_status: cacheStatus,
          cache_response_status: log.CacheResponseStatus || null,
          country: log.ClientCountry || null,
          ray_id: log.RayID || null,
          bot_type: botType,
          is_bot: isBot,
          raw_log: log,
        });
      } catch (parseError) {
        console.error("Error parsing log line:", parseError);
        // Continue processing other logs
      }
    }

    if (logsToInsert.length === 0) {
      console.log("No valid logs to insert");
      return new Response(
        JSON.stringify({ success: true, message: "No valid logs to insert" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch insert logs
    const { data, error } = await supabase
      .from("cloudflare_request_logs")
      .insert(logsToInsert);

    if (error) {
      console.error("Supabase insert error:", error);
      
      // If it's a unique constraint violation (duplicate ray_id), that's okay
      if (error.code === '23505') {
        console.log("Some logs already exist (duplicate ray_id), skipping...");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Logs processed (some duplicates skipped)",
            processed: logsToInsert.length
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw error;
    }

    const botLogs = logsToInsert.filter(log => log.is_bot);
    
    console.log(`✅ Inserted ${logsToInsert.length} logs (${botLogs.length} bots)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${logsToInsert.length} logs`,
        bot_requests: botLogs.length,
        bot_types: [...new Set(botLogs.map(l => l.bot_type))],
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
