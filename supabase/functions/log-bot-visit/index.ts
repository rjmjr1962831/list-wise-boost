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

const STATE_SLUG_TO_ABBR: Record<string, string> = {
  arizona: "AZ", california: "CA", texas: "TX", florida: "FL",
  "new-york": "NY", colorado: "CO",
};

const STATE_SLUG_TO_VALUES: Record<string, string[]> = {
  arizona: ["AZ", "Arizona"], california: ["CA", "California"], texas: ["TX", "Texas"],
  florida: ["FL", "Florida"], "new-york": ["NY", "New York"], colorado: ["CO", "Colorado"],
};

function getPathSegments(pathOrUrl: string): string[] {
  let path = pathOrUrl;
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname;
    }
  } catch (_) {}
  return path.split("/").filter(Boolean);
}

interface ListPageContext {
  list_page_type: "city" | "neighborhood";
  location_display: string;
  agents_shown: { canonical_slug: string; name: string }[];
}

async function resolveListPageContext(
  pathOrUrl: string,
  supabase: ReturnType<typeof createClient>
): Promise<ListPageContext | null> {
  const seg = getPathSegments(pathOrUrl);
  if (seg.length < 2) return null;

  // City list: /state/city or /state/city/top10realestateagents
  const isCityList =
    (seg.length === 2) ||
    (seg.length === 3 && seg[2] === "top10realestateagents");
  if (isCityList) {
    const stateSlug = seg[0];
    const citySlug = seg[1];
    const { data: city, error: cityErr } = await supabase
      .from("cities")
      .select("id, name, state_slug")
      .eq("state_slug", stateSlug)
      .eq("slug", citySlug)
      .eq("active", true)
      .maybeSingle();
    if (cityErr || !city) return null;
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", "top10realestateagents")
      .maybeSingle();
    if (!cat) return null;
    const { data: profs } = await supabase
      .from("professionals")
      .select("canonical_slug, name")
      .eq("city_id", city.id)
      .eq("category_id", cat.id)
      .eq("active", true)
      .gte("review_stars_rating", 4.5)
      .gte("num_total_reviews", 10)
      .order("is_brand_builder", { ascending: false, nullsFirst: false })
      .order("rank", { ascending: true })
      .order("name", { ascending: true })
      .limit(50);
    if (!profs || profs.length === 0) return null;
    const abbr = STATE_SLUG_TO_ABBR[stateSlug] || stateSlug.toUpperCase();
    return {
      list_page_type: "city",
      location_display: `${city.name}, ${abbr}`,
      agents_shown: profs.map((p: any) => ({
        canonical_slug: p.canonical_slug || "",
        name: p.name || "",
      })),
    };
  }

  // Neighborhood list: canonical /state/city/neighborhood/top10realestateagents (4 seg); legacy 5-seg with zip redirects
  const isNeighborhood5 =
    seg.length === 5 && seg[4] === "top10realestateagents";
  const isNeighborhood4 =
    seg.length === 4 && seg[3] === "top10realestateagents";
  if (!isNeighborhood5 && !isNeighborhood4) return null;

  let hoodQuery = supabase
    .from("neighborhood_catalog")
    .select("id, neighborhood, city_area, state")
    .eq("city_area_slug", seg[1])
    .eq("neighborhood_slug", isNeighborhood5 ? seg[3] : seg[2])
    .eq("is_active", true);
  if (isNeighborhood5) {
    hoodQuery = hoodQuery.eq("primary_zip", seg[2]);
  }
  const stateValues = STATE_SLUG_TO_VALUES[seg[0]] || [STATE_SLUG_TO_ABBR[seg[0]] || seg[0]];
  hoodQuery = hoodQuery.in("state", stateValues);
  const { data: hood, error: hoodErr } = await hoodQuery.maybeSingle();
  if (hoodErr || !hood) return null;

  const expertIds = new Set<string>();
  const agentsShown: { canonical_slug: string; name: string }[] = [];
  const { data: subs } = await supabase
    .from("agent_neighborhood_subscriptions")
    .select("professional_id, professionals(canonical_slug, name)")
    .eq("neighborhood_id", hood.id)
    .eq("is_active", true);
  if (subs) {
    for (const sub of subs) {
      const p = (sub as any).professionals;
      if (p && p.canonical_slug) {
        expertIds.add((sub as any).professional_id);
        agentsShown.push({ canonical_slug: p.canonical_slug, name: p.name || "" });
      }
    }
  }
  const { data: activeAgents } = await supabase.rpc("get_neighborhood_active_agents", {
    p_neighborhood_id: hood.id,
  });
  if (Array.isArray(activeAgents)) {
    for (const row of activeAgents) {
      const id = (row as any).professional_id;
      if (id && !expertIds.has(id) && agentsShown.length < 50) {
        agentsShown.push({
          canonical_slug: (row as any).canonical_slug || "",
          name: (row as any).agent_name || "",
        });
      }
    }
  }
  if (agentsShown.length === 0) return null;
  const abbr = typeof hood.state === "string" && hood.state.length === 2 ? hood.state : STATE_SLUG_TO_ABBR[seg[0]] || "?";
  return {
    list_page_type: "neighborhood",
    location_display: `${hood.neighborhood}, ${hood.city_area}, ${abbr}`,
    agents_shown: agentsShown.slice(0, 50),
  };
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
      host: payloadHost,
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

    let list_page_type: string | null = null;
    let location_display: string | null = null;
    let agents_shown: ListPageContext["agents_shown"] | null = null;
    if (isBot && urlPath) {
      try {
        const ctx = await resolveListPageContext(urlPath, supabase);
        if (ctx) {
          list_page_type = ctx.list_page_type;
          location_display = ctx.location_display;
          agents_shown = ctx.agents_shown;
        }
      } catch (e) {
        console.warn("List page resolve failed:", e);
      }
    }
    
    // host omitted from insert until migration 20260214 adds column; url used for www filter
    const row: Record<string, unknown> = {
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
      list_page_type,
      location_display,
      agents_shown: agents_shown ?? null,
      raw_log: payload,
    };

    const { error } = ray_id
      ? await supabase.from("cloudflare_request_logs").upsert(row, { onConflict: "ray_id" })
      : await supabase.from("cloudflare_request_logs").insert(row);

    if (error && error.code !== "23505") {
      console.error("Insert error:", error);
      const errorMsg = error.message || JSON.stringify(error);
      return new Response(
        JSON.stringify({ success: false, error: `Database error: ${errorMsg}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List pages: we only insert the single row with agents_shown. A batch job (process-list-page-logs)
    // creates per-agent rows and sets list_page_processed_at so each agent gets credit at scale.

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in log-bot-visit:", error);
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(
      JSON.stringify({ success: false, error: `Catch error: ${errMsg}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
