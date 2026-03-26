/**
 * serve-bot-crawl-stats-html — Serves pre-rendered crawl stats page.
 *
 * Static HTML is read from static_pages table (rendered daily by render-crawl-stats).
 * Live agent search is handled as an AJAX endpoint when ?search_only=1 is present.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ── Bot/display helpers (kept for search results rendering) ────── */
const AI_BOTS = new Set(["ChatGPT-User", "chatgpt-user", "OAI-SearchBot", "GPTBot", "ClaudeBot", "claude-web", "anthropic-ai", "Meta-ExternalAgent", "PerplexityBot", "YouBot", "CCBot", "ByteSpider", "Gemini-AI", "Google-Extended"]);
const SEARCH_BOTS = new Set(["Googlebot", "googlebot", "GoogleOther", "Bingbot", "bingbot", "Applebot", "applebot", "Applebot-Extended"]);
const SEO_BOTS = new Set(["AhrefsBot", "SEMrushBot", "semrushbot", "DotBot", "MJ12bot"]);
const BOT_DISPLAY: Record<string, string> = {
  "ChatGPT-User": "ChatGPT (OpenAI)", "chatgpt-user": "ChatGPT (OpenAI)",
  "OAI-SearchBot": "ChatGPT Search (OpenAI)", "GPTBot": "GPTBot (OpenAI)",
  "Googlebot": "Googlebot", "googlebot": "Googlebot", "GoogleOther": "GoogleOther",
  "Google-Extended": "Google AI (Gemini)", "Gemini-AI": "Google Gemini",
  "Applebot": "Applebot (Siri/Spotlight)", "applebot": "Applebot (Siri/Spotlight)",
  "Meta-ExternalAgent": "Meta AI (Llama)", "Bingbot": "Bingbot (Microsoft)", "bingbot": "Bingbot (Microsoft)",
  "ByteSpider": "ByteSpider (TikTok)", "ClaudeBot": "ClaudeBot (Anthropic)",
  "claude-web": "Claude Web (Anthropic)", "PerplexityBot": "PerplexityBot",
  "YouBot": "You.com Bot", "CCBot": "Common Crawl",
  "SEMrushBot": "SEMrush", "semrushbot": "SEMrush",
  "AhrefsBot": "Ahrefs", "DotBot": "DotBot", "MJ12bot": "Majestic",
};

