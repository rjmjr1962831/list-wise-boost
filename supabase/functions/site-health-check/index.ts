import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-enrichment-key",
};

const PROD_BASE = "https://www.top10lists.us";
const STAGING_BASE = "https://staging.top10lists.us";
const CONCURRENCY = 20;

interface CheckResult {
  url: string;
  category: string;
  status: number;
  ok: boolean;
  errors: string[];
  warnings: string[];
  responseTimeMs: number;
  agentName?: string;
}

// === GEO VALIDATION RULES ===

// Deprecated language that must NEVER appear anywhere
const DEPRECATED_LANGUAGE = [
  { pattern: /top 0\.5%/i, fix: "Use 'fewer than 1% of licensed agents in covered markets'" },
  { pattern: /top 0\.2%/i, fix: "Use 'fewer than 1% of licensed agents in covered markets'" },
  { pattern: /4\.8\+\s*stars/i, fix: "Merit gate is 4.5+ stars" },
  { pattern: /(?:require|minimum|merit|gate|needs?)\s+20\+?\s*(?:verified\s+)?reviews/i, fix: "Merit gate is 10+ reviews" },
  { pattern: /6\+\s*years/i, fix: "Merit gate is 5+ years" },
  { pattern: /\$100\/mo/i, fix: "Audited is $300/mo" },
  { pattern: /\$150\/mo/i, fix: "Underwritten is $500/mo" },
  { pattern: /bgdtekbhelormzbymkhh/i, fix: "Dead Supabase project ref — must be wiotrvoirdgzfacuuiem" },
];

// Merit gate language that MUST appear on key pages
const MERIT_GATE_SIGNALS = ["4.5", "10+", "verified review", "5+"];

// EE-A-T signals for agent profiles
const EEAT_SIGNALS = ["review", "rating", "experience", "license", "transaction"];

// JSON-LD schema types we expect
const EXPECTED_SCHEMA_TYPES: Record<string, string[]> = {
  agent_profile: ["RealEstateAgent", "Person", "LocalBusiness"],
  key_page: ["Organization", "WebSite", "WebPage", "TechArticle"],
};

