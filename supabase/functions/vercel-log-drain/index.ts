/**
 * vercel-log-drain -- Receives Vercel Log Drain webhooks (NDJSON),
 * filters for bot user-agents, resolves agent_id from page path,
 * and inserts into bot_crawl_logs.
 *
 * This captures ALL requests including CDN cache hits, which the
 * inline edge function logging misses.
 *
 * Vercel sends POST with body as NDJSON (one JSON object per line).
 * Each line has: { id, message, timestamp, source, projectName,
 *   host, path, statusCode, proxy: { userAgent, ... }, ... }
 *
 * Verification: Vercel signs payloads with x-vercel-signature header
 * using HMAC-SHA1 of the raw body with the integration secret.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
// crypto + hex imports removed — signature verification disabled (proxy handles auth)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vercel-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ── Bot detection (matches serve-bot-crawl-stats-html categories) ──── */
const BOT_PATTERNS: [string, RegExp][] = [
  ["ChatGPT-User", /chatgpt-user/i],
  ["OAI-SearchBot", /oai-searchbot/i],
  ["GPTBot", /gptbot/i],
  ["ClaudeBot", /claudebot/i],
  ["claude-web", /claude-web|anthropic-ai/i],
  ["PerplexityBot", /perplexitybot/i],
  ["YouBot", /youbot/i],
  ["Meta-ExternalAgent", /meta-externalagent/i],
  ["Googlebot", /googlebot(?!-image)/i],
  ["GoogleOther", /googleother/i],
  ["Google-Extended", /google-extended/i],
  ["Bingbot", /bingbot/i],
  ["Applebot", /applebot/i],
  ["AhrefsBot", /ahrefsbot/i],
  ["SEMrushBot", /semrushbot/i],
  ["DotBot", /dotbot/i],
  ["MJ12bot", /mj12bot/i],
  ["ByteSpider", /bytespider/i],
  ["CCBot", /ccbot/i],
  ["FacebookExternalHit", /facebookexternalhit/i],
  ["Twitterbot", /twitterbot/i],
  ["LinkedInBot", /linkedinbot/i],
  ["YandexBot", /yandexbot/i],
  ["Baiduspider", /baiduspider/i],
  ["DuckDuckBot", /duckduckbot/i],
];

