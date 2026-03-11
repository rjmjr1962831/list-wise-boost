import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-enrichment-key",
};

const PROD_BASE = "https://www.top10lists.us";
const STAGING_BASE = "https://staging.top10lists.us";

interface CheckResult {
  url: string;
  category: string;
  status: number;
  ok: boolean;
  error?: string;
  bodySnippet?: string;
  responseTimeMs: number;
}

/**
 * site-health-check
 *
 * Comprehensive health monitor for Top10Lists.us production site.
 * Checks agent profiles, key pages, AI feeds, sitemaps, and edge functions.
 *
 * POST { }                           — full check (production)
 * POST { base: "staging" }           — check staging instead
 * POST { category: "agents" }        — only check agent profiles
 * POST { agent_sample_size: 20 }     — control how many agents to sample (default 25)
 * POST { fix: true }                 — attempt auto-fixes for known issues
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const base = body.base === "staging" ? STAGING_BASE : PROD_BASE;
    const category = body.category || "all";
    const agentSampleSize = body.agent_sample_size || 25;
    const shouldFix = body.fix || false;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const results: CheckResult[] = [];

    // 1. Key pages
    if (category === "all" || category === "pages") {
      const keyPages = [
        { path: "/", name: "Homepage" },
        { path: "/for-ai", name: "For AI" },
        { path: "/transparency", name: "Transparency" },
        { path: "/faq", name: "FAQ" },
        { path: "/methodology", name: "Methodology" },
        { path: "/arizona/phoenix/top10realestateagents", name: "Phoenix city page" },
        { path: "/california/los-angeles/top10realestateagents", name: "LA city page" },
      ];

      for (const page of keyPages) {
        results.push(await checkUrl(`${base}${page.path}`, "key_page"));
      }
    }

    // 2. AI feeds & sitemaps
    if (category === "all" || category === "feeds") {
      const feeds = [
        "/llms.txt",
        "/llms-full.txt",
        "/ai-content-index.json",
        "/coverage.json",
        "/robots.txt",
        "/sitemap.xml",
        "/sitemap-agents.xml",
        "/sitemap-cities.xml",
        "/sitemap-neighborhoods.xml",
        "/mcp.json",
      ];

      for (const feed of feeds) {
        results.push(await checkUrl(`${base}${feed}`, "ai_feed"));
      }
    }

    // 3. Agent profiles — random sample from DB
    if (category === "all" || category === "agents") {
      const { data: agents } = await supabase
        .from("professionals")
        .select("id, name, profile_link, canonical_slug, state_slug")
        .eq("active", true)
        .not("profile_link", "is", null)
        .limit(1000);

      if (agents && agents.length > 0) {
        // Random sample
        const shuffled = agents.sort(() => Math.random() - 0.5);
        const sample = shuffled.slice(0, Math.min(agentSampleSize, shuffled.length));

        // Always include known agents for regression testing
        const knownSlugs = [
          "dina-and-mark-beauvais-4595",
          "david-crozier",
          "jeff-barchi",
        ];
        for (const slug of knownSlugs) {
          const known = agents.find(
            (a: any) => a.canonical_slug?.includes(slug) || a.profile_link?.includes(slug)
          );
          if (known && !sample.find((s: any) => s.id === known.id)) {
            sample.push(known);
          }
        }

        for (const agent of sample) {
          let url: string;
          if (agent.profile_link?.startsWith("http")) {
            // Full URL — use as-is but swap base if needed
            try {
              const parsed = new URL(agent.profile_link);
              url = `${base}${parsed.pathname}`;
            } catch {
              url = agent.profile_link;
            }
          } else if (agent.profile_link) {
            url = `${base}${agent.profile_link}`;
          } else if (agent.state_slug && agent.canonical_slug) {
            url = `${base}/${agent.state_slug}/agents/${agent.canonical_slug}`;
          } else {
            continue;
          }

          const result = await checkUrl(url, "agent_profile");

          // Extra validation: check if the page actually has content (not just 200 with error page)
          if (result.ok && result.bodySnippet) {
            if (
              result.bodySnippet.includes("Not Found") ||
              result.bodySnippet.includes("Application Error") ||
              result.bodySnippet.includes("Internal Server Error") ||
              result.bodySnippet.includes("503 Service Temporarily Unavailable")
            ) {
              result.ok = false;
              result.error = `Page returned 200 but contains error content: ${result.bodySnippet.substring(0, 100)}`;
            }
          }

          results.push(result);
        }
      }
    }

    // 4. Edge function endpoints
    if (category === "all" || category === "functions") {
      const edgeFunctionBase = "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1";
      const functionsToCheck = [
        { name: "enrichment-api", method: "POST", body: { action: "ping" } },
        { name: "serve-bot-content-html", method: "GET", path: "?page=for-ai" },
      ];

      for (const fn of functionsToCheck) {
        const url = fn.path
          ? `${edgeFunctionBase}/${fn.name}${fn.path}`
          : `${edgeFunctionBase}/${fn.name}`;

        const result = await checkUrl(url, "edge_function", {
          method: fn.method || "GET",
          body: fn.body ? JSON.stringify(fn.body) : undefined,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
        });
        results.push(result);
      }
    }

    // Compile results
    const errors = results.filter((r) => !r.ok);
    const totalChecked = results.length;
    const totalErrors = errors.length;

    const summary = totalErrors === 0
      ? `All ${totalChecked} checks passed.`
      : `${totalErrors} of ${totalChecked} checks failed: ${errors.map((e) => `${e.url} (${e.status}${e.error ? ": " + e.error : ""})`).join("; ")}`;

    const durationMs = Date.now() - startTime;

    // Save to DB
    await supabase.from("site_health_checks").insert({
      total_checked: totalChecked,
      total_errors: totalErrors,
      errors: errors.map((e) => ({
        url: e.url,
        category: e.category,
        status: e.status,
        error: e.error || `HTTP ${e.status}`,
        bodySnippet: e.bodySnippet?.substring(0, 500),
        responseTimeMs: e.responseTimeMs,
      })),
      summary,
      duration_ms: durationMs,
    });

    // Auto-fix: redeploy edge functions that return 503
    const fixResults: string[] = [];
    if (shouldFix) {
      const brokenFunctions = errors.filter(
        (e) => e.category === "edge_function" && e.status === 503
      );
      for (const bf of brokenFunctions) {
        // Extract function name from URL
        const match = bf.url.match(/functions\/v1\/([^?/]+)/);
        if (match) {
          fixResults.push(
            `Edge function "${match[1]}" returned 503 — needs manual redeploy: npx supabase functions deploy ${match[1]} --no-verify-jwt`
          );
        }
      }

      // For agent profiles returning 503, flag the serve-bot-agent-html function
      const brokenAgents = errors.filter(
        (e) => e.category === "agent_profile" && (e.status === 503 || e.status === 500)
      );
      if (brokenAgents.length > 0) {
        fixResults.push(
          `${brokenAgents.length} agent profiles returning ${brokenAgents[0].status}. Likely cause: serve-bot-agent-html edge function. Redeploy: npx supabase functions deploy serve-bot-agent-html --no-verify-jwt`
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        base,
        total_checked: totalChecked,
        total_errors: totalErrors,
        summary,
        duration_ms: durationMs,
        errors: errors.map((e) => ({
          url: e.url,
          category: e.category,
          status: e.status,
          error: e.error,
          responseTimeMs: e.responseTimeMs,
        })),
        all_results: results.map((r) => ({
          url: r.url,
          category: r.category,
          status: r.status,
          ok: r.ok,
          responseTimeMs: r.responseTimeMs,
        })),
        fixes: fixResults.length > 0 ? fixResults : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("site-health-check error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkUrl(
  url: string,
  category: string,
  options?: { method?: string; body?: string; headers?: Record<string, string> }
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: options?.method || "GET",
      headers: options?.headers,
      body: options?.body,
      redirect: "follow",
    });

    const responseTimeMs = Date.now() - start;
    let bodySnippet: string | undefined;

    try {
      const text = await res.text();
      bodySnippet = text.substring(0, 500);
    } catch {
      // Body read failed
    }

    return {
      url,
      category,
      status: res.status,
      ok: res.status >= 200 && res.status < 400,
      bodySnippet,
      responseTimeMs,
      error: res.status >= 400 ? `HTTP ${res.status}` : undefined,
    };
  } catch (err: any) {
    return {
      url,
      category,
      status: 0,
      ok: false,
      error: `Fetch failed: ${err.message}`,
      responseTimeMs: Date.now() - start,
    };
  }
}
