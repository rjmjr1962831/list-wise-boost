/**
 * health-monitor — Tests all live edge functions every 4 hours.
 * Validates real responses (not just 200 checks).
 * Alerts robert@aryah.ai immediately on failure via gmail-send.
 * Logs results to health_monitor_runs table.
 *
 * pg_cron: every 4 hours
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENRICHMENT_KEY = Deno.env.get("ENRICHMENT_API_KEY") || "";
const PROD_BASE = "https://www.top10lists.us";
const FUNC_BASE = `${SUPABASE_URL}/functions/v1`;
const ALERT_EMAIL = "robert@aryah.ai";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CheckResult {
  name: string;
  passed: boolean;
  ms: number;
  error?: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch with timeout */
async function fetchT(url: string, opts?: RequestInit, timeoutMs = 30000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Time a check */
async function runCheck(name: string, fn: () => Promise<string | null>): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const err = await fn();
    return { name, passed: !err, ms: Date.now() - t0, error: err ?? undefined };
  } catch (e) {
    return { name, passed: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Check HTML response contains expected strings */
async function checkHtml(url: string, mustContain: string[]): Promise<string | null> {
  const res = await fetchT(url);
  if (!res.ok) return `HTTP ${res.status}`;
  const html = await res.text();
  for (const s of mustContain) {
    if (!html.toLowerCase().includes(s.toLowerCase())) {
      return `Missing: "${s}" in response from ${url}`;
    }
  }
  return null;
}

/** Check JSON response with validator */
async function checkJson(url: string, opts: RequestInit | undefined, validator: (d: any) => string | null): Promise<string | null> {
  const res = await fetchT(url, opts);
  if (!res.ok) return `HTTP ${res.status}`;
  const data = await res.json();
  return validator(data);
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checks(): Array<{ name: string; fn: () => Promise<string | null> }> {
  return [
    // ---- Clean room HTML pages ----
    {
      name: "serve-bot-home-html",
      fn: () => checkHtml(`${PROD_BASE}/`, [
        "top10lists",
        "merit",
        "4.5",
      ]),
    },
    {
      name: "serve-bot-content-html (transparency)",
      fn: () => checkHtml(`${PROD_BASE}/transparency`, [
        "transparency",
        "merit",
      ]),
    },
    {
      name: "serve-bot-content-html (faq)",
      fn: () => checkHtml(`${PROD_BASE}/faq`, [
        "faq",
        "frequently",
      ]),
    },
    {
      name: "serve-bot-content-html (for-ai)",
      fn: () => checkHtml(`${PROD_BASE}/for-ai`, [
        "ai",
      ]),
    },
    {
      name: "serve-bot-state-html (arizona)",
      fn: () => checkHtml(`${PROD_BASE}/arizona`, [
        "arizona",
        "phoenix",
      ]),
    },
    {
      name: "serve-bot-state-html (california)",
      fn: () => checkHtml(`${PROD_BASE}/california`, [
        "california",
      ]),
    },
    {
      name: "serve-bot-list-html (phoenix)",
      fn: () => checkHtml(`${PROD_BASE}/arizona/phoenix/top10realestateagents`, [
        "phoenix",
        "4.5",
      ]),
    },
    {
      name: "serve-bot-list-html (los-angeles)",
      fn: () => checkHtml(`${PROD_BASE}/california/los-angeles/top10realestateagents`, [
        "los angeles",
      ]),
    },
    {
      name: "serve-bot-pages-html (about)",
      fn: () => checkHtml(`${PROD_BASE}/about`, [
        "top10lists",
      ]),
    },
    {
      name: "serve-bot-qa-html",
      fn: () => checkHtml(`${PROD_BASE}/q/how-does-top10lists-rank-real-estate-agents`, [
        "top10lists",
        "rank",
      ]),
    },
    {
      name: "serve-bot-crawl-stats-html",
      fn: () => checkHtml(`${PROD_BASE}/crawl-stats`, [
        "crawl",
      ]),
    },

    // ---- JSON / API endpoints ----
    {
      name: "serve-stats-json",
      fn: () => checkJson(`${PROD_BASE}/stats.json`, undefined, (d) => {
        if (!d || typeof d !== "object") return "Not an object";
        if (!d.agents_total || d.agents_total < 100) return `Agent count too low: ${d.agents_total}`;
        if (!d.cities_total || d.cities_total < 10) return `City count too low: ${d.cities_total}`;
        return null;
      }),
    },
    {
      name: "enrichment-api (query)",
      fn: () => checkJson(`${FUNC_BASE}/enrichment-api?action=query`, {
        method: "POST",
        headers: {
          "X-Enrichment-Key": ENRICHMENT_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          table: "professionals",
          select: "id,name",
          filters: [{ field: "state_slug", operator: "eq", value: "arizona" }],
          limit: 1,
        }),
      }, (d) => {
        if (d.error) return `API error: ${d.error}`;
        if (!d.data || !Array.isArray(d.data) || d.data.length === 0) return "No data returned";
        return null;
      }),
    },
    {
      name: "mcp-server",
      fn: async () => {
        const res = await fetchT(`${PROD_BASE}/mcp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/list",
            id: 1,
          }),
        });
        if (!res.ok) return `HTTP ${res.status}`;
        const data = await res.json();
        if (!data.result?.tools?.length) return "No tools in MCP response";
        return null;
      },
    },
    {
      name: "email-track (pixel)",
      fn: async () => {
        // Just check the tracking endpoint responds (use a dummy eid)
        const res = await fetchT(`${PROD_BASE}/api/t?t=o&eid=health-check-probe`, {}, 10000);
        // Should return 200 with a 1x1 gif or redirect, not 500
        if (res.status >= 500) return `HTTP ${res.status}`;
        return null;
      },
    },
    {
      name: "list-maker-export",
      fn: () => checkJson(`${FUNC_BASE}/list-maker-export`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          criteria: { state_slugs: ["arizona"], active: true },
          outputFields: ["name", "email"],
        }),
      }, (d) => {
        if (d.error) return `API error: ${d.error}`;
        if (!d.url && !d.count && !d.csv) return "No export data in response";
        return null;
      }),
    },

    // ---- Artifact system ----
    {
      name: "artifact-page",
      fn: async () => {
        // Get any active agent — try verification_token first, fall back to ID
        let agent: any = null;
        const { data: vtAgent } = await supabase
          .from("professionals")
          .select("verification_token,id,name")
          .not("verification_token", "is", null)
          .eq("active", true)
          .limit(1)
          .single();
        if (vtAgent) {
          agent = vtAgent;
        } else {
          // Fall back to using agent UUID directly
          const { data: idAgent } = await supabase
            .from("professionals")
            .select("id,name")
            .eq("active", true)
            .not("canonical_slug", "is", null)
            .limit(1)
            .single();
          if (!idAgent) return "No active agent found in DB for artifact test";
          agent = { ...idAgent, verification_token: null };
        }
        const token = agent.verification_token || agent.id;
        const res = await fetchT(`${PROD_BASE}/artifact/${token}`);
        if (!res.ok) return `HTTP ${res.status} for /artifact/${token}`;
        const html = await res.text();
        if (html.length < 200) return "Artifact response too short — likely empty/error";
        if (!html.toLowerCase().includes(agent.name.split(" ")[0].toLowerCase())) {
          return `Agent name "${agent.name}" not found in artifact HTML`;
        }
        return null;
      },
    },
    {
      name: "artifact-logging",
      fn: async () => {
        // Check that bot_crawl_logs has recent artifact entries (within last 7 days)
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data, error } = await supabase
          .from("bot_crawl_logs")
          .select("id")
          .like("page_path", "/artifact/%")
          .gte("crawled_at", weekAgo)
          .limit(1);
        if (error) return `DB error: ${error.message}`;
        if (!data || data.length === 0) return "No artifact entries in bot_crawl_logs in last 7 days — logging may be broken";
        return null;
      },
    },

    // ---- Sequencer (just confirm it doesn't error) ----
    {
      name: "sequencer-v2-tick",
      fn: async () => {
        const res = await fetchT(`${FUNC_BASE}/sequencer-v2-tick`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }, 30000);
        if (!res.ok) return `HTTP ${res.status}`;
        return null;
      },
    },

    // ---- Sitemap spot check ----
    {
      name: "sitemap-index",
      fn: async () => {
        const res = await fetchT(`${PROD_BASE}/sitemap.xml`);
        if (!res.ok) return `HTTP ${res.status}`;
        const xml = await res.text();
        if (!xml.includes("<sitemapindex") && !xml.includes("<urlset")) {
          return "sitemap.xml is not valid XML sitemap";
        }
        return null;
      },
    },

    // ---- DB health: agent counts match ----
    {
      name: "db-agent-counts-match-stats",
      fn: async () => {
        // Compare DB count with stats.json
        const { count: dbCount, error } = await supabase
          .from("professionals")
          .select("id", { count: "exact", head: true })
          .eq("active", true);
        if (error) return `DB error: ${error.message}`;
        if (!dbCount || dbCount === 0) return "DB returned 0 active professionals";

        const statsRes = await fetchT(`${PROD_BASE}/stats.json`);
        if (!statsRes.ok) return `stats.json HTTP ${statsRes.status}`;
        const stats = await statsRes.json();
        const statsCount = Number(stats.agents_total || 0);

        if (Math.abs(dbCount - statsCount) > 50) {
          return `DB has ${dbCount} active agents, stats.json shows ${statsCount} — mismatch > 50`;
        }
        return null;
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Alert email
// ---------------------------------------------------------------------------

async function sendAlert(failures: CheckResult[], runId: string) {
  const lines = failures.map((f) => `- **${f.name}** (${f.ms}ms): ${f.error}`).join("\n");
  const body = `## Health Monitor Alert\n\n**${failures.length} check(s) failed** at ${new Date().toISOString()}\n\nRun ID: ${runId}\n\n${lines}\n\n---\nAutomated alert from health-monitor edge function.`;

  try {
    await fetchT(`${FUNC_BASE}/gmail-send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: ALERT_EMAIL,
        subject: `[TOP10] Health Monitor: ${failures.length} failure(s)`,
        body: body,
        from_account: "robert@top10lists.us",
      }),
    }, 30000);
  } catch (e) {
    console.error("Failed to send alert email:", e);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const allChecks = checks();
  const results: CheckResult[] = [];

  // Run checks in batches of 5 to avoid overwhelming things
  for (let i = 0; i < allChecks.length; i += 5) {
    const batch = allChecks.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map((c) => runCheck(c.name, c.fn))
    );
    results.push(...batchResults);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const failures = results.filter((r) => !r.passed);

  // Log to DB
  const { data: run } = await supabase.from("health_monitor_runs").insert({
    total_checks: results.length,
    passed,
    failed,
    results: results,
    finished_at: new Date().toISOString(),
    alert_sent: failures.length > 0,
  }).select("id").single();

  const runId = run?.id || "unknown";

  // Alert on any failure
  if (failures.length > 0) {
    await sendAlert(failures, runId);
  }

  const summary = {
    run_id: runId,
    total: results.length,
    passed,
    failed,
    failures: failures.map((f) => ({ name: f.name, error: f.error, ms: f.ms })),
    results: results.map((r) => ({ name: r.name, passed: r.passed, ms: r.ms, error: r.error })),
  };

  console.log(`health-monitor: ${passed}/${results.length} passed, ${failed} failed`);

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
