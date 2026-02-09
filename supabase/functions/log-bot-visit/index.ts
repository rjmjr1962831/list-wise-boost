import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const payload = await req.json();
    const { 
      url, 
      path,
      user_agent, 
      bot_type: providedBotType,
      cache_status, 
      client_ip,
      country,
      ray_id,
      method,
      timestamp 
    } = payload;
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use provided bot_type if available, otherwise detect
    let finalBotType = providedBotType;
    let isBot = !!providedBotType;
    
    if (!finalBotType) {
      const detected = detectBot(user_agent);
      finalBotType = detected.botType;
      isBot = detected.isBot;
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Extract agent_id from path if it's an agent profile or artifact page
    let agentId: string | null = null;
    const urlPath = path || url;
    
    // Pattern 1: /artifact/{uuid} or /artifact/{uuid}/payload.json or /artifact/{uuid}/justification
    const artifactMatch = urlPath.match(/\/artifact\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (artifactMatch) {
      agentId = artifactMatch[1];
    } else {
      // Pattern 2: /{state}/agents/{slug} - need to look up by canonical_slug
      const agentMatch = urlPath.match(/\/[^\/]+\/agents\/([^\/\?]+)/);
      if (agentMatch) {
        const slug = agentMatch[1];
        // Look up agent by canonical_slug
        const { data: professional } = await supabase
          .from('professionals')
          .select('id')
          .eq('canonical_slug', slug)
          .eq('active', true)
          .single();
        
        if (professional) {
          agentId = professional.id;
        }
      }
    }
    
    const { error } = await supabase
      .from("cloudflare_request_logs")
      .insert({
        timestamp: timestamp || new Date().toISOString(),
        client_ip: client_ip || null,
        user_agent: user_agent || null,
        url: url,
        path: path || url,
        method: method || 'GET',
        cache_status: cache_status || 'UNKNOWN',
        cache_response_status: null,
        country: country || null,
        ray_id: ray_id || null,
        bot_type: finalBotType,
        is_bot: isBot,
        agent_id: agentId,
        raw_log: payload,
      });
    
    if (error && error.code !== '23505') { // Ignore duplicate errors
      console.error("Insert error:", error);
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Error:", errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