function botCategory(n: string): string {
  if (AI_BOTS.has(n)) return "ai";
  if (SEARCH_BOTS.has(n)) return "search";
  if (SEO_BOTS.has(n)) return "seo";
  return "other";
}
function catBadge(n: string): string {
  const c = botCategory(n);
  const l: Record<string, string> = { ai: "AI", search: "Search", seo: "SEO", other: "Other" };
  return `<span class="badge badge-${c}">${l[c]}</span>`;
}
function fmt(n: number): string { return n.toLocaleString("en-US"); }
function esc(s: unknown): string {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtTs(iso: string): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return `<time datetime="${d.toISOString()}">${d.toISOString().replace("T", " ").slice(0, 19)} UTC</time>`;
}
function sqlSafe(s: string): string { return s.replace(/'/g, "''"); }

/* ── Live search (returns HTML fragment) ─────────────────────────── */
async function runSearch(sb: any, agentQ: string, marketQ: string): Promise<string> {
  if (!agentQ || !marketQ) {
    return `<p class="muted">Both agent name and city/neighborhood are required.</p>`;
  }
  if (agentQ.length < 2 || marketQ.length < 2) {
    return `<p class="muted">Enter at least 2 characters per field.</p>`;
  }

  // Query pre-computed agent_ai_surfaces_by_bot (36K rows) instead of raw bot_crawl_logs (1.4M+)
  const nameFilter = `p.name ILIKE '%${sqlSafe(agentQ)}%'`;
  const marketSlug = marketQ.replace(/ /g, "-").toLowerCase();
  const marketFilter = `(p.business_city ILIKE '%${sqlSafe(marketQ)}%' OR p.served_cities @> to_jsonb('${sqlSafe(marketSlug)}'::text))`;

  const { data, error } = await sb.rpc("run_sql", {
    query: `SELECT p.name, p.business_city, p.state_slug, s.bot_name, s.crawls::int, s.computed_at::text as last_seen
            FROM agent_ai_surfaces_by_bot s
            JOIN professionals p ON p.id = s.agent_id AND p.active = true
            WHERE ${nameFilter} AND ${marketFilter}
            ORDER BY p.name, s.crawls DESC
            LIMIT 200`,
  });

  if (error) return `<div class="search-noresult"><h3>Search error</h3><p>${esc(error.message)}</p></div>`;
  const rows = data || [];
  if (rows.length === 0) {
    const terms = [agentQ, marketQ].filter(Boolean).join(" + ");
    return `<div class="search-noresult"><h3>No results for "${esc(terms)}"</h3><p>No bot crawls found matching that search in the last 7 days.</p></div>`;
  }

  const byAgent = new Map<string, { city: string; state: string; bots: { name: string; crawls: number; last: string }[]; total: number }>();
  for (const r of rows) {
    const key = `${r.name}|${r.business_city}|${r.state_slug}`;
    if (!byAgent.has(key)) byAgent.set(key, { city: r.business_city, state: r.state_slug, bots: [], total: 0 });
    const e = byAgent.get(key)!;
    e.bots.push({ name: r.bot_name, crawls: r.crawls, last: r.last_seen });
    e.total += r.crawls;
  }

  const sorted = Array.from(byAgent.entries()).sort((a, b) => b[1].total - a[1].total);

  let html = `<p class="muted" style="margin-top:1rem;">${sorted.length} agent${sorted.length !== 1 ? "s" : ""} found.</p>`;
  for (const [key, data] of sorted) {
    const name = key.split("|")[0];
    const st = data.state === "arizona" ? "AZ" : data.state === "california" ? "CA" : data.state;
    html += `<div class="search-result"><h3>${esc(name)} -- ${esc(data.city)}, ${st}</h3>
      <p><strong>${fmt(data.total)} bot crawls</strong> across <strong>${data.bots.length}</strong> bot type${data.bots.length !== 1 ? "s" : ""}.</p>
      <table><thead><tr><th>Bot</th><th class="num">Crawls</th><th>Last Seen</th></tr></thead>
      <tbody>${data.bots.slice(0, 5).map(b => `<tr><td>${esc(BOT_DISPLAY[b.name] || b.name)} ${catBadge(b.name)}</td><td class="num">${fmt(b.crawls)}</td><td class="timestamp">${fmtTs(b.last)}</td></tr>`).join("")}${data.bots.length > 5 ? `<tr><td class="muted">+${data.bots.length - 5} more</td><td></td><td></td></tr>` : ""}</tbody></table></div>`;
  }
  return html;
}

/* ── Range → SQL interval mapping ─────────────────────────────────── */
const RANGE_MAP: Record<string, { interval: string; label: string }> = {
  "24h": { interval: "24 hours", label: "24 hours" },
  "7d":  { interval: "7 days",   label: "7 days" },
  "30d": { interval: "30 days",  label: "30 days" },
};

const INTENT_BOTS_SET = new Set(["ChatGPT-User", "chatgpt-user", "PerplexityBot", "perplexitybot"]);

interface BotRow { bot_name: string; visits: number; agents_covered: number; last_seen: string; }

function mergeBots(bots: BotRow[]): BotRow[] {
  const m = new Map<string, BotRow>();
  for (const b of bots) {
    if (!b.bot_name) continue;
    const k = b.bot_name.toLowerCase();
    const e = m.get(k);
    if (e) { e.visits += b.visits; e.agents_covered = Math.max(e.agents_covered, b.agents_covered); if (b.last_seen > e.last_seen) e.last_seen = b.last_seen; }
    else m.set(k, { ...b });
  }
  return Array.from(m.values()).sort((a, b) => b.visits - a.visits);
}

async function renderLiveStats(sb: any, range: string): Promise<string> {
  const { interval, label } = RANGE_MAP[range] || RANGE_MAP["7d"];

  const [botResult, summaryResult, mcpResult] = await Promise.all([
    sb.rpc("run_sql", {
      query: `WITH combined AS (
                SELECT bot_name, 1 as visits, agent_id, crawled_at as ts FROM bot_crawl_logs WHERE crawled_at >= now() - interval '${interval}' AND bot_name IS NOT NULL
                UNION ALL
                SELECT bot_name, visits, NULL as agent_id, hour as ts FROM bot_crawl_hourly WHERE hour >= now() - interval '${interval}'
              )
              SELECT bot_name, SUM(visits)::int as visits, count(DISTINCT agent_id)::int as agents_covered, max(ts)::text as last_seen
              FROM combined GROUP BY bot_name ORDER BY visits DESC`,
    }),
    sb.rpc("run_sql", {
      query: `WITH combined AS (
                SELECT bot_name, 1 as visits, agent_id FROM bot_crawl_logs WHERE crawled_at >= now() - interval '${interval}' AND bot_name IS NOT NULL
                UNION ALL
                SELECT bot_name, visits, NULL FROM bot_crawl_hourly WHERE hour >= now() - interval '${interval}'
              )
              SELECT SUM(visits)::int as total_crawls, count(DISTINCT agent_id)::int as unique_agents, count(DISTINCT bot_name)::int as unique_bots
              FROM combined`,
    }),
    sb.rpc("run_sql", {
      query: `SELECT count(*)::int as total_calls FROM mcp_request_logs WHERE created_at >= now() - interval '${interval}'`,
    }),
  ]);

  const allBots = mergeBots(botResult.data || []);
  const summary = (summaryResult.data || [])[0] || { total_crawls: 0, unique_agents: 0, unique_bots: 0 };
  const mcpSummary = (mcpResult.data || [])[0] || { total_calls: 0 };

  const userBots = allBots.filter(b => INTENT_BOTS_SET.has(b.bot_name));
  const crawlerBots = allBots.filter(b => !INTENT_BOTS_SET.has(b.bot_name));
  const userTotal = userBots.reduce((s, b) => s + b.visits, 0);
  const crawlerTotal = crawlerBots.reduce((s, b) => s + b.visits, 0);

  function botTable(list: BotRow[], total: number): string {
    const top = list.slice(0, 10);
    const other = total - top.reduce((s, b) => s + b.visits, 0);
    let rows = top.map(b => {
      const pct = total > 0 ? ((b.visits / total) * 100).toFixed(1) : "0";
      return `<tr><td>${esc(BOT_DISPLAY[b.bot_name] || b.bot_name)} ${catBadge(b.bot_name)}</td><td class="num">${fmt(b.visits)}</td><td class="num">${pct}%</td><td class="num">${fmt(b.agents_covered)}</td><td class="timestamp">${fmtTs(b.last_seen)}</td></tr>`;
    }).join("\n");
    if (other > 0) rows += `\n<tr><td class="muted">Other</td><td class="num muted">${fmt(other)}</td><td class="num muted">${total > 0 ? ((other / total) * 100).toFixed(1) : "0"}%</td><td></td><td></td></tr>`;
    rows += `\n<tr class="total-row"><td>Total</td><td class="num">${fmt(total)}</td><td class="num">100%</td><td></td><td></td></tr>`;
    return rows;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Georgia, "Times New Roman", serif; line-height: 1.7; color: #1a1a1a; max-width: 960px; margin: 0 auto; padding: 1.5rem; }
h1 { font-size: 1.6rem; margin-bottom: 0.5rem; } h2 { font-size: 1.3rem; margin: 1.5rem 0 0.8rem; border-bottom: 1px solid #ccc; padding-bottom: 0.4rem; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.2rem; text-align: center; margin: 1rem 0; }
@media (max-width: 600px) { .stats { grid-template-columns: repeat(2, 1fr); } }
.stat-number { font-size: 1.6rem; font-weight: bold; color: #1a56db; } .stat-label { color: #6b7280; font-size: 0.85rem; }
table { width: 100%; border-collapse: collapse; margin: 0.8rem 0; }
th { text-align: left; padding: 0.6rem; background: #f1f5f9; border-bottom: 2px solid #d1d5db; font-size: 0.85rem; }
td { padding: 0.6rem; border-bottom: 1px solid #e5e7eb; } tr:hover { background: #f9fafb; }
.badge { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
.badge-ai { background: #dbeafe; color: #1e40af; } .badge-search { background: #dcfce7; color: #166534; }
.badge-seo, .badge-other { background: #f3f4f6; color: #6b7280; }
.num { text-align: right; font-variant-numeric: tabular-nums; } .muted { color: #6b7280; font-size: 0.85rem; }
.timestamp { color: #9ca3af; font-size: 0.8rem; } .total-row td { font-weight: bold; border-top: 2px solid #d1d5db; background: #f8fafc; }
</style></head><body>
<h1>AI Crawl Statistics (${esc(label)})</h1>
<div class="stats">
  <div><div class="stat-number">${fmt(summary.total_crawls)}</div><div class="stat-label">Total Crawls</div></div>
  <div><div class="stat-number">${fmt(summary.unique_agents)}</div><div class="stat-label">Agents Crawled</div></div>
  <div><div class="stat-number">${fmt(userTotal)}</div><div class="stat-label">Consumer Queries</div></div>
  <div><div class="stat-number">${fmt(mcpSummary.total_calls)}</div><div class="stat-label">MCP Calls</div></div>
</div>
<h2>Consumer-Triggered Crawls</h2>
<table><thead><tr><th>Bot</th><th class="num">Crawls</th><th class="num">Share</th><th class="num">Agents</th><th>Last Seen</th></tr></thead>
<tbody>${botTable(userBots, userTotal)}</tbody></table>
<h2>Indexing &amp; Training Crawls</h2>
<table><thead><tr><th>Bot</th><th class="num">Crawls</th><th class="num">Share</th><th class="num">Agents</th><th>Last Seen</th></tr></thead>
<tbody>${botTable(crawlerBots, crawlerTotal)}</tbody></table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    const agentQ = url.searchParams.get("agent");
    const marketQ = url.searchParams.get("market");
    const searchOnly = url.searchParams.get("search_only") === "1";
    const range = url.searchParams.get("range");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Live search endpoint (AJAX from the static page)
    if (searchOnly && agentQ && marketQ) {
      const searchHtml = await runSearch(sb, agentQ, marketQ);
      return new Response(searchHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...CORS },
      });
    }

    // If range param is present, run live queries for the requested time window
    if (range && RANGE_MAP[range]) {
      const html = await renderLiveStats(sb, range);
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...CORS },
      });
    }

    // Default: serve pre-rendered static page (7-day, for bots and no-range requests)
    const { data, error } = await sb
      .from("static_pages")
      .select("html, rendered_at")
      .eq("slug", "crawl-stats")
      .single();

    if (error || !data) {
      // Fallback: render live 7d if no pre-rendered page exists
      const html = await renderLiveStats(sb, "7d");
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...CORS },
      });
    }

    return new Response(data.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=43200",
        "X-Rendered": "static-page",
        "X-Rendered-At": data.rendered_at,
        ...CORS,
      },
    });
  } catch (err) {
    console.error("serve-bot-crawl-stats-html error:", err);
    return new Response(JSON.stringify({ error: "Failed to serve", detail: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
