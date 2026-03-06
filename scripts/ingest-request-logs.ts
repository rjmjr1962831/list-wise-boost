/**
 * Ingest request logs into cloudflare_request_logs (no Cloudflare required).
 * Uses your log file; the DB trigger still updates agent_bot_visit_summary.
 *
 * Log format: JSON Lines (.jsonl) or one JSON array. Each entry:
 *   - url or path (required) — profile, artifact, city list, or neighborhood list
 *   - user_agent (optional) — used to detect bot and set bot_type
 *   - timestamp (optional) — ISO string; default now()
 *   - cache_status, ray_id, client_ip, country, method (optional)
 *   - bot_type (optional) — if set, used as-is; otherwise derived from user_agent
 *
 * URLs that count for agents:
 *   - Full profile: /state/city/agents/slug
 *   - Artifact: /artifact/{uuid}
 *   - City list (e.g. Phoenix): /arizona/phoenix or /arizona/phoenix/top10realestateagents → each agent on the page gets credit
 *   - Neighborhood list (e.g. Arcadia): /arizona/phoenix/arcadia/top10realestateagents → each agent shown gets credit
 *
 * Run: npx tsx scripts/ingest-request-logs.ts <path-to-logs.jsonl>
 *   or: npx tsx scripts/ingest-request-logs.ts <path-to-logs.json>   (single JSON array)
 *
 * Example .jsonl line (city list):
 *   {"path":"/arizona/phoenix/top10realestateagents","user_agent":"Mozilla/5.0 (compatible; Googlebot/2.1)","timestamp":"2026-03-06T12:00:00Z"}
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function loadEnv(): void {
  try {
    const env = readFileSync(".env", "utf-8");
    for (const line of env.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      )
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  } catch {
    /* no .env */
  }
}
loadEnv();

const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://wiotrvoirdgzfacuuiem.supabase.co";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!key) {
  console.error("Need SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env");
  process.exit(1);
}

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
  } catch {
    /* keep as-is */
  }
  return path;
}

const STATE_SLUG_TO_ABBR: Record<string, string> = {
  arizona: "AZ",
  california: "CA",
  texas: "TX",
  florida: "FL",
  "new-york": "NY",
  colorado: "CO",
};

const STATE_SLUG_TO_VALUES: Record<string, string[]> = {
  arizona: ["AZ", "Arizona"],
  california: ["CA", "California"],
  texas: ["TX", "Texas"],
  florida: ["FL", "Florida"],
  "new-york": ["NY", "New York"],
  colorado: ["CO", "Colorado"],
};

function getPathSegments(pathOrUrl: string): string[] {
  const path = getPath(pathOrUrl);
  return path.split("/").filter(Boolean);
}

/** Single agent: profile or artifact URL. */
async function resolveAgentId(
  pathOrUrl: string,
  supabase: SupabaseClient
): Promise<string | null> {
  const path = getPath(pathOrUrl);

  const artifactMatch = path.match(
    /\/artifact\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
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

/** List page (city or neighborhood): return context for one row; batch job creates per-agent rows later. */
async function resolveListPageContext(
  pathOrUrl: string,
  supabase: SupabaseClient
): Promise<ListPageContext | null> {
  const seg = getPathSegments(pathOrUrl);
  if (seg.length < 2) return null;

  // City list: /state/city or /state/city/top10realestateagents
  const isCityList =
    seg.length === 2 || (seg.length === 3 && seg[2] === "top10realestateagents");
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
      .limit(50);
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

  // Neighborhood: 4 or 5 seg
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

function parseLogEntries(filePath: string): LogEntry[] {
  const raw = readFileSync(filePath, "utf-8").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const first = lines[0].trim();
  if (first.startsWith("[")) {
    const arr = JSON.parse(raw) as LogEntry[];
    return Array.isArray(arr) ? arr : [];
  }

  const entries: LogEntry[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as LogEntry;
      if (obj && (obj.url != null || obj.path != null)) entries.push(obj);
    } catch {
      /* skip bad line */
    }
  }
  return entries;
}

const BATCH = 100;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/ingest-request-logs.ts <path-to-logs.jsonl or .json>");
    process.exit(1);
  }

  const entries = parseLogEntries(filePath);
  console.log(`Read ${entries.length} log entries from ${filePath}`);

  const supabase = createClient(url, key);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH);
    const rows: Record<string, unknown>[] = [];

    for (const e of chunk) {
      const pathOrUrl = e.url ?? e.path;
      if (!pathOrUrl) {
        skipped++;
        continue;
      }
      const path = getPath(pathOrUrl);
      const urlStr = pathOrUrl.startsWith("http") ? pathOrUrl : `https://www.top10lists.us${path.startsWith("/") ? path : "/" + path}`;

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
      console.error(`Batch ${i / BATCH + 1} insert error:`, error.message);
      errors += rows.length;
    } else {
      inserted += rows.length;
    }
  }

  console.log(`Done. Inserted: ${inserted}, skipped: ${skipped}, errors: ${errors}`);
}

main();
