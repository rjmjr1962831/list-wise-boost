/**
 * health-check-daily — Comprehensive daily infrastructure audit.
 *
 * Tests EVERYTHING: clean-room rendering, Content-Type headers, bot crawl logging,
 * AI surfaces rollup, email/campaign infra, Stripe, CRM, enrichment pipeline,
 * license verification, database health, sitemaps, edge function deployment,
 * DNS/SSL, and Vercel deployment integrity.
 *
 * Always sends a full report email (not just on failure).
 * Logs to health_check_daily_runs table.
 *
 * pg_cron: 0 14 * * * (7:00 AM MST daily)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENRICHMENT_KEY = Deno.env.get("ENRICHMENT_API_KEY") || "";
const PROD_BASE = "https://www.top10lists.us";
const STAGING_BASE = "https://staging.top10lists.us";
const FUNC_BASE = `${SUPABASE_URL}/functions/v1`;
const ALERT_EMAIL = "robert@aryah.ai";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Severity = "critical" | "warning" | "info";
type Status = "pass" | "fail" | "warn";

interface CheckResult {
  name: string;
  category: string;
  severity: Severity;
  status: Status;
  ms: number;
  error?: string;
  details?: string;
}

// Deprecated patterns that should never appear on public pages
const DEPRECATED_PATTERNS = [
  /4\.8\+?\s*stars/i,
  /20\+?\s*(?:verified\s+)?reviews/i,
  /6\+?\s*years/i,
  /top\s+0\.2\s*%/i,
  /bgdtekbhelormzbymkhh/,
  /invitation[- ]only/i,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchT(
  url: string,
  opts?: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runCheck(
  name: string,
  category: string,
  severity: Severity,
  fn: () => Promise<{ error?: string; details?: string } | null>
): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const result = await fn();
    if (!result || !result.error) {
      return {
        name,
        category,
        severity,
        status: "pass",
        ms: Date.now() - t0,
        details: result?.details,
      };
    }
    return {
      name,
      category,
      severity,
      status: severity === "info" ? "warn" : "fail",
      ms: Date.now() - t0,
      error: result.error,
      details: result.details,
    };
  } catch (e) {
    return {
      name,
      category,
      severity,
      status: "fail",
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ---------------------------------------------------------------------------
// Check: HTML page rendering
// ---------------------------------------------------------------------------

async function checkRenderedPage(
  url: string,
  mustContain: string[]
): Promise<{ error?: string; details?: string } | null> {
  const res = await fetchT(url);
  if (!res.ok) return { error: `HTTP ${res.status}` };

  // Content-Type MUST be text/html
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) {
    return {
      error: `Content-Type: "${ct}" (expected text/html). Browser will show raw source.`,
    };
  }

  const html = await res.text();

  // Check for JS runtime errors in the HTML
  if (/ReferenceError|TypeError|SyntaxError/.test(html)) {
    const match = html.match(
      /(?:ReferenceError|TypeError|SyntaxError)[^<]{0,200}/
    );
    return { error: `JS error in HTML: ${match?.[0] || "unknown"}` };
  }

  // Check for deprecated language
  for (const pat of DEPRECATED_PATTERNS) {
    if (pat.test(html)) {
      return { error: `Deprecated language found: ${pat}` };
    }
  }

  // Check required content
  for (const s of mustContain) {
    if (!html.toLowerCase().includes(s.toLowerCase())) {
      return { error: `Missing expected content: "${s}"` };
    }
  }

  // Warn if slow (> 3s)
  return null;
}

// ---------------------------------------------------------------------------
// All checks by category
// ---------------------------------------------------------------------------

function allChecks(): Array<{
  name: string;
  category: string;
  severity: Severity;
  fn: () => Promise<{ error?: string; details?: string } | null>;
}> {
  return [
    // ================================================================
    // CATEGORY 1: Clean-Room HTML Pages
    // ================================================================
    {
      name: "Homepage renders",
      category: "Pages",
      severity: "critical" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/`, ["top10lists", "merit", "4.5"]),
    },
    {
      name: "AZ State Hub",
      category: "Pages",
      severity: "critical" as Severity,
      fn: () =>
        checkRenderedPage(
          `${PROD_BASE}/arizona/top10realestateagents`,
          ["arizona", "phoenix"]
        ),
    },
    {
      name: "CA State Hub",
      category: "Pages",
      severity: "critical" as Severity,
      fn: () =>
        checkRenderedPage(
          `${PROD_BASE}/california/top10realestateagents`,
          ["california"]
        ),
    },
    {
      name: "Phoenix City Page",
      category: "Pages",
      severity: "critical" as Severity,
      fn: () =>
        checkRenderedPage(
          `${PROD_BASE}/arizona/phoenix/top10realestateagents`,
          ["phoenix", "4.5"]
        ),
    },
    {
      name: "LA City Page",
      category: "Pages",
      severity: "critical" as Severity,
      fn: () =>
        checkRenderedPage(
          `${PROD_BASE}/california/los-angeles/top10realestateagents`,
          ["los angeles"]
        ),
    },
    {
      name: "Agent Profile",
      category: "Pages",
      severity: "critical" as Severity,
      fn: async () => {
        // Pick a real agent from DB
        const { data: agent } = await supabase
          .from("professionals")
          .select("canonical_slug, state_slug, name")
          .eq("active", true)
          .not("canonical_slug", "is", null)
          .limit(1)
          .single();
        if (!agent) return { error: "No active agent found in DB" };
        return checkRenderedPage(
          `${PROD_BASE}/${agent.state_slug}/agents/${agent.canonical_slug}`,
          [agent.name.split(" ")[0]]
        );
      },
    },
    {
      name: "Neighborhood Page",
      category: "Pages",
      severity: "warning" as Severity,
      fn: async () => {
        const { data: nh } = await supabase
          .from("neighborhood_catalog")
          .select("slug, city_slug, state_slug")
          .eq("state_slug", "arizona")
          .limit(1)
          .single();
        if (!nh) return { error: "No neighborhood found in DB" };
        return checkRenderedPage(
          `${PROD_BASE}/${nh.state_slug}/${nh.city_slug}/${nh.slug}/top10realestateagents`,
          [nh.slug.replace(/-/g, " ").substring(0, 10)]
        );
      },
    },
    {
      name: "Transparency",
      category: "Pages",
      severity: "warning" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/transparency`, [
          "transparency",
          "merit",
        ]),
    },
    {
      name: "FAQ",
      category: "Pages",
      severity: "warning" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/faq`, ["frequently"]),
    },
    {
      name: "For AI",
      category: "Pages",
      severity: "critical" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/for-ai`, ["ai"]),
    },
    {
      name: "Methodology",
      category: "Pages",
      severity: "warning" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/about/ranking-methodology`, [
          "methodology",
        ]),
    },
    {
      name: "Founder",
      category: "Pages",
      severity: "warning" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/about/founder`, ["robert"]),
    },
    {
      name: "About",
      category: "Pages",
      severity: "warning" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/about`, ["top10lists"]),
    },
    {
      name: "Privacy",
      category: "Pages",
      severity: "warning" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/privacy`, ["privacy"]),
    },
    {
      name: "Terms",
      category: "Pages",
      severity: "warning" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/terms`, ["terms"]),
    },
    {
      name: "Crawl Stats",
      category: "Pages",
      severity: "warning" as Severity,
      fn: () =>
        checkRenderedPage(`${PROD_BASE}/crawl-stats`, ["crawl"]),
    },

    // ================================================================
    // CATEGORY 2: Proxy & Headers
    // ================================================================
    {
      name: "Proxy rejects invalid fn",
      category: "Proxy",
      severity: "warning" as Severity,
      fn: async () => {
        const res = await fetchT(
          `${PROD_BASE}/api/html?fn=evil-function&path=/`
        );
        if (res.status !== 400)
          return { error: `Expected 400, got ${res.status}` };
        return null;
      },
    },
    {
      name: "X-Rendered header present",
      category: "Proxy",
      severity: "warning" as Severity,
      fn: async () => {
        const res = await fetchT(
          `${PROD_BASE}/arizona/phoenix/top10realestateagents`
        );
        const xr = res.headers.get("x-rendered");
        if (!xr) return { error: "Missing X-Rendered header" };
        if (!xr.startsWith("serve-bot-"))
          return { error: `Unexpected X-Rendered: ${xr}` };
        await res.text(); // drain
        return null;
      },
    },

    // ================================================================
    // CATEGORY 3: Bot Crawl Logging
    // ================================================================
    {
      name: "Crawl logs in last 24h",
      category: "Bot Logging",
      severity: "critical" as Severity,
      fn: async () => {
        const dayAgo = new Date(Date.now() - 86400000).toISOString();
        const { count, error } = await supabase
          .from("bot_crawl_logs")
          .select("id", { count: "exact", head: true })
          .gte("crawled_at", dayAgo);
        if (error) return { error: `DB error: ${error.message}` };
        if (!count || count === 0)
          return { error: "Zero crawl logs in last 24h — logging may be broken" };
        return { details: `${count} entries in last 24h` };
      },
    },
    {
      name: "AI bot crawls present",
      category: "Bot Logging",
      severity: "warning" as Severity,
      fn: async () => {
        const dayAgo = new Date(Date.now() - 86400000).toISOString();
        const { data, error } = await supabase
          .from("bot_crawl_logs")
          .select("bot_name")
          .gte("crawled_at", dayAgo)
          .in("bot_name", [
            "ChatGPT-User",
            "GPTBot",
            "ClaudeBot",
            "PerplexityBot",
            "Googlebot",
          ])
          .limit(1);
        if (error) return { error: `DB error: ${error.message}` };
        if (!data || data.length === 0)
          return {
            error:
              "No AI bot crawls in 24h (ChatGPT, Claude, Perplexity, Google)",
          };
        return null;
      },
    },
    {
      name: "Bot diversity (>=3 distinct)",
      category: "Bot Logging",
      severity: "warning" as Severity,
      fn: async () => {
        const dayAgo = new Date(Date.now() - 86400000).toISOString();
        const { data, error } = await supabase.rpc("run_sql", {
          query: `SELECT COUNT(DISTINCT bot_name) as cnt FROM bot_crawl_logs WHERE crawled_at >= '${dayAgo}'`,
        });
        if (error) return { error: `RPC error: ${error.message}` };
        const cnt = data?.[0]?.cnt || 0;
        if (cnt < 3) return { error: `Only ${cnt} distinct bot names in 24h` };
        return { details: `${cnt} distinct bots in 24h` };
      },
    },
    {
      name: "logBotVisit e2e probe",
      category: "Bot Logging",
      severity: "critical" as Severity,
      fn: async () => {
        // Fetch a page as GPTBot to trigger logBotVisit
        const before = new Date().toISOString();
        await fetchT(`${PROD_BASE}/arizona/phoenix/top10realestateagents`, {
          headers: { "User-Agent": "GPTBot/1.0 (+https://openai.com/gptbot)" },
        });
        // Wait for fire-and-forget insert
        await delay(4000);
        const { count, error } = await supabase
          .from("bot_crawl_logs")
          .select("id", { count: "exact", head: true })
          .eq("bot_name", "GPTBot")
          .gte("crawled_at", before);
        if (error) return { error: `DB error: ${error.message}` };
        if (!count || count === 0)
          return {
            error:
              "GPTBot probe did not appear in crawl logs — logBotVisit may be broken",
          };
        return null;
      },
    },

    // ================================================================
    // CATEGORY 4: AI Surfaces Rollup
    // ================================================================
    {
      name: "agent_ai_surfaces has recent data",
      category: "AI Surfaces",
      severity: "warning" as Severity,
      fn: async () => {
        const { data, error } = await supabase
          .from("agent_ai_surfaces")
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
        if (error) return { error: `DB error: ${error.message}` };
        if (!data) return { error: "No data in agent_ai_surfaces" };
        const age =
          (Date.now() - new Date(data.updated_at).getTime()) / 3600000;
        if (age > 48)
          return {
            error: `Last rollup was ${Math.round(age)}h ago (expected < 48h)`,
          };
        return { details: `Last rollup ${Math.round(age)}h ago` };
      },
    },

    // ================================================================
    // CATEGORY 5: Email & Campaigns
    // ================================================================
    {
      name: "Gmail OAuth tokens",
      category: "Email",
      severity: "critical" as Severity,
      fn: async () => {
        const { data, error } = await supabase
          .from("crm_email_accounts")
          .select("email, refresh_token");
        if (error) return { error: `DB error: ${error.message}` };
        if (!data || data.length === 0)
          return { error: "No sender accounts found" };
        const noToken = data.filter((a: any) => !a.refresh_token);
        if (noToken.length > 0)
          return {
            error: `Missing refresh_token: ${noToken.map((a: any) => a.email).join(", ")}`,
          };
        return { details: `${data.length} sender accounts, all have tokens` };
      },
    },
    {
      name: "Email queue not stuck",
      category: "Email",
      severity: "warning" as Severity,
      fn: async () => {
        const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
        const { count, error } = await supabase
          .from("email_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .lt("created_at", twoHoursAgo);
        if (error) return { error: `DB error: ${error.message}` };
        if (count && count > 0)
          return { error: `${count} emails stuck in approved status > 2h` };
        return null;
      },
    },
    {
      name: "sequencer-v2-tick responds",
      category: "Email",
      severity: "critical" as Severity,
      fn: async () => {
        const res = await fetchT(
          `${FUNC_BASE}/sequencer-v2-tick`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          },
          30000
        );
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return null;
      },
    },
    {
      name: "email-track pixel",
      category: "Email",
      severity: "critical" as Severity,
      fn: async () => {
        const res = await fetchT(
          `${PROD_BASE}/api/t?t=o&eid=health-probe-daily`,
          {},
          10000
        );
        if (res.status >= 500) return { error: `HTTP ${res.status}` };
        return null;
      },
    },
    {
      name: "Bounce rate < 5%",
      category: "Email",
      severity: "warning" as Severity,
      fn: async () => {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { count: total } = await supabase
          .from("email_queue")
          .select("id", { count: "exact", head: true })
          .in("status", ["sent", "failed"])
          .gte("created_at", weekAgo);
        const { count: bounced } = await supabase
          .from("email_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("created_at", weekAgo);
        if (!total || total === 0) return { details: "No emails sent in 7d" };
        const rate = ((bounced || 0) / total) * 100;
        if (rate > 5)
          return { error: `Bounce rate ${rate.toFixed(1)}% (${bounced}/${total})` };
        return {
          details: `Bounce rate ${rate.toFixed(1)}% (${bounced}/${total})`,
        };
      },
    },

    // ================================================================
    // CATEGORY 6: Stripe & Payments
    // ================================================================
    {
      name: "stripe-webhook deployed",
      category: "Stripe",
      severity: "critical" as Severity,
      fn: async () => {
        // POST with no valid signature should return 400, not 500 or 404
        const res = await fetchT(`${FUNC_BASE}/stripe-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (res.status === 404)
          return { error: "stripe-webhook not deployed (404)" };
        if (res.status >= 500)
          return { error: `stripe-webhook crashed: HTTP ${res.status}` };
        // 400 = expected (bad signature)
        return { details: `HTTP ${res.status} (expected ~400)` };
      },
    },
    {
      name: "create-agent-checkout deployed",
      category: "Stripe",
      severity: "critical" as Severity,
      fn: async () => {
        const res = await fetchT(`${FUNC_BASE}/create-agent-checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({}),
        });
        if (res.status === 404)
          return { error: "create-agent-checkout not deployed" };
        if (res.status >= 500)
          return { error: `HTTP ${res.status}` };
        return { details: `HTTP ${res.status}` };
      },
    },

    // ================================================================
    // CATEGORY 7: CRM
    // ================================================================
    {
      name: "crm_tasks accessible",
      category: "CRM",
      severity: "warning" as Severity,
      fn: async () => {
        const { count, error } = await supabase
          .from("crm_tasks")
          .select("id", { count: "exact", head: true });
        if (error) return { error: `DB error: ${error.message}` };
        return { details: `${count} total tasks` };
      },
    },
    {
      name: "Pending sales tasks",
      category: "CRM",
      severity: "info" as Severity,
      fn: async () => {
        const { count } = await supabase
          .from("crm_tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .in("type", [
            "email_clicked",
            "funnel_landed",
            "funnel_engaged",
            "funnel_pricing_viewed",
          ]);
        return { details: `${count || 0} pending sales tasks` };
      },
    },

    // ================================================================
    // CATEGORY 8: Enrichment Pipeline
    // ================================================================
    {
      name: "enrichment-api query",
      category: "Enrichment",
      severity: "critical" as Severity,
      fn: async () => {
        const res = await fetchT(`${FUNC_BASE}/enrichment-api?action=query`, {
          method: "POST",
          headers: {
            "X-Enrichment-Key": ENRICHMENT_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table: "professionals",
            select: "id,name",
            filters: [
              { field: "state_slug", operator: "eq", value: "arizona" },
            ],
            limit: 1,
          }),
        });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const data = await res.json();
        if (data.error) return { error: `API error: ${data.error}` };
        if (!data.data?.length) return { error: "No data returned" };
        return null;
      },
    },
    {
      name: "enrichment-api SQL (run_sql)",
      category: "Enrichment",
      severity: "critical" as Severity,
      fn: async () => {
        const { data, error } = await supabase.rpc("run_sql", {
          query: "SELECT 1 as ok",
        });
        if (error) return { error: `RPC error: ${error.message}` };
        if (!data?.[0]?.ok) return { error: "run_sql returned no data" };
        return null;
      },
    },

    // ================================================================
    // CATEGORY 9: License Verification
    // ================================================================
    {
      name: "verify-licenses-nightly deployed",
      category: "Licenses",
      severity: "warning" as Severity,
      fn: async () => {
        const res = await fetchT(`${FUNC_BASE}/verify-licenses-nightly`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dry_run: true, limit: 1 }),
        });
        if (res.status === 404)
          return { error: "Not deployed" };
        if (res.status >= 500)
          return { error: `HTTP ${res.status}` };
        return null;
      },
    },
    {
      name: "Recent license verifications",
      category: "Licenses",
      severity: "warning" as Severity,
      fn: async () => {
        const threeDaysAgo = new Date(
          Date.now() - 3 * 86400000
        ).toISOString();
        const { count, error } = await supabase
          .from("professionals")
          .select("id", { count: "exact", head: true })
          .gte("license_verified_at", threeDaysAgo);
        if (error) return { error: `DB error: ${error.message}` };
        if (!count || count === 0)
          return { error: "No license verifications in last 3 days" };
        return { details: `${count} verified in last 3 days` };
      },
    },

    // ================================================================
    // CATEGORY 10: Database Health
    // ================================================================
    {
      name: "Active professionals count",
      category: "Database",
      severity: "critical" as Severity,
      fn: async () => {
        const { count, error } = await supabase
          .from("professionals")
          .select("id", { count: "exact", head: true })
          .eq("active", true);
        if (error) return { error: `DB error: ${error.message}` };
        if (!count || count < 100)
          return { error: `Only ${count} active agents (expected 3000+)` };
        return { details: `${count} active agents` };
      },
    },
    {
      name: "AZ agents",
      category: "Database",
      severity: "critical" as Severity,
      fn: async () => {
        const { count, error } = await supabase
          .from("professionals")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .eq("state_slug", "arizona");
        if (error) return { error: `DB error: ${error.message}` };
        if (!count || count < 50)
          return { error: `Only ${count} AZ agents` };
        return { details: `${count} AZ agents` };
      },
    },
    {
      name: "CA agents",
      category: "Database",
      severity: "critical" as Severity,
      fn: async () => {
        const { count, error } = await supabase
          .from("professionals")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .eq("state_slug", "california");
        if (error) return { error: `DB error: ${error.message}` };
        if (!count || count < 100)
          return { error: `Only ${count} CA agents` };
        return { details: `${count} CA agents` };
      },
    },
    {
      name: "neighborhood_catalog rows",
      category: "Database",
      severity: "warning" as Severity,
      fn: async () => {
        const { count, error } = await supabase
          .from("neighborhood_catalog")
          .select("id", { count: "exact", head: true });
        if (error) return { error: `DB error: ${error.message}` };
        if (!count || count < 1000)
          return { error: `Only ${count} neighborhoods` };
        return { details: `${count} neighborhoods` };
      },
    },
    {
      name: "email_queue accessible",
      category: "Database",
      severity: "warning" as Severity,
      fn: async () => {
        const { count, error } = await supabase
          .from("email_queue")
          .select("id", { count: "exact", head: true });
        if (error) return { error: `DB error: ${error.message}` };
        return { details: `${count} queue rows` };
      },
    },
    {
      name: "pg_cron jobs running",
      category: "Database",
      severity: "warning" as Severity,
      fn: async () => {
        const { data, error } = await supabase.rpc("run_sql", {
          query:
            "SELECT jobname, schedule, active FROM cron.job WHERE active = true ORDER BY jobname",
        });
        if (error) return { error: `RPC error: ${error.message}` };
        const jobs = data || [];
        const expected = [
          "sequencer-v2-tick",
          "health-monitor",
        ];
        const missing = expected.filter(
          (name) => !jobs.some((j: any) => j.jobname?.includes(name))
        );
        if (missing.length > 0)
          return { error: `Missing cron jobs: ${missing.join(", ")}` };
        return {
          details: `${jobs.length} active cron jobs`,
        };
      },
    },
    {
      name: "DB counts match stats.json",
      category: "Database",
      severity: "warning" as Severity,
      fn: async () => {
        const { count: dbCount } = await supabase
          .from("professionals")
          .select("id", { count: "exact", head: true })
          .eq("active", true);
        const statsRes = await fetchT(`${PROD_BASE}/stats.json`);
        if (!statsRes.ok) return { error: `stats.json HTTP ${statsRes.status}` };
        const stats = await statsRes.json();
        const diff = Math.abs((dbCount || 0) - (stats.agents_total || 0));
        if (diff > 50)
          return {
            error: `DB=${dbCount}, stats.json=${stats.agents_total} (diff ${diff})`,
          };
        return {
          details: `DB=${dbCount}, stats.json=${stats.agents_total}`,
        };
      },
    },

    // ================================================================
    // CATEGORY 11: Sitemaps & SEO
    // ================================================================
    {
      name: "sitemap.xml valid",
      category: "SEO",
      severity: "critical" as Severity,
      fn: async () => {
        const res = await fetchT(`${PROD_BASE}/sitemap.xml`);
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const xml = await res.text();
        if (!xml.includes("<sitemapindex") && !xml.includes("<urlset"))
          return { error: "Not valid XML sitemap" };
        return null;
      },
    },
    {
      name: "robots.txt correct",
      category: "SEO",
      severity: "critical" as Severity,
      fn: async () => {
        const res = await fetchT(`${PROD_BASE}/robots.txt`);
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const txt = await res.text();
        if (!txt.includes("Allow: /")) return { error: "Missing Allow: /" };
        if (!txt.includes("Disallow: /admin"))
          return { error: "Missing Disallow: /admin" };
        return null;
      },
    },
    {
      name: "llms.txt exists",
      category: "SEO",
      severity: "warning" as Severity,
      fn: async () => {
        const res = await fetchT(`${PROD_BASE}/llms.txt`);
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const txt = await res.text();
        if (!txt.toLowerCase().includes("top10lists"))
          return { error: "llms.txt doesn't mention top10lists" };
        return null;
      },
    },
    {
      name: "MCP endpoint",
      category: "SEO",
      severity: "warning" as Severity,
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
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const data = await res.json();
        if (!data.result?.tools?.length)
          return { error: "No tools in MCP response" };
        return { details: `${data.result.tools.length} MCP tools` };
      },
    },
    {
      name: ".well-known/mcp.json",
      category: "SEO",
      severity: "warning" as Severity,
      fn: async () => {
        const res = await fetchT(
          `${PROD_BASE}/.well-known/mcp.json`
        );
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const data = await res.json();
        if (!data) return { error: "Empty response" };
        return null;
      },
    },

    // ================================================================
    // CATEGORY 12: Edge Function Deployment
    // ================================================================
    ...([
      "serve-bot-home-html",
      "serve-bot-list-html",
      "serve-bot-agent-html",
      "serve-bot-state-html",
      "serve-bot-content-html",
      "serve-bot-pages-html",
      "serve-bot-founder-html",
      "serve-bot-crawl-stats-html",
      "serve-bot-qa-html",
      "gmail-send",
      "gmail-sync",
      "enrichment-api",
      "stripe-webhook",
      "email-track",
      "unsubscribe",
      "serve-stats-json",
      "coverage-stats",
    ] as const).map((fn) => ({
      name: `${fn} deployed`,
      category: "Edge Functions",
      severity: (fn.startsWith("serve-bot") ? "critical" : "warning") as Severity,
      fn: async () => {
        const res = await fetchT(`${FUNC_BASE}/${fn}`, {
          method: "OPTIONS",
        });
        // OPTIONS should return 200 or 204 if deployed
        if (res.status === 404) return { error: `${fn} not deployed (404)` };
        return null;
      },
    })),

    // ================================================================
    // CATEGORY 13: DNS & SSL
    // ================================================================
    {
      name: "Production site reachable",
      category: "DNS/SSL",
      severity: "critical" as Severity,
      fn: async () => {
        const res = await fetchT(`${PROD_BASE}/`, { method: "HEAD" });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return null;
      },
    },
    {
      name: "Staging site reachable",
      category: "DNS/SSL",
      severity: "warning" as Severity,
      fn: async () => {
        const res = await fetchT(`${STAGING_BASE}/`, { method: "HEAD" });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return null;
      },
    },
    {
      name: "Staging has noindex",
      category: "DNS/SSL",
      severity: "warning" as Severity,
      fn: async () => {
        const res = await fetchT(`${STAGING_BASE}/`);
        const xrt = res.headers.get("x-robots-tag") || "";
        await res.text(); // drain
        if (!xrt.includes("noindex"))
          return { error: "Staging missing X-Robots-Tag: noindex" };
        return null;
      },
    },

    // ================================================================
    // CATEGORY 14: Artifact System
    // ================================================================
    {
      name: "Artifact page renders",
      category: "Artifacts",
      severity: "warning" as Severity,
      fn: async () => {
        const { data: agent } = await supabase
          .from("professionals")
          .select("verification_token, id, name")
          .not("verification_token", "is", null)
          .eq("active", true)
          .limit(1)
          .single();
        if (!agent) return { error: "No agent with verification_token" };
        const token = agent.verification_token || agent.id;
        const res = await fetchT(`${PROD_BASE}/artifact/${token}`);
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const html = await res.text();
        if (html.length < 200) return { error: "Response too short" };
        return null;
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Email report
// ---------------------------------------------------------------------------

function buildEmailHtml(results: CheckResult[], startedAt: Date): string {
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;

  const overall =
    failed > 0 ? "RED" : warned > 0 ? "YELLOW" : "GREEN";
  const overallColor =
    overall === "RED"
      ? "#dc2626"
      : overall === "YELLOW"
        ? "#d97706"
        : "#16a34a";

  // Group by category
  const categories = new Map<string, CheckResult[]>();
  for (const r of results) {
    if (!categories.has(r.category)) categories.set(r.category, []);
    categories.get(r.category)!.push(r);
  }

  let categoryRows = "";
  for (const [cat, checks] of categories) {
    const catFailed = checks.filter((c) => c.status === "fail").length;
    const catWarn = checks.filter((c) => c.status === "warn").length;
    const catColor =
      catFailed > 0 ? "#dc2626" : catWarn > 0 ? "#d97706" : "#16a34a";

    categoryRows += `
      <tr style="background:#f9fafb;">
        <td colspan="5" style="padding:12px 16px;font-weight:700;font-size:14px;border-top:2px solid ${catColor};color:${catColor};">
          ${cat} (${checks.length - catFailed - catWarn}/${checks.length} passed)
        </td>
      </tr>`;

    for (const c of checks) {
      const icon =
        c.status === "pass" ? "✅" : c.status === "fail" ? "❌" : "⚠️";
      const bg = c.status === "fail" ? "#fef2f2" : c.status === "warn" ? "#fffbeb" : "#fff";
      categoryRows += `
        <tr style="background:${bg};">
          <td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;">${icon}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${c.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${c.severity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${c.ms}ms</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:${c.error ? "#dc2626" : "#6b7280"};">${c.error || c.details || "—"}</td>
        </tr>`;
    }
  }

  const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;padding:20px;">
    <div style="max-width:800px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:${overallColor};padding:24px 32px;color:white;">
        <h1 style="margin:0;font-size:22px;">Daily Infrastructure Report: ${overall}</h1>
        <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">${new Date().toLocaleString("en-US", { timeZone: "America/Phoenix" })} MST &bull; ${elapsed}s &bull; ${results.length} checks</p>
      </div>
      <div style="padding:24px 32px;">
        <div style="display:flex;gap:24px;margin-bottom:24px;">
          <div style="text-align:center;padding:16px 24px;background:#f0fdf4;border-radius:8px;flex:1;">
            <div style="font-size:28px;font-weight:700;color:#16a34a;">${passed}</div>
            <div style="font-size:12px;color:#6b7280;">Passed</div>
          </div>
          <div style="text-align:center;padding:16px 24px;background:#fef2f2;border-radius:8px;flex:1;">
            <div style="font-size:28px;font-weight:700;color:#dc2626;">${failed}</div>
            <div style="font-size:12px;color:#6b7280;">Failed</div>
          </div>
          <div style="text-align:center;padding:16px 24px;background:#fffbeb;border-radius:8px;flex:1;">
            <div style="font-size:28px;font-weight:700;color:#d97706;">${warned}</div>
            <div style="font-size:12px;color:#6b7280;">Warnings</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 16px;text-align:left;font-size:11px;color:#6b7280;"></th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Check</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Severity</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Time</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRows}
          </tbody>
        </table>
      </div>
      <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Top10Lists.us Daily Health Check &bull; ${results.length} checks across ${categories.size} categories</p>
      </div>
    </div>
  </body></html>`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = new Date();
  console.log("Starting comprehensive daily health check...");

  const checks = allChecks();
  const results: CheckResult[] = [];

  // Run in batches of 8 to avoid overwhelming
  for (let i = 0; i < checks.length; i += 8) {
    const batch = checks.slice(i, i + 8);
    const batchResults = await Promise.all(
      batch.map((c) => runCheck(c.name, c.category, c.severity, c.fn))
    );
    results.push(...batchResults);
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const criticalFails = results.filter(
    (r) => r.status === "fail" && r.severity === "critical"
  ).length;

  const overall =
    criticalFails > 0 ? "red" : failed > 0 ? "yellow" : warned > 0 ? "yellow" : "green";

  console.log(
    `Health check complete: ${passed} passed, ${failed} failed, ${warned} warnings`
  );

  // Log to DB
  const { data: run } = await supabase
    .from("health_check_daily_runs")
    .insert({
      total_checks: results.length,
      passed,
      warnings: warned,
      failed,
      critical_failures: criticalFails,
      overall_status: overall,
      results,
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // Always send report email via gmail-send
  const emailHtml = buildEmailHtml(results, startedAt);
  const subjectEmoji = overall === "green" ? "✅" : overall === "yellow" ? "⚠️" : "🔴";
  try {
    await fetchT(
      `${FUNC_BASE}/gmail-send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: ALERT_EMAIL,
          subject: `${subjectEmoji} Daily Health: ${passed}/${results.length} passed${criticalFails > 0 ? ` (${criticalFails} CRITICAL)` : ""}`,
          body: emailHtml,
          from_account: "robert@top10lists.us",
        }),
      },
      30000
    );
  } catch (e) {
    console.error("Failed to send daily report email:", e);
  }

  const summary = {
    run_id: run?.id,
    overall_status: overall,
    total: results.length,
    passed,
    failed,
    warnings: warned,
    critical_failures: criticalFails,
    failures: results
      .filter((r) => r.status === "fail")
      .map((r) => ({ name: r.name, category: r.category, severity: r.severity, error: r.error })),
    results: results.map((r) => ({
      name: r.name,
      category: r.category,
      severity: r.severity,
      status: r.status,
      ms: r.ms,
      error: r.error,
      details: r.details,
    })),
  };

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
