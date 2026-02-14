import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLOUDFLARE_ZONE_ID = Deno.env.get("CLOUDFLARE_ZONE_ID")!;
const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Bot detection patterns - MUST match cloudflareworker.js and cloudflare-logpush
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
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
    return { isBot: true, botType: "unknown_bot" };
  }
  return { isBot: false, botType: null };
}

// Fields needed for bot detection and analytics (same as Logpush)
const LOGPULL_FIELDS = [
  "ClientIP",
  "ClientRequestUserAgent",
  "ClientRequestURI",
  "ClientRequestHost",
  "ClientRequestMethod",
  "EdgeStartTimestamp",
  "RayID",
  "ClientCountry",
  "CacheResponseStatus",
  "CacheCacheStatus",
  "EdgeResponseStatus",
].join(",");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error("Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN. Set via Supabase secrets.");
    }

    console.log("🔄 Starting Cloudflare Logpull...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch last hour: end = now - 5 min (Logpull requires end ≥ 5 min ago), start = end - 1 hour (max range)
    const endTime = new Date(Date.now() - 6 * 60 * 1000); // 6 min ago to be safe
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour before end

    const startRfc = startTime.toISOString();
    const endRfc = endTime.toISOString();

    const url = new URL(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/logs/received`);
    url.searchParams.set("start", startRfc);
    url.searchParams.set("end", endRfc);
    url.searchParams.set("fields", LOGPULL_FIELDS);
    url.searchParams.set("timestamps", "rfc3339");

    console.log(`Fetching logs from ${startRfc} to ${endRfc}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Cloudflare Logpull API error: ${response.status}`, text);
      throw new Error(`Cloudflare API ${response.status}: ${text.slice(0, 200)}`);
    }

    const body = await response.text();
    const lines = body.trim().split("\n").filter((l) => l.length > 0);

    console.log(`📊 Received ${lines.length} log lines from Cloudflare`);

    if (lines.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No logs in time range",
          timeRange: { start: startRfc, end: endRfc },
          inserted: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const logsToInsert: Record<string, unknown>[] = [];

    for (const line of lines) {
      try {
        const log = JSON.parse(line);

        const userAgent = log.ClientRequestUserAgent ?? null;
        const urlVal = log.ClientRequestURI ?? log.ClientRequestPath ?? null;
        const host = log.ClientRequestHost ?? "example.com";

        let path: string | null = null;
        if (urlVal) {
          try {
            const fullUrl = urlVal.startsWith("/") ? `https://${host}${urlVal}` : urlVal;
            path = new URL(fullUrl).pathname;
          } catch {
            path = typeof urlVal === "string" ? urlVal : null;
          }
        }

        let timestamp: string;
        if (log.EdgeStartTimestamp != null) {
          if (typeof log.EdgeStartTimestamp === "number") {
            // Unix nano (default) or unix seconds
            const ms = log.EdgeStartTimestamp >= 1e15 ? log.EdgeStartTimestamp / 1e6 : log.EdgeStartTimestamp * 1000;
            timestamp = new Date(ms).toISOString();
          } else {
            timestamp = String(log.EdgeStartTimestamp);
          }
        } else {
          timestamp = new Date().toISOString();
        }

        const { isBot, botType } = detectBot(userAgent);

        let cacheStatus = "UNKNOWN";
        if (log.CacheCacheStatus) {
          const s = String(log.CacheCacheStatus).toLowerCase();
          cacheStatus = s === "hit" ? "HIT" : s === "miss" || s === "expired" || s === "dynamic" ? "MISS" : s.toUpperCase();
        } else if (log.CacheResponseStatus != null) {
          cacheStatus = Number(log.CacheResponseStatus) > 0 ? "HIT" : "MISS";
        }

        // RayID may include IATA suffix (e.g. 49ddb3e70e665831-DFW) - use as-is for dedup
        const rayId = log.RayID != null ? String(log.RayID) : null;

        logsToInsert.push({
          timestamp,
          client_ip: log.ClientIP ?? null,
          user_agent: userAgent,
          url: urlVal ? (urlVal.startsWith("http") ? urlVal : `https://${host}${urlVal}`) : null,
          path,
          method: log.ClientRequestMethod ?? null,
          cache_status: cacheStatus,
          cache_response_status: log.CacheResponseStatus ?? null,
          country: log.ClientCountry ?? null,
          ray_id: rayId,
          bot_type: botType,
          is_bot: isBot,
          host: host !== "example.com" ? host : null,
          raw_log: log,
        });
      } catch (parseErr) {
        console.warn("Parse error for line:", parseErr);
      }
    }

    if (logsToInsert.length > 0) {
      // Use upsert with ignoreDuplicates to skip rows that already exist (from log-bot-visit or prior run)
      const { error } = await supabase
        .from("cloudflare_request_logs")
        .upsert(logsToInsert, { onConflict: "ray_id", ignoreDuplicates: true });

      if (error) {
        throw error;
      }
    }

    const botCount = logsToInsert.filter((l) => l.is_bot).length;
    console.log(`✅ Processed ${logsToInsert.length} logs (${botCount} bots)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${lines.length} logs`,
        processed: logsToInsert.length,
        bot_requests: botCount,
        timeRange: { start: startRfc, end: endRfc },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Logpull error:", errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