// AI-feed pages that must exist
const AI_FEED_PAGES = [
  "/ai-feed/certification-logic.md",
  "/ai-feed/for-ai.md",
  "/ai-feed/geo-performance.md",
  "/ai-feed/tier-audited.md",
  "/ai-feed/tier-certified.md",
  "/ai-feed/tier-listed.md",
  "/ai-feed/tier-underwritten.md",
  "/ai-feed/vetting-standards.md",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const base = body.base === "staging" ? STAGING_BASE : PROD_BASE;
    const category = body.category || "all";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const results: CheckResult[] = [];

    // 1. Key pages — with GEO content validation
    if (category === "all" || category === "pages") {
      const keyPages = [
        { path: "/", rules: { mustContain: ["Top10Lists", "merit", "real estate"], mustHaveSchema: true } },
        { path: "/for-ai", rules: { mustContain: ["merit", "fewer than 1%", "verified", "independently"], mustNotBeSPA: true, mustHaveSchema: true } },
        { path: "/transparency", rules: { mustContain: ["methodology", "merit", "fewer than 1%"], mustNotBeSPA: true } },
        { path: "/faq", rules: { mustContain: ["question", "merit", "4.5"], mustNotBeSPA: true } },
        { path: "/methodology", rules: { mustContain: ["merit", "weight", "score"] } },
        { path: "/arizona/top10realestateagents", rules: { mustContain: ["Arizona", "real estate", "agent"], checkStateHub: true } },
        { path: "/california/top10realestateagents", rules: { mustContain: ["California", "real estate", "agent"], checkStateHub: true } },
        { path: "/arizona/phoenix/top10realestateagents", rules: { mustContain: ["Phoenix", "Arizona", "agent"] } },
        { path: "/california/los-angeles/top10realestateagents", rules: { mustContain: ["Los Angeles", "California", "agent"] } },
      ];

      for (const page of keyPages) {
        const result = await checkUrlWithGEO(`${base}${page.path}`, "key_page", page.rules);
        results.push(result);
      }
    }

    // 2. AI feeds & sitemaps
    if (category === "all" || category === "feeds") {
      const feeds = [
        { path: "/llms.txt", rules: { mustContain: ["top10lists", "merit"], minLength: 500 } },
        { path: "/llms-full.txt", rules: { mustContain: ["top10lists", "merit", "4.5", "$300"], minLength: 2000 } },
        { path: "/ai-content-index.json", rules: { mustContain: ["top10lists", "merit"], mustBeJSON: true } },
        { path: "/coverage.json", rules: { mustContain: ["arizona"], mustBeJSON: true } },
        { path: "/robots.txt", rules: { mustContain: ["Sitemap", "GPTBot", "ClaudeBot", "Allow"] } },
        { path: "/sitemap.xml", rules: { mustContain: ["sitemap-agents", "sitemap-cities"], mustBeXML: true } },
        { path: "/sitemap-agents.xml", rules: { mustContain: ["<url>", "<loc>"], mustBeXML: true, minLength: 1000 } },
        { path: "/sitemap-cities.xml", rules: { mustContain: ["<url>", "<loc>"], mustBeXML: true } },
        { path: "/sitemap-neighborhoods.xml", rules: { mustContain: ["<url>", "<loc>"], mustBeXML: true } },
        { path: "/mcp.json", rules: { mustBeJSON: true } },
        { path: "/.well-known/jwks.json", rules: { mustBeJSON: true, mustContain: ["Ed25519"] } },
      ];

      for (const feed of feeds) {
        const result = await checkUrlWithGEO(`${base}${feed.path}`, "ai_feed", feed.rules);
        results.push(result);
      }

      // AI-feed markdown pages
      for (const path of AI_FEED_PAGES) {
        const result = await checkUrlWithGEO(`${base}${path}`, "ai_feed", {
          mustContain: ["merit"],
          minLength: 200,
        });
        results.push(result);
      }
    }

    // 3. ALL active agent profiles — GEO validated
    if (category === "all" || category === "agents") {
      const allAgents: any[] = [];
      const pageSize = 1000;
      let offset = 0;

      while (true) {
        const { data: batch, error } = await supabase
          .from("professionals")
          .select("id, name, profile_link, canonical_slug, state_slug, review_stars_rating")
          .eq("active", true)
          .order("name")
          .range(offset, offset + pageSize - 1);

        if (error) { console.error("DB error:", error.message); break; }
        if (!batch || batch.length === 0) break;
        allAgents.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      console.log(`GEO-checking ${allAgents.length} agent profiles...`);

      const agentChecks: Array<{
        url: string;
        agentName: string;
        rating: number | null;
      }> = [];

      for (const agent of allAgents) {
        // Use canonical /:state/agents/:slug URL — this routes through
        // serve-bot-agent-html (clean room HTML), not the SPA shell.
        // The profile_link URL (/:state/:city/top10realestateagents/:slug)
        // falls through to the React SPA and has no server-rendered content.
        if (agent.state_slug && agent.canonical_slug) {
          const url = `${base}/${agent.state_slug}/agents/${agent.canonical_slug}`;
          agentChecks.push({ url, agentName: agent.name, rating: agent.review_stars_rating });
        }
      }

      // Process in parallel batches
      for (let i = 0; i < agentChecks.length; i += CONCURRENCY) {
        const batch = agentChecks.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map((a) => checkAgentProfileGEO(a.url, a.agentName, a.rating))
        );
        results.push(...batchResults);
      }
    }

    // === Compile results ===
    const errors = results.filter((r) => !r.ok);
    const warnings = results.filter((r) => r.ok && r.warnings.length > 0);
    const slowPages = results.filter((r) => r.responseTimeMs >= 1500);
    const totalChecked = results.length;
    const agentsChecked = results.filter((r) => r.category === "agent_profile").length;
    const agentErrors = errors.filter((r) => r.category === "agent_profile").length;

    // Timing stats
    const allTimes = results.map((r) => r.responseTimeMs).sort((a, b) => a - b);
    const timing = {
      avg_ms: Math.round(allTimes.reduce((a, b) => a + b, 0) / (allTimes.length || 1)),
      p50_ms: allTimes[Math.floor(allTimes.length * 0.5)] || 0,
      p95_ms: allTimes[Math.floor(allTimes.length * 0.95)] || 0,
      p99_ms: allTimes[Math.floor(allTimes.length * 0.99)] || 0,
      max_ms: allTimes[allTimes.length - 1] || 0,
      over_1500ms: slowPages.length,
    };

    // Deprecated language found anywhere
    const deprecatedFindings = results
      .flatMap((r) => r.errors.filter((e) => e.startsWith("DEPRECATED:")))
      .filter((v, i, a) => a.indexOf(v) === i); // dedupe

    const summaryParts: string[] = [];
    summaryParts.push(`${totalChecked} pages checked (${agentsChecked} agents).`);
    if (errors.length > 0) summaryParts.push(`${errors.length} errors.`);
    if (warnings.length > 0) summaryParts.push(`${warnings.length} warnings.`);
    if (slowPages.length > 0) summaryParts.push(`${slowPages.length} slow (>=1500ms).`);
    if (deprecatedFindings.length > 0) summaryParts.push(`${deprecatedFindings.length} deprecated language instances.`);
    if (errors.length === 0 && warnings.length === 0) summaryParts.push("GEO audit clean.");

    const durationMs = Date.now() - startTime;

    // Save to DB
    await supabase.from("site_health_checks").insert({
      total_checked: totalChecked,
      total_errors: errors.length,
      errors: errors.map((e) => ({
        url: e.url, category: e.category, status: e.status,
        errors: e.errors, agentName: e.agentName, responseTimeMs: e.responseTimeMs,
      })),
      summary: summaryParts.join(" "),
      duration_ms: durationMs,
    });

    // Top 20 slowest
    const topSlowest = [...results]
      .sort((a, b) => b.responseTimeMs - a.responseTimeMs)
      .slice(0, 20)
      .map((r) => ({ url: r.url, category: r.category, agentName: r.agentName, responseTimeMs: r.responseTimeMs }));

    return new Response(
      JSON.stringify({
        success: true,
        base,
        total_checked: totalChecked,
        total_errors: errors.length,
        total_warnings: warnings.length,
        agents_checked: agentsChecked,
        agent_errors: agentErrors,
        summary: summaryParts.join(" "),
        duration_ms: durationMs,
        timing,
        deprecated_language: deprecatedFindings,
        errors: errors.map((e) => ({
          url: e.url, category: e.category, status: e.status,
          errors: e.errors, agentName: e.agentName, responseTimeMs: e.responseTimeMs,
        })),
        warnings: warnings.slice(0, 50).map((w) => ({
          url: w.url, category: w.category, warnings: w.warnings, agentName: w.agentName,
        })),
        slow_pages: slowPages.map((s) => ({
          url: s.url, agentName: s.agentName, responseTimeMs: s.responseTimeMs,
        })),
        top_slowest: topSlowest,
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

// === GEO-aware URL checker ===
async function checkUrlWithGEO(
  url: string,
  category: string,
  rules: {
    mustContain?: string[];
    mustNotBeSPA?: boolean;
    mustHaveSchema?: boolean;
    mustBeJSON?: boolean;
    mustBeXML?: boolean;
    minLength?: number;
    checkStateHub?: boolean;
  },
  agentName?: string
): Promise<CheckResult> {
  const start = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const responseTimeMs = Date.now() - start;

    if (res.status >= 400) {
      return { url, category, status: res.status, ok: false, errors: [`HTTP ${res.status}`], warnings: [], responseTimeMs, agentName };
    }

    // Read body — stream up to maxBytes to avoid OOM on large pages
    const maxBytes = (rules.mustBeJSON) ? 65536 : 16384; // 64KB for JSON, 16KB for HTML
    let bodyText = "";
    let bodyComplete = true;
    try {
      const reader = res.body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        while (totalBytes < maxBytes) {
          const { value, done } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          totalBytes += value.length;
        }
        bodyComplete = totalBytes < maxBytes;
        await reader.cancel();
        bodyText = new TextDecoder().decode(
          chunks.reduce((acc, chunk) => {
            const merged = new Uint8Array(acc.length + chunk.length);
            merged.set(acc);
            merged.set(chunk, acc.length);
            return merged;
          }, new Uint8Array(0))
        );
      }
    } catch { /* body read failed */ }

    const lowerBody = bodyText.toLowerCase();

    // Check for error pages masquerading as 200
    if (lowerBody.includes("application error") || lowerBody.includes("internal server error") ||
        lowerBody.includes("503 service temporarily unavailable") || lowerBody.includes("this page could not be found")) {
      errors.push("Soft 200: page contains error content");
    }

    // Min length
    if (rules.minLength && bodyText.length < rules.minLength) {
      errors.push(`Body too small: ${bodyText.length} bytes (expected >=${rules.minLength})`);
    }

    // Must contain
    if (rules.mustContain) {
      for (const term of rules.mustContain) {
        if (!lowerBody.includes(term.toLowerCase())) {
          errors.push(`Missing required content: "${term}"`);
        }
      }
    }

    // Must not be SPA shell (clean room HTML pages should NOT have React root div)
    if (rules.mustNotBeSPA) {
      if (lowerBody.includes('id="root"') && !lowerBody.includes("<article") && !lowerBody.includes("<main")) {
        errors.push("SPA shell detected — should be clean room HTML for AI consumers");
      }
    }

    // JSON-LD schema check
    if (rules.mustHaveSchema) {
      if (!bodyText.includes("application/ld+json")) {
        warnings.push("No JSON-LD schema markup found — hurts GEO structured data");
      }
    }

    // JSON validation (only if we read the full body)
    if (rules.mustBeJSON) {
      if (!bodyComplete) {
        // Body was truncated — check it at least starts with valid JSON
        const trimmed = bodyText.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
          errors.push("Response does not look like JSON");
        }
      } else {
        try { JSON.parse(bodyText); } catch { errors.push("Invalid JSON response"); }
      }
    }

    // XML validation
    if (rules.mustBeXML) {
      if (!bodyText.includes("<?xml") && !bodyText.includes("<urlset") && !bodyText.includes("<sitemapindex")) {
        errors.push("Not valid XML — missing XML declaration or urlset");
      }
    }

    // Deprecated language scan
    for (const dep of DEPRECATED_LANGUAGE) {
      if (dep.pattern.test(bodyText)) {
        errors.push(`DEPRECATED: "${bodyText.match(dep.pattern)?.[0]}" found — ${dep.fix}`);
      }
    }

    // Slow page warning
    if (responseTimeMs >= 1500) {
      warnings.push(`Slow load: ${responseTimeMs}ms`);
    }

    return {
      url, category, status: res.status,
      ok: errors.length === 0,
      errors, warnings, responseTimeMs, agentName,
    };
  } catch (err: any) {
    return { url, category, status: 0, ok: false, errors: [`Fetch failed: ${err.message}`], warnings: [], responseTimeMs: Date.now() - start, agentName };
  }
}

// === Agent profile GEO checker ===
async function checkAgentProfileGEO(
  url: string,
  agentName: string,
  rating: number | null
): Promise<CheckResult> {
  const start = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const responseTimeMs = Date.now() - start;

    if (res.status >= 400) {
      return { url, category: "agent_profile", status: res.status, ok: false, errors: [`HTTP ${res.status}`], warnings: [], responseTimeMs, agentName };
    }

    let bodyText = "";
    try {
      const reader = res.body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        while (totalBytes < 8192) {
          const { value, done } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          totalBytes += value.length;
        }
        await reader.cancel();
        bodyText = new TextDecoder().decode(
          chunks.reduce((acc, chunk) => {
            const merged = new Uint8Array(acc.length + chunk.length);
            merged.set(acc);
            merged.set(chunk, acc.length);
            return merged;
          }, new Uint8Array(0))
        );
      }
    } catch { /* body read failed */ }

    const lowerBody = bodyText.toLowerCase();

    // Error page check — be specific to avoid false positives ("not found" is too broad)
    if (lowerBody.includes("application error") || lowerBody.includes("internal server error") ||
        lowerBody.includes("503 service temporarily unavailable") || lowerBody.includes("this page could not be found")) {
      errors.push("Soft 200: error content in body");
    }

    // Agent name must appear in page (proves real content, not SPA shell)
    const nameParts = agentName.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
    const nameFound = nameParts.some((part) => lowerBody.includes(part));
    if (!nameFound) {
      errors.push(`Agent name "${agentName}" not found in rendered content — SPA shell or broken render`);
    }

    // EE-A-T signals — at least 2 should be present
    const eeatCount = EEAT_SIGNALS.filter((s) => lowerBody.includes(s)).length;
    if (eeatCount < 2) {
      warnings.push(`Weak EE-A-T: only ${eeatCount}/5 signals found (review, rating, experience, license, transaction)`);
    }

    // JSON-LD schema (RealEstateAgent or Person)
    if (!bodyText.includes("application/ld+json")) {
      warnings.push("No JSON-LD schema — AI systems can't extract structured agent data");
    } else {
      const hasAgentSchema = EXPECTED_SCHEMA_TYPES.agent_profile.some((t) => bodyText.includes(t));
      if (!hasAgentSchema) {
        warnings.push("JSON-LD exists but missing RealEstateAgent/Person/LocalBusiness type");
      }
    }

    // Merit gate language check
    const hasMeritSignal = MERIT_GATE_SIGNALS.some((s) => lowerBody.includes(s.toLowerCase()));
    if (!hasMeritSignal) {
      warnings.push("No merit gate signals (4.5, 10+, verified review, 5+) — weakens GEO credibility");
    }

    // Deprecated language
    for (const dep of DEPRECATED_LANGUAGE) {
      if (dep.pattern.test(bodyText)) {
        errors.push(`DEPRECATED: "${bodyText.match(dep.pattern)?.[0]}" — ${dep.fix}`);
      }
    }

    // Body too small
    if (bodyText.length < 500) {
      errors.push(`Profile too thin: ${bodyText.length} bytes — not enough content for GEO`);
    }

    if (responseTimeMs >= 1500) {
      warnings.push(`Slow: ${responseTimeMs}ms`);
    }

    return {
      url, category: "agent_profile", status: res.status,
      ok: errors.length === 0,
      errors, warnings, responseTimeMs, agentName,
    };
  } catch (err: any) {
    return { url, category: "agent_profile", status: 0, ok: false, errors: [`Fetch failed: ${err.message}`], warnings: [], responseTimeMs: Date.now() - start, agentName };
  }
}
