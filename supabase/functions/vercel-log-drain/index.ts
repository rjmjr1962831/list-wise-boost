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
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

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

  const rawBody = await req.text();

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

  // Filter for bot requests and build insert rows
  const rows: {
    agent_id: string | null;
    page_path: string;
    user_agent: string;
    bot_name: string;
    crawled_at: string;
  }[] = [];

  // Collect agent slugs we need to resolve
  const slugsToResolve = new Map<string, number[]>(); // slug -> indices in rows

  for (const entry of entries) {
    // Skip non-production, build logs, etc.
    if (entry.source === "build") continue;

    const ua = entry.proxy?.userAgent || entry.userAgent || "";
    if (!ua) continue;

    const botName = detectBot(ua);
    if (!botName) continue;

    const path = entry.proxy?.path || entry.path || "";
    if (!path) continue;

    // Only process paths that are agent/list pages
    const isAgentPage = AGENT_PATH_RE.test(path);
    const isCityPage = CITY_PATH_RE.test(path);
    const isNeighborhoodPage = NEIGHBORHOOD_PATH_RE.test(path);
    const isArtifact = ARTIFACT_PATH_RE.test(path);
    const isStatePage = STATE_PATH_RE.test(path);

    if (!isAgentPage && !isCityPage && !isNeighborhoodPage && !isArtifact && !isStatePage) {
      continue;
    }

    const ts = entry.timestamp
      ? new Date(entry.timestamp).toISOString()
      : new Date().toISOString();

    let agentId: string | null = null;

    // Direct UUID from artifact path
    if (isArtifact) {
      const m = path.match(ARTIFACT_PATH_RE);
      if (m) agentId = m[1];
    }

    const idx = rows.length;
    rows.push({
      agent_id: agentId,
      page_path: path,
      user_agent: ua.slice(0, 500),
      bot_name: botName,
      crawled_at: ts,
    });

    // Queue slug resolution for agent profile pages
    if (isAgentPage) {
      const m = path.match(AGENT_PATH_RE);
      if (m) {
        const slug = m[2];
        if (!slugsToResolve.has(slug)) {
          slugsToResolve.set(slug, []);
        }
        slugsToResolve.get(slug)!.push(idx);
      }
    }
  }

  // Batch resolve agent slugs -> IDs
  if (slugsToResolve.size > 0) {
    const slugList = Array.from(slugsToResolve.keys());
    // Supabase .in() has a limit, batch in groups of 100
    for (let i = 0; i < slugList.length; i += 100) {
      const batch = slugList.slice(i, i + 100);
      const { data: agents } = await sb
        .from("professionals")
        .select("id, canonical_slug")
        .in("canonical_slug", batch)
        .eq("active", true);
      if (agents) {
        for (const agent of agents) {
          const indices = slugsToResolve.get(agent.canonical_slug);
          if (indices) {
            for (const idx of indices) {
              rows[idx].agent_id = agent.id;
            }
          }
        }
      }
    }
  }

  // Insert in batches of 500
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await sb.from("bot_crawl_logs").insert(batch);
    if (error) {
      console.error("bot_crawl_logs insert error:", error.message, "batch_start:", i);
    } else {
      inserted += batch.length;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, received: entries.length, bot_hits: rows.length, inserted }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
