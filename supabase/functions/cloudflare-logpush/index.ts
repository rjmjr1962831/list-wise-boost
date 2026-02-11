import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

// Simple shared secret for Cloudflare - no JWT required
const LOGPUSH_SECRET = "t10l_logpush_2026";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Bot detection patterns - MUST match cloudflareworker.js botPatterns for consistent detection
const BOT_PATTERNS: Record<string, RegExp> = {
  googlebot: /googlebot|google-inspectiontool|googleother|adsbot-google/i,
  claudebot: /claudebot|claude-web|anthropic-ai/i,
  gptbot: /gptbot|chatgpt-user|oai-searchbot/i,
  bingbot: /bingbot|msnbot/i,
  perplexitybot: /perplexitybot/i,
  metabot: /meta-externalagent|facebookexternalhit|facebookbot/i,
  amazonbot: /amazonbot/i,
  bytespider: /bytespider/i,
  semrushbot: /semrushbot/i,
  ahrefsbot: /ahrefsbot/i,
  slurp: /slurp/i,
  duckduckbot: /duckduckbot/i,
  baiduspider: /baiduspider/i,
  yandexbot: /yandexbot/i,
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
  // Always allow OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Check secret in URL or header
  const url = new URL(req.url);
  const secretFromUrl = url.searchParams.get("secret");
  const secretFromHeader = req.headers.get("X-Logpush-Secret");
  const secret = secretFromUrl || secretFromHeader;

  // Validate secret
  if (secret !== LOGPUSH_SECRET) {
    console.log(`[Unauthorized] Missing or invalid secret`);
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized - Invalid or missing secret" }),
      { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // Handle GET for Cloudflare validation
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Cloudflare Logpush endpoint ready",
        service: "top10lists-bot-analytics"
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // Handle POST - process logs
  if (req.method === "POST") {
    try {
      const body = await req.text();
      const logLines = body.trim().split('\n').filter(line => line.length > 0);
      
      if (logLines.length === 0) {
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
          const log = JSON.parse(line);
          
          const userAgent = log.ClientRequestUserAgent || null;
          const url = log.ClientRequestURI || null;
          const timestamp = log.EdgeStartTimestamp 
            ? new Date(log.EdgeStartTimestamp / 1000000).toISOString()
            : new Date().toISOString();
          
          let path = null;
          if (url) {
            try {
              const urlObj = new URL(url, `https://${log.ClientRequestHost || 'example.com'}`);
              path = urlObj.pathname;
            } catch {
              path = url;
            }
          }
          
          const { isBot, botType } = detectBot(userAgent);
          
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
        }
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
  }

  // Method not allowed
  return new Response(
    JSON.stringify({ success: false, error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
