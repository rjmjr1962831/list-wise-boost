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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    const agentQ = url.searchParams.get("agent");
    const marketQ = url.searchParams.get("market");
    const searchOnly = url.searchParams.get("search_only") === "1";

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Live search endpoint (AJAX from the static page)
    if (searchOnly && agentQ && marketQ) {
      const searchHtml = await runSearch(sb, agentQ, marketQ);
      return new Response(searchHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...CORS },
      });
    }

    // Serve pre-rendered static page
    const { data, error } = await sb
      .from("static_pages")
      .select("html, rendered_at")
      .eq("slug", "crawl-stats")
      .single();

    if (error || !data) {
      return new Response(
        `<!DOCTYPE html><html><body><h1>Crawl Stats</h1><p>Stats page is being generated. Please check back in a few minutes.</p></body></html>`,
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "300", ...CORS } },
      );
    }

    return new Response(data.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Rendered": "static-page",
        "X-Rendered-At": data.rendered_at,
        ...CORS,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to serve", detail: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
