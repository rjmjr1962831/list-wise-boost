/**
 * Batch ingest request logs into cloudflare_request_logs (Option 2: ingest from log files).
 * POST body: { "entries": LogEntry[] } or a raw array LogEntry[].
 * Each entry: path or url (required), user_agent, timestamp, cache_status, ray_id, client_ip, country, method, bot_type (optional).
 * Same resolution as log-bot-visit and scripts/ingest-request-logs.ts; DB trigger updates agent_bot_visit_summary.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    if (pattern.test(ua)) return { isBot: true, botType: botName };
  }
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
    return { isBot: true, botType: "unknown_bot" };
  }
  return { isBot: false, botType: null };
}

function getPath(urlOrPath: string): string {
  let path = urlOrPath;
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname;
    }
  } catch (_) {}
  return path;
}

function getPathSegments(pathOrUrl: string): string[] {
  return getPath(pathOrUrl).split("/").filter(Boolean);
}

const STATE_SLUG_TO_ABBR: Record<string, string> = {
  arizona: "AZ", california: "CA", texas: "TX", florida: "FL",
  "new-york": "NY", colorado: "CO",
};

const STATE_SLUG_TO_VALUES: Record<string, string[]> = {
  arizona: ["AZ", "Arizona"], california: ["CA", "California"], texas: ["TX", "Texas"],
  florida: ["FL", "Florida"], "new-york": ["NY", "New York"], colorado: ["CO", "Colorado"],
};

type SupabaseClient = ReturnType<typeof createClient>;

async function resolveAgentId(pathOrUrl: string, supabase: SupabaseClient): Promise<string | null> {
  const path = getPath(pathOrUrl);
  const artifactMatch = path.match(/\/artifact\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (artifactMatch) return artifactMatch[1];
  const agentMatch = path.match(/\/[^/]+\/agents\/([^/?#]+)/);
  if (agentMatch) {
    const slug = agentMatch[1];
    const { data } = await supabase
      .from("professionals")
      .select("id")
      .eq("canonical_slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

interface ListPageContext {
  list_page_type: "city" | "neighborhood";
  location_display: string;
  agents_shown: { canonical_slug: string; name: string }[];
}

async function resolveListPageContext(pathOrUrl: string, supabase: SupabaseClient): Promise<ListPageContext | null> {
  const seg = getPathSegments(pathOrUrl);
  if (seg.length < 2) return null;

  const isCityList = seg.length === 2 || (seg.length === 3 && seg[2] === "top10realestateagents");
  if (isCityList) {
    const { data: city } = await supabase
      .from("cities")
      .select("id, name")
      .eq("state_slug", seg[0])
      .eq("slug", seg[1])
      .eq("active", true)
      .maybeSingle();
    if (!city) return null;
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
      .limit(1000);
    if (!profs?.length) return null;
    const abbr = STATE_SLUG_TO_ABBR[seg[0]] || seg[0].toUpperCase();
    return {
      list_page_type: "city",
      location_display: `${(city as { name?: string }).name}, ${abbr}`,
      agents_shown: profs.map((p: { canonical_slug?: string; name?: string }) => ({
        canonical_slug: p.canonical_slug || "",
        name: p.name || "",
      })),
    };
  }

  const isNeighborhood5 = seg.length === 5 && seg[4] === "top10realestateagents";
  const isNeighborhood4 = seg.length === 4 && seg[3] === "top10realestateagents";
  if (!isNeighborhood5 && !isNeighborhood4) return null;

  let hoodQuery = supabase
    .from("neighborhood_catalog")
    .select("id, neighborhood, city_area, state")
    .eq("city_area_slug", seg[1])
    .eq("neighborhood_slug", isNeighborhood5 ? seg[3] : seg[2])
    .eq("is_active", true);
  if (isNeighborhood5) hoodQuery = hoodQuery.eq("primary_zip", seg[2]);
  const stateVals = STATE_SLUG_TO_VALUES[seg[0]] || [STATE_SLUG_TO_ABBR[seg[0]] || seg[0]];
  hoodQuery = hoodQuery.in("state", stateVals);
  const { data: hood } = await hoodQuery.maybeSingle();
  if (!hood) return null;

  const agentsShown: { canonical_slug: string; name: string }[] = [];
  const seen = new Set<string>();
  const { data: subs } = await supabase
    .from("agent_neighborhood_subscriptions")
    .select("professional_id, professionals(canonical_slug, name)")
    .eq("neighborhood_id", hood.id)
    .eq("is_active", true);
  if (subs) {
    for (const s of subs) {
      const p = (s as { professionals?: { canonical_slug?: string; name?: string } }).professionals;
      const id = (s as { professional_id: string }).professional_id;
      if (p?.canonical_slug && !seen.has(id)) {
        seen.add(id);
        agentsShown.push({ canonical_slug: p.canonical_slug, name: p.name || "" });
      }
    }
  }
  const { data: activeAgents } = await supabase.rpc("get_neighborhood_active_agents", {
    p_neighborhood_id: hood.id,
  });
  if (Array.isArray(activeAgents)) {
    for (const row of activeAgents) {
      const id = (row as { professional_id?: string }).professional_id;
      const slug = (row as { canonical_slug?: string }).canonical_slug;
      const name = (row as { agent_name?: string }).agent_name;
      if (id && slug && !seen.has(id) && agentsShown.length < 1000) {
        seen.add(id);
        agentsShown.push({ canonical_slug: slug, name: name || "" });
      }
    }
  }
  if (agentsShown.length === 0) return null;
  const h = hood as { neighborhood?: string; city_area?: string; state?: string };
  const abbr = typeof h.state === "string" && h.state.length === 2 ? h.state : STATE_SLUG_TO_ABBR[seg[0]] || "?";
  return {
    list_page_type: "neighborhood",
    location_display: `${h.neighborhood}, ${h.city_area}, ${abbr}`,
    agents_shown: agentsShown.slice(0, 1000),
  };
}

interface LogEntry {
  url?: string;
  path?: string;
  user_agent?: string;
  timestamp?: string;
  cache_status?: string;
  ray_id?: string;
  client_ip?: string;
  country?: string;
  method?: string;
  bot_type?: string;
  [key: string]: unknown;
}

const BATCH_SIZE = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const rawEntries = Array.isArray(body) ? body : body?.entries;
    if (!Array.isArray(rawEntries)) {
      return new Response(
        JSON.stringify({ success: false, error: "Body must be { entries: LogEntry[] } or LogEntry[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const entries = rawEntries.filter(
      (e: unknown): e is LogEntry => e != null && typeof e === "object" && ("url" in e || "path" in e)
    );

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const rows: Record<string, unknown>[] = [];

      for (const e of chunk) {
        const pathOrUrl = e.url ?? e.path;
        if (!pathOrUrl) {
          skipped++;
          continue;
        }
        const path = getPath(pathOrUrl);
        const urlStr =
          pathOrUrl.startsWith("http") ? pathOrUrl : `https://www.top10lists.us${path.startsWith("/") ? path : "/" + path}`;

        let isBot = !!e.bot_type;
        let botType = e.bot_type ?? null;
        if (!botType) {
          const d = detectBot(e.user_agent ?? null);
          isBot = d.isBot;
          botType = d.botType;
        }

        const base = {
          timestamp: e.timestamp || new Date().toISOString(),
          client_ip: e.client_ip ?? null,
          user_agent: e.user_agent ?? null,
          url: urlStr,
          path,
          method: e.method ?? "GET",
          cache_status: e.cache_status ?? "UNKNOWN",
          cache_response_status: null,
          country: e.country ?? null,
          ray_id: e.ray_id ?? null,
          bot_type: botType,
          is_bot: isBot,
          raw_log: e,
        };

        const singleAgentId = isBot ? await resolveAgentId(pathOrUrl, supabase) : null;
        if (singleAgentId) {
          rows.push({ ...base, agent_id: singleAgentId });
          continue;
        }
        if (isBot) {
          const listCtx = await resolveListPageContext(pathOrUrl, supabase);
          if (listCtx?.agents_shown?.length) {
            rows.push({
              ...base,
              agent_id: null,
              list_page_type: listCtx.list_page_type,
              location_display: listCtx.location_display,
              agents_shown: listCtx.agents_shown,
            });
            continue;
          }
        }
        rows.push({ ...base, agent_id: null });
      }

      if (rows.length === 0) continue;

      const { error } = await supabase.from("cloudflare_request_logs").insert(rows);
      if (error) {
        console.error("Batch insert error:", error.message);
        errors += rows.length;
      } else {
        inserted += rows.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        skipped,
        errors,
        total: entries.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ingest-request-logs error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
