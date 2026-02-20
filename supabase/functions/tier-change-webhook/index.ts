// supabase/functions/tier-change-webhook/index.ts
// Triggered by Supabase DB webhook when professionals.current_tier changes.
// Looks up the agent's city, then fires a GitHub Actions repository_dispatch.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wiotrvoirdgzfacuuiem.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_PAT") || "";
const GITHUB_REPO = "rjmjr1962831/list-wise-boost";

serve(async (req: Request) => {
  try {
    const payload = await req.json();

    // Supabase webhook sends: { type, table, record, old_record, schema }
    const { type, record, old_record } = payload;

    if (type !== "UPDATE") {
      return new Response(JSON.stringify({ skipped: true, reason: "not an UPDATE" }), { status: 200 });
    }

    const oldTier = old_record?.current_tier || old_record?.badge_tier || "listed";
    const newTier = record?.current_tier || record?.badge_tier || "listed";

    // Only fire if tier actually changed
    if (oldTier === newTier) {
      return new Response(JSON.stringify({ skipped: true, reason: "tier unchanged" }), { status: 200 });
    }

    const agentName = record?.name || "Unknown";
    const cityId = record?.city_id;

    if (!cityId) {
      return new Response(JSON.stringify({ skipped: true, reason: "no city_id" }), { status: 200 });
    }

    // Look up city slug and state
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: city, error } = await supabase
      .from("cities")
      .select("slug, state_slug")
      .eq("id", cityId)
      .single();

    if (error || !city) {
      return new Response(JSON.stringify({ error: "city lookup failed", detail: error }), { status: 500 });
    }

    // Dispatch GitHub Action
    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: "POST",
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "tier-change",
        client_payload: {
          city_slug: city.slug,
          state_slug: city.state_slug,
          agent_name: agentName,
          agent_id: record.id,
          old_tier: oldTier,
          new_tier: newTier,
        },
      }),
    });

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      return new Response(JSON.stringify({ error: "GitHub dispatch failed", status: ghRes.status, detail: errText }), { status: 500 });
    }

    console.log(`Tier change: ${agentName} (${oldTier} -> ${newTier}) in ${city.state_slug}/${city.slug}. GitHub Action dispatched.`);

    return new Response(JSON.stringify({
      dispatched: true,
      agent: agentName,
      city: city.slug,
      state: city.state_slug,
      old_tier: oldTier,
      new_tier: newTier,
    }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
