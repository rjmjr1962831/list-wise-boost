/**
 * Batch job: create per-agent rows from list-page log rows.
 * Run on a schedule (e.g. every 5–15 min). Reads rows where agents_shown is set
 * and list_page_processed_at is null, inserts one row per agent, then marks processed.
 * Keeps the request path light (1 row per list-page view) while scaling to 50 agents/page.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 50; // max list-page rows to process per run
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: rows, error: fetchErr } = await supabase
      .from("cloudflare_request_logs")
      .select("id, timestamp, client_ip, user_agent, url, path, method, cache_status, country, bot_type, list_page_type, location_display, agents_shown, raw_log")
      .not("agents_shown", "is", null)
      .is("agent_id", null)
      .is("list_page_processed_at", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      console.error("[process-list-page-logs] fetch error:", fetchErr);
      return new Response(
        JSON.stringify({ success: false, error: fetchErr.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (!rows?.length) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, rows_created: 0 }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let totalRowsCreated = 0;

    for (const row of rows) {
      const agentsShown = row.agents_shown as Array<{ canonical_slug?: string; name?: string }> | null;
      if (!Array.isArray(agentsShown) || agentsShown.length === 0) {
        await supabase
          .from("cloudflare_request_logs")
          .update({ list_page_processed_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }

      const slugs = agentsShown.map((a) => a.canonical_slug).filter(Boolean) as string[];
      if (slugs.length === 0) {
        await supabase
          .from("cloudflare_request_logs")
          .update({ list_page_processed_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }

      const { data: profs } = await supabase
        .from("professionals")
        .select("id")
        .in("canonical_slug", slugs)
        .eq("active", true);

      if (!profs?.length) {
        await supabase
          .from("cloudflare_request_logs")
          .update({ list_page_processed_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }

      const base = {
        timestamp: row.timestamp,
        client_ip: row.client_ip ?? null,
        user_agent: row.user_agent ?? null,
        url: row.url,
        path: row.path,
        method: row.method ?? "GET",
        cache_status: row.cache_status ?? "UNKNOWN",
        cache_response_status: null,
        country: row.country ?? null,
        ray_id: null as string | null,
        bot_type: row.bot_type,
        is_bot: true,
        agent_id: null as string | null,
        list_page_type: row.list_page_type ?? null,
        location_display: row.location_display ?? null,
        agents_shown: null,
        raw_log: { ...(row.raw_log as object || {}), list_page_agent_row: true },
      };

      const perAgentRows = profs.map((p: { id: string }) => ({ ...base, agent_id: p.id }));
      const { error: insertErr } = await supabase.from("cloudflare_request_logs").insert(perAgentRows);

      if (insertErr) {
        console.error("[process-list-page-logs] insert error for row", row.id, insertErr);
        continue;
      }

      totalRowsCreated += perAgentRows.length;

      await supabase
        .from("cloudflare_request_logs")
        .update({ list_page_processed_at: new Date().toISOString() })
        .eq("id", row.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: rows.length,
        rows_created: totalRowsCreated,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[process-list-page-logs]", e);
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