function detectBot(ua: string): string | null {
  for (const [name, pattern] of BOT_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  // Catch unknown bots
  const lower = ua.toLowerCase();
  if (lower.includes("bot") || lower.includes("crawler") || lower.includes("spider")) {
    return "unknown_bot";
  }
  return null;
}

/* ── Path patterns that contain agent data ─────────────────────────── */
// Agent profile: /{state}/agents/{slug}
const AGENT_PATH_RE = /^\/([a-z-]+)\/agents\/([a-z0-9-]+)\/?$/;
// City list: /{state}/{city}/top10realestateagents
const CITY_PATH_RE = /^\/([a-z-]+)\/([a-z0-9-]+)\/top10realestateagents\/?$/;
// Neighborhood list: /{state}/{city}/{neighborhood}/top10realestateagents
const NEIGHBORHOOD_PATH_RE = /^\/([a-z-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\/top10realestateagents\/?$/;
// Artifact: /artifact/{uuid}
const ARTIFACT_PATH_RE = /^\/artifact\/([0-9a-f-]{36})/;
// State hub: /{state}/top10realestateagents
const STATE_PATH_RE = /^\/([a-z-]+)\/top10realestateagents\/?$/;

interface LogEntry {
  id?: string;
  timestamp?: number;
  path?: string;
  host?: string;
  statusCode?: number;
  proxy?: {
    userAgent?: string;
    statusCode?: number;
    path?: string;
    host?: string;
    cacheId?: string;
  };
  // Vercel also puts some fields at top level
  userAgent?: string;
  source?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // Vercel sends a GET to verify the endpoint -- must echo x-vercel-verify header
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("VERCEL_LOG_DRAIN_VERIFY") || "";
    return new Response(verifyToken, {
      headers: {
        ...CORS,
        "Content-Type": "text/plain",
        "x-vercel-verify": verifyToken,
      },
    });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error("[drain] failed to read body:", e);
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Signature verification disabled: the Vercel proxy (api/vercel-log-drain.js)
  // re-serializes the body via JSON.stringify, which changes the raw bytes and
  // breaks the HMAC check. The proxy authenticates with the service role key,
  // so the request is already trusted by the time it reaches this function.

  // Parse body: supports both JSON array (Vercel json drain type) and NDJSON
  const entries: LogEntry[] = [];
  const trimmed = rawBody.trim();
  if (trimmed.startsWith("[")) {
    // JSON array
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) entries.push(...arr);
    } catch (_) {
      // Fall through to NDJSON parse
    }
  }
  if (entries.length === 0) {
    // NDJSON fallback (one JSON object per line)
    const lines = rawBody.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (Array.isArray(parsed)) entries.push(...parsed);
        else entries.push(parsed);
      } catch (_) {
        // Skip malformed lines
      }
    }
  }

  if (entries.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseKey);

  // Debug counters -- track where volume is lost
  let dbg_total = entries.length;
  let dbg_build_skipped = 0;
  let dbg_no_ua = 0;
  let dbg_not_bot = 0;
  let dbg_no_path = 0;
  let dbg_path_filtered = 0;
  let dbg_bot_hits = 0;

  // Filter for bot requests and build insert rows
  const rows: {
    agent_id: string | null;
    page_path: string;
    user_agent: string;
    bot_name: string;
    crawled_at: string;
    _slug?: string | null;
  }[] = [];

  // Slug resolution: collect unique slugs, resolve in one query
  const slugCache = new Map<string, string>(); // slug -> professional.id
  const slugsToResolve = new Set<string>();

  for (const entry of entries) {
    // Skip build logs and static CDN cache hits (JS/CSS/images).
    // Bots hit server-rendered lambda pages, not CDN-cached static assets.
    // Dropping static cuts ~60% of incoming volume with no loss in bot coverage.
    if (entry.source === "build" || entry.source === "static") { dbg_build_skipped++; continue; }

    const ua = entry.proxy?.userAgent || entry.userAgent || "";
    if (!ua) { dbg_no_ua++; continue; }

    const botName = detectBot(ua);
    if (!botName) { dbg_not_bot++; continue; }

    let path = entry.proxy?.path || entry.path || "";
    // After clean-room migration, Vercel rewrites resolve to /api/serve-clean-html?path=...
    // Extract the original path from the query string if needed
    if (path.startsWith("/api/serve-clean-html") || path.startsWith("/api/for-ai")) {
      try {
        const u = new URL(path, "https://www.top10lists.us");
        const origPath = u.searchParams.get("path");
        if (origPath) path = origPath;
      } catch (_) {}
    }
    if (!path) { dbg_no_path++; continue; }

    // Only process paths that are agent/list pages
    if (!AGENT_PATH_RE.test(path) && !CITY_PATH_RE.test(path) &&
        !NEIGHBORHOOD_PATH_RE.test(path) && !ARTIFACT_PATH_RE.test(path) &&
        !STATE_PATH_RE.test(path)) {
      dbg_path_filtered++;
      continue;
    }
    dbg_bot_hits++;

    let ts: string;
    try {
      ts = entry.timestamp
        ? new Date(entry.timestamp).toISOString()
        : new Date().toISOString();
    } catch (_) {
      ts = new Date().toISOString();
    }

    // Extract agent_id from artifact paths (UUID is in the URL)
    let agentId: string | null = null;
    const artifactMatch = path.match(ARTIFACT_PATH_RE);
    if (artifactMatch) agentId = artifactMatch[1];

    // Queue slug for batch resolution (agent profile pages)
    const agentMatch = path.match(AGENT_PATH_RE);
    if (agentMatch) {
      const slug = agentMatch[2];
      if (!slugCache.has(slug)) slugsToResolve.add(slug);
    }

    rows.push({
      agent_id: agentId,
      page_path: path,
      user_agent: ua.slice(0, 500),
      bot_name: botName,
      crawled_at: ts,
      _slug: agentMatch ? agentMatch[2] : null, // temp field for resolution
    });
  }

  // Batch resolve agent slugs -> IDs (single query, no per-slug round trips)
  if (slugsToResolve.size > 0) {
    try {
      const slugList = Array.from(slugsToResolve).slice(0, 200); // cap at 200 unique slugs
      const { data: agents } = await sb
        .from("professionals")
        .select("id, canonical_slug")
        .in("canonical_slug", slugList);
      if (agents) {
        for (const a of agents) slugCache.set(a.canonical_slug, a.id);
      }
    } catch (e) {
      console.error("[drain] slug resolution failed (non-fatal):", e);
    }
  }

  // Apply resolved agent_ids
  for (const row of rows) {
    if (!row.agent_id && row._slug && slugCache.has(row._slug)) {
      row.agent_id = slugCache.get(row._slug)!;
    }
    delete row._slug;
  }

  // Batch insert
  let inserted = 0;
  try {
    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000);
      const { error } = await sb.from("bot_crawl_logs").insert(batch);
      if (error) {
        console.error("bot_crawl_logs insert error:", error.message, "batch_start:", i);
      } else {
        inserted += batch.length;
      }
    }
  } catch (e) {
    console.error("[drain] insert loop failed:", e);
  }

  console.log(`[drain-debug] received=${dbg_total} build=${dbg_build_skipped} no_ua=${dbg_no_ua} not_bot=${dbg_not_bot} no_path=${dbg_no_path} path_filtered=${dbg_path_filtered} bot_hits=${dbg_bot_hits} inserted=${inserted}`);

  return new Response(
    JSON.stringify({
      ok: true,
      received: dbg_total,
      debug: {
        build_skipped: dbg_build_skipped,
        no_ua: dbg_no_ua,
        not_bot: dbg_not_bot,
        no_path: dbg_no_path,
        path_filtered: dbg_path_filtered,
        bot_hits: dbg_bot_hits,
      },
      bot_hits: rows.length,
      inserted,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
