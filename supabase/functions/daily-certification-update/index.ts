import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-enrichment-key",
};

/** Allow X-Enrichment-Key or Bearer. Uses env ENRICHMENT_API_KEY / X_ENRICHMENT_KEY / ENRICHMENT_KEY if set; otherwise accepts same literal as prerender cron. */
const CRON_ENRICHMENT_KEY = "t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a";

function isAuthorized(req: Request): boolean {
  const key = req.headers.get("x-enrichment-key");
  const auth = req.headers.get("authorization");
  const expected = Deno.env.get("ENRICHMENT_API_KEY") || Deno.env.get("X_ENRICHMENT_KEY") || Deno.env.get("ENRICHMENT_KEY");
  const allowedKeys = expected ? [expected, CRON_ENRICHMENT_KEY] : [CRON_ENRICHMENT_KEY];
  if (key && allowedKeys.includes(key)) return true;
  if (auth && expected && auth === `Bearer ${expected}`) return true;
  if (auth && auth === `Bearer ${CRON_ENRICHMENT_KEY}`) return true;
  return false;
}

/** Cadence -> days after which a run is due */
const CADENCE_DAYS: Record<string, number> = {
  daily: 1,
  every_two_weeks: 14,
  quarterly: 90,
  monthly: 30,
  annual: 365,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dryRun;
    const limit = typeof body.limit === "number" ? Math.min(body.limit, 500) : 100;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Get tiers that have a runnable refresh_cadence
    const { data: configRows, error: configErr } = await supabase
      .from("certification_pricing_config")
      .select("tier, refresh_cadence")
      .eq("is_active", true);

    if (configErr) throw new Error(`config: ${configErr.message}`);

    const cadenceByTier: Record<string, number> = {};
    for (const row of configRows || []) {
      const rc = (row.refresh_cadence || "").toLowerCase().replace(/\s+/g, "_");
      const days = CADENCE_DAYS[rc] ?? CADENCE_DAYS[rc.replace("_", " ")];
      if (days != null) cadenceByTier[row.tier] = days;
    }

    const runnableTiers = Object.keys(cadenceByTier);
    if (runnableTiers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, due: 0, message: "No runnable cadences in config" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Fetch professionals with Zillow URL and a runnable tier
    const { data: pros, error: prosErr } = await supabase
      .from("professionals")
      .select("id, name, current_tier, certification_updated_at, zillow_data_fetched_at, updated_at")
      .eq("active", true)
      .not("zillow_profile_url", "is", null)
      .in("current_tier", runnableTiers);

    if (prosErr) throw new Error(`professionals: ${prosErr.message}`);

    const now = Date.now();
    const due: { id: string; name: string; tier: string; cadenceDays: number }[] = [];

    for (const p of pros || []) {
      const tier = p.current_tier || "listed";
      const cadenceDays = cadenceByTier[tier];
      if (cadenceDays == null) continue;

      const lastRun = p.certification_updated_at || p.zillow_data_fetched_at || p.updated_at;
      const lastMs = lastRun ? new Date(lastRun).getTime() : 0;
      const thresholdMs = now - cadenceDays * 24 * 60 * 60 * 1000;
      if (lastMs < thresholdMs) {
        due.push({ id: p.id, name: p.name, tier, cadenceDays });
      }
    }

    // Sort: daily first, then every_two_weeks, monthly, annual
    due.sort((a, b) => a.cadenceDays - b.cadenceDays);
    const toRun = due.slice(0, limit);

    if (toRun.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          due: due.length,
          processed: 0,
          message: "No agents due for certification today",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          due: due.length,
          wouldProcess: toRun.length,
          sample: toRun.slice(0, 10).map((x) => ({ id: x.id, name: x.name, tier: x.tier })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let ok = 0;
    let fail = 0;

    for (const agent of toRun) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/fetch-single-memo23-agent`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            professionalId: agent.id,
            dryRun: false,
            skipRecentlyEnriched: false,
            skipGenericBios: true,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && !data.skipped) ok++;
        else fail++;
      } catch (e) {
        console.error(`Enrich failed for ${agent.name}:`, e);
        fail++;
      }

      // Mark certification run for this agent (so we don't re-run until next cadence)
      await supabase
        .from("professionals")
        .update({ certification_updated_at: new Date().toISOString() })
        .eq("id", agent.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        due: due.length,
        processed: toRun.length,
        ok,
        fail,
        message: `Processed ${toRun.length} of ${due.length} due agents`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("daily-certification-update error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
