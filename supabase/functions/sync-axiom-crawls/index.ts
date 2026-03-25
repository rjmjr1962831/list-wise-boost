/**
 * sync-axiom-crawls
 *
 * Runs every 12 hours via pg_cron. Queries Axiom for all bot requests
 * in the last 12 hours, aggregates by hour + bot_name, and upserts
 * into bot_crawl_hourly. Dashboards read from this table instead of
 * bot_crawl_logs for accurate counts (including CDN cache HITs).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AXIOM_APL = "https://api.axiom.co/v1/datasets/_apl?format=tabular";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AXIOM_TOKEN = Deno.env.get("AXIOM_API_TOKEN")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// APL query: detect bot name from user-agent, aggregate by hour.
// Uses `has` (case-insensitive substring match) via the _apl endpoint.
const APL = `['vercel']
| where ['request.host'] == "www.top10lists.us"
| where ['request.userAgent'] has "bot" or ['request.userAgent'] has "spider" or ['request.userAgent'] has "Meta-ExternalAgent" or ['request.userAgent'] has "Applebot" or ['request.userAgent'] has "crawler"
| extend bn = case(
    ['request.userAgent'] has "chatgpt-user", "ChatGPT-User",
    ['request.userAgent'] has "OAI-SearchBot", "OAI-SearchBot",
    ['request.userAgent'] has "GPTBot", "GPTBot",
    ['request.userAgent'] has "ClaudeBot", "ClaudeBot",
    ['request.userAgent'] has "claude-web", "claude-web",
    ['request.userAgent'] has "anthropic-ai", "claude-web",
    ['request.userAgent'] has "PerplexityBot", "PerplexityBot",
    ['request.userAgent'] has "YouBot", "YouBot",
    ['request.userAgent'] has "Meta-ExternalAgent", "Meta-ExternalAgent",
    ['request.userAgent'] has "GoogleOther", "GoogleOther",
    ['request.userAgent'] has "Google-Extended", "Google-Extended",
    ['request.userAgent'] has "Gemini-AI", "Gemini-AI",
    ['request.userAgent'] has "Googlebot", "Googlebot",
    ['request.userAgent'] has "bingbot", "Bingbot",
    ['request.userAgent'] has "Bingbot", "Bingbot",
    ['request.userAgent'] has "Applebot", "Applebot",
    ['request.userAgent'] has "AhrefsBot", "AhrefsBot",
    ['request.userAgent'] has "SemrushBot", "SEMrushBot",
    ['request.userAgent'] has "DotBot", "DotBot",
    ['request.userAgent'] has "MJ12bot", "MJ12bot",
    ['request.userAgent'] has "ByteSpider", "ByteSpider",
    ['request.userAgent'] has "CCBot", "CCBot",
    ['request.userAgent'] has "facebookexternalhit", "FacebookExternalHit",
    ['request.userAgent'] has "Twitterbot", "Twitterbot",
    ['request.userAgent'] has "LinkedInBot", "LinkedInBot",
    ['request.userAgent'] has "YandexBot", "YandexBot",
    ['request.userAgent'] has "Baiduspider", "Baiduspider",
    ['request.userAgent'] has "DuckDuckBot", "DuckDuckBot",
    "unknown_bot"
  )
| summarize visits=count() by bin(_time, 1h), bn
| order by _time asc`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    // Query Axiom via _apl endpoint (tabular format)
    const axiomRes = await fetch(AXIOM_APL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AXIOM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apl: APL,
        startTime: twelveHoursAgo.toISOString(),
        endTime: now.toISOString(),
      }),
    });

    if (!axiomRes.ok) {
      const errText = await axiomRes.text();
      throw new Error(`Axiom API ${axiomRes.status}: ${errText.slice(0, 200)}`);
    }

    const axiomData = await axiomRes.json();

    // Parse tabular response: tables[0].columns is array of arrays
    // Fields: _time, bn, visits (from summarize)
    let rows: { hour: string; bot_name: string; visits: number }[] = [];

    if (axiomData.tables && axiomData.tables[0]) {
      const table = axiomData.tables[0];
      const fields = table.fields?.map((f: any) => f.name) || [];
      const timeIdx = fields.indexOf("_time");
      const bnIdx = fields.indexOf("bn");
      const visitsIdx = fields.indexOf("visits");

      if (timeIdx >= 0 && bnIdx >= 0 && visitsIdx >= 0) {
        const len = table.columns[timeIdx]?.length || 0;
        for (let i = 0; i < len; i++) {
          rows.push({
            hour: table.columns[timeIdx][i],
            bot_name: table.columns[bnIdx][i],
            visits: table.columns[visitsIdx][i],
          });
        }
      }
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, synced: 0, message: "No bot data from Axiom" }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Write to bot_crawl_hourly
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Delete existing rows in the 12h window to avoid double-counting
    const { error: delErr } = await sb
      .from("bot_crawl_hourly")
      .delete()
      .gte("hour", twelveHoursAgo.toISOString());
    if (delErr) console.error("Delete error:", delErr.message);

    // Batch insert
    const insertRows = rows.map((r) => ({
      hour: r.hour,
      bot_name: r.bot_name,
      visits: r.visits,
      synced_at: now.toISOString(),
    }));

    let synced = 0;
    for (let i = 0; i < insertRows.length; i += 500) {
      const chunk = insertRows.slice(i, i + 500);
      const { error: insErr } = await sb.from("bot_crawl_hourly").insert(chunk);
      if (insErr) {
        console.error("Insert error:", insErr.message);
      } else {
        synced += chunk.length;
      }
    }

    console.log(`[sync-axiom-crawls] Synced ${synced} rows (${twelveHoursAgo.toISOString()} → ${now.toISOString()})`);

    return new Response(
      JSON.stringify({
        ok: true,
        synced,
        period: { start: twelveHoursAgo.toISOString(), end: now.toISOString() },
        axiom_rows_matched: axiomData.status?.rowsMatched || 0,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[sync-axiom-crawls] Error:", e.message);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
