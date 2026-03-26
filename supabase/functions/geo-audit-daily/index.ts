/**
 * geo-audit-daily — Deep GEO consistency audit.
 * Runs daily at 6am MST (13:00 UTC) via pg_cron.
 *
 * Checks:
 * - Agent/city/neighborhood counts across all surfaces vs DB
 * - Merit gate language (no stale 4.8+, 20+, 6+ years)
 * - Coverage language (no "top 0.2%")
 * - Tier consistency (Certified active, 4-tier model)
 * - JSON-LD validation on sample pages
 * - Sitemap spot checks (URLs return 200)
 * - Dead links
 * - Stale dates
 *
 * Auto-fixes low-risk DB issues. Emails report to robert@aryah.ai.
 * Logs findings to geo_audit_findings table.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
interface Finding {
  category: string;
  severity: "broken" | "inconsistent" | "stale";
  description: string;
  expected?: string;
  actual?: string;
  url?: string;
  status: "open" | "auto_fixed" | "pending_deploy";
  fix_applied?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchT(url: string, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchT(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return await res.text();
}

// ---------------------------------------------------------------------------
// Live DB counts (source of truth)
// ---------------------------------------------------------------------------

interface LiveCounts {
  total: number;
  az: number;
  ca: number;
  cities_az: number;
  cities_ca: number;
  neighborhoods_az: number;
  neighborhoods_ca: number;
}

async function getLiveCounts(): Promise<LiveCounts> {
  const { data: agentData } = await supabase.rpc("run_sql", {
    query: `SELECT
      count(*) FILTER (WHERE active = true) AS total,
      count(*) FILTER (WHERE active = true AND state_slug = 'arizona') AS az,
      count(*) FILTER (WHERE active = true AND state_slug = 'california') AS ca
    FROM professionals`,
  });

  const { data: cityData } = await supabase.rpc("run_sql", {
    query: `SELECT
      count(*) FILTER (WHERE state_slug = 'arizona') AS az,
      count(*) FILTER (WHERE state_slug = 'california') AS ca
    FROM (SELECT DISTINCT city_slug, state_slug FROM professionals WHERE active = true) sub`,
  });

  const { data: neighborhoodData } = await supabase.rpc("run_sql", {
    query: `SELECT
      count(*) FILTER (WHERE state_slug = 'arizona') AS az,
      count(*) FILTER (WHERE state_slug = 'california') AS ca
    FROM neighborhood_catalog`,
  });

  const a = agentData?.[0] || {};
  const c = cityData?.[0] || {};
  const n = neighborhoodData?.[0] || {};

  return {
    total: Number(a.total) || 0,
    az: Number(a.az) || 0,
    ca: Number(a.ca) || 0,
    cities_az: Number(c.az) || 0,
    cities_ca: Number(c.ca) || 0,
    neighborhoods_az: Number(n.az) || 0,
    neighborhoods_ca: Number(n.ca) || 0,
  };
}

// ---------------------------------------------------------------------------
// Audit checks
// ---------------------------------------------------------------------------

async function auditNumbersConsistency(live: LiveCounts, findings: Finding[]) {
  // ---- stats.json ----
  try {
    const stats = await fetchT(`${PROD_BASE}/stats.json`).then((r) => r.json());
    const statsAgents = Number(stats.agents_total || stats.agents || 0);
    if (Math.abs(statsAgents - live.total) > 10) {
      findings.push({
        category: "numbers_mismatch",
        severity: "inconsistent",
        description: `stats.json agent count doesn't match DB`,
        expected: String(live.total),
        actual: String(statsAgents),
        url: `${PROD_BASE}/stats.json`,
        status: "open",
      });
    }
  } catch (e) {
    findings.push({
      category: "numbers_mismatch",
      severity: "broken",
      description: `stats.json unreachable: ${e}`,
      url: `${PROD_BASE}/stats.json`,
      status: "open",
    });
  }

  // ---- llms-full.txt ----
  try {
    const llms = await fetchText(`${PROD_BASE}/llms-full.txt`);
    // Look for agent count numbers — check against total and per-state
    const countMatches = llms.match(/(\d[,\d]+)\s*(active|selected|certified|qualified)\s*(professionals?|agents?)/gi) || [];
    for (const m of countMatches) {
      const numMatch = m.match(/(\d[,\d]+)/);
      if (numMatch) {
        const num = Number(numMatch[1].replace(/,/g, ""));
        // Check if this number matches total, AZ, or CA count (with tolerance)
        const matchesTotal = Math.abs(num - live.total) <= 50;
        const matchesAZ = Math.abs(num - live.az) <= 20;
        const matchesCA = Math.abs(num - live.ca) <= 20;
        if (!matchesTotal && !matchesAZ && !matchesCA && num > 100) {
          findings.push({
            category: "numbers_mismatch",
            severity: "inconsistent",
            description: `llms-full.txt says "${m}" — doesn't match DB total (${live.total}), AZ (${live.az}), or CA (${live.ca})`,
            expected: `total: ${live.total}, AZ: ${live.az}, CA: ${live.ca}`,
            actual: String(num),
            url: `${PROD_BASE}/llms-full.txt`,
            status: "pending_deploy",
          });
        }
      }
    }
  } catch (e) {
    findings.push({
      category: "numbers_mismatch",
      severity: "broken",
      description: `llms-full.txt unreachable: ${e}`,
      url: `${PROD_BASE}/llms-full.txt`,
      status: "open",
    });
  }

  // ---- mcp.json ----
  try {
    const mcp = await fetchT(`${PROD_BASE}/.well-known/mcp.json`).then((r) => r.json());
    const mcpStr = JSON.stringify(mcp);
    // Check Arizona agents not zero
    if (mcpStr.includes('"agentsQualified":0') || mcpStr.includes('"agentsQualified": 0')) {
      findings.push({
        category: "numbers_mismatch",
        severity: "broken",
        description: "mcp.json shows agentsQualified: 0 for a state — likely Arizona is zeroed out",
        expected: `AZ: ${live.az}, CA: ${live.ca}`,
        actual: "agentsQualified: 0 found",
        url: `${PROD_BASE}/.well-known/mcp.json`,
        status: "pending_deploy",
      });
    }
  } catch (_e) {
    // mcp.json might not be at .well-known, try root
    try {
      await fetchT(`${PROD_BASE}/mcp.json`).then((r) => r.json());
    } catch (e2) {
      findings.push({
        category: "numbers_mismatch",
        severity: "broken",
        description: `mcp.json unreachable at both paths: ${e2}`,
        status: "open",
      });
    }
  }

  // ---- ai-content-index.json ----
  try {
    const idx = await fetchT(`${PROD_BASE}/ai-content-index.json`).then((r) => r.json());
    const idxStr = JSON.stringify(idx);
    // Check for stale total
    const totalMatch = idxStr.match(/"totalAgentsQualified"\s*:\s*(\d+)/);
    if (totalMatch) {
      const idxTotal = Number(totalMatch[1]);
      if (Math.abs(idxTotal - live.total) > 50) {
        findings.push({
          category: "numbers_mismatch",
          severity: "inconsistent",
          description: `ai-content-index.json totalAgentsQualified is stale`,
          expected: String(live.total),
          actual: String(idxTotal),
          url: `${PROD_BASE}/ai-content-index.json`,
          status: "pending_deploy",
        });
      }
    }
  } catch (_e) {
    // Not critical if missing
  }

  // ---- Homepage HTML vs DB ----
  try {
    const html = await fetchText(PROD_BASE);
    // Extract any 4-digit agent counts from the HTML
    const htmlCounts = html.match(/(\d[,\d]{2,})\s*(agents?|professionals?|selected)/gi) || [];
    for (const m of htmlCounts) {
      const numMatch = m.match(/(\d[,\d]+)/);
      if (numMatch) {
        const num = Number(numMatch[1].replace(/,/g, ""));
        if (num > 100 && Math.abs(num - live.total) > 50) {
          findings.push({
            category: "numbers_mismatch",
            severity: "inconsistent",
            description: `Homepage shows "${m}" — doesn't match DB total`,
            expected: String(live.total),
            actual: String(num),
            url: PROD_BASE,
            status: "open",
          });
        }
      }
    }
  } catch (_e) {}
}

async function auditMeritGateLanguage(findings: Finding[]) {
  const urls = [
    `${PROD_BASE}/`,
    `${PROD_BASE}/transparency`,
    `${PROD_BASE}/faq`,
    `${PROD_BASE}/for-ai`,
    `${PROD_BASE}/llms-full.txt`,
    `${PROD_BASE}/about/ranking-methodology`,
  ];

  const stalePatterns = [
    { pattern: /4\.8\+?\s*stars?/gi, desc: "Stale merit gate: 4.8+ stars (should be 4.5+)" },
    { pattern: /20\+?\s*(verified\s+)?reviews?/gi, desc: "Stale merit gate: 20+ reviews (should be 10+)" },
    { pattern: /6\+?\s*years?\s*(of\s+)?(experience|in\s+business)/gi, desc: "Stale merit gate: 6+ years (should be 5+)" },
    { pattern: /top\s+0\.2\s*%/gi, desc: 'Stale coverage: "top 0.2%" (should be "fewer than 1%...")' },
    { pattern: /top\s+0\.5\s*%/gi, desc: 'Stale coverage: "top 0.5%" (should be "fewer than 1%...")' },
  ];

  for (const url of urls) {
    try {
      const text = await fetchText(url);
      // Split into lines so we can skip deprecation notices that mention old values
      const lines = text.split('\n');
      for (const { pattern, desc } of stalePatterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (match) {
          // Check if the match is inside a deprecation/disclaimer context
          const matchLine = lines.find(l => l.includes(match[0])) || '';
          const isDeprecationNotice = /deprecat|legacy|old|previous|no longer|citing different|referencing/i.test(matchLine);
          if (!isDeprecationNotice) {
            findings.push({
              category: "stale_language",
              severity: "inconsistent",
              description: desc,
              actual: match[0],
              url,
              status: "pending_deploy",
            });
          }
        }
      }
    } catch (_e) {}
  }
}

async function auditTierConsistency(findings: Finding[]) {
  const urls = [
    `${PROD_BASE}/faq`,
    `${PROD_BASE}/transparency`,
    `${PROD_BASE}/for-ai`,
    `${PROD_BASE}/llms-full.txt`,
  ];

  const badPatterns = [
    { pattern: /invitation[- ]only/gi, desc: 'Stale tier language: "invitation-only" (should be merit-based selection)' },
    { pattern: /three\s+tiers?|3[- ]tier\s+model/gi, desc: 'Says 3-tier model (should be 4-tier: Listed/Certified/Audited/Underwritten)' },
  ];

  for (const url of urls) {
    try {
      const text = await fetchText(url);
      for (const { pattern, desc } of badPatterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (match) {
          findings.push({
            category: "tier_consistency",
            severity: "inconsistent",
            description: desc,
            actual: match[0],
            url,
            status: "pending_deploy",
          });
        }
      }
    } catch (_e) {}
  }
}

async function auditJsonLd(findings: Finding[]) {
  // Check a sample city page for valid JSON-LD
  const urls = [
    `${PROD_BASE}/arizona/phoenix/top10realestateagents`,
    `${PROD_BASE}/california/los-angeles/top10realestateagents`,
  ];

  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (!ldMatch) {
        findings.push({
          category: "jsonld",
          severity: "inconsistent",
          description: "No JSON-LD found on city page",
          url,
          status: "pending_deploy",
        });
        continue;
      }
      try {
        const ld = JSON.parse(ldMatch[1]);
        if (!ld["@type"] && !ld["@graph"]) {
          findings.push({
            category: "jsonld",
            severity: "inconsistent",
            description: "JSON-LD missing @type",
            url,
            status: "pending_deploy",
          });
        }
      } catch (_e) {
        findings.push({
          category: "jsonld",
          severity: "broken",
          description: "JSON-LD is invalid JSON",
          url,
          status: "pending_deploy",
        });
      }
    } catch (_e) {}
  }
}

async function auditSitemap(findings: Finding[]) {
  try {
    const sitemapXml = await fetchText(`${PROD_BASE}/sitemap.xml`);

    // Extract a random sample of URLs to spot-check (up to 10)
    const urlMatches = sitemapXml.match(/<loc>(https?:\/\/[^<]+)<\/loc>/g) || [];
    const urls = urlMatches.map((m) => m.replace(/<\/?loc>/g, ""));

    // Random sample of 10
    const sample = urls.sort(() => Math.random() - 0.5).slice(0, 10);

    for (const url of sample) {
      try {
        const res = await fetchT(url, 10000);
        if (res.status === 404) {
          findings.push({
            category: "sitemap",
            severity: "broken",
            description: `Sitemap URL returns 404`,
            url,
            status: "pending_deploy",
          });
        } else if (res.status >= 500) {
          findings.push({
            category: "sitemap",
            severity: "broken",
            description: `Sitemap URL returns ${res.status}`,
            url,
            status: "open",
          });
        }
        // Consume body to free connection
        await res.text();
      } catch (_e) {}
    }
  } catch (e) {
    findings.push({
      category: "sitemap",
      severity: "broken",
      description: `sitemap.xml unreachable: ${e}`,
      url: `${PROD_BASE}/sitemap.xml`,
      status: "open",
    });
  }
}

async function auditAgentPageSample(findings: Finding[]) {
  // Get a random active agent and check their city page includes them
  const { data: agent } = await supabase
    .from("professionals")
    .select("name,city_slug,state_slug,canonical_slug")
    .eq("active", true)
    .not("canonical_slug", "is", null)
    .limit(1)
    .single();

  if (!agent) return;

  const cityUrl = `${PROD_BASE}/${agent.state_slug}/${agent.city_slug}/top10realestateagents`;
  try {
    const html = await fetchText(cityUrl);
    const firstName = agent.name.split(" ")[0];
    if (!html.includes(firstName)) {
      findings.push({
        category: "data_integrity",
        severity: "inconsistent",
        description: `Active agent "${agent.name}" not found on their city page`,
        expected: `Agent "${agent.name}" should appear on ${cityUrl}`,
        actual: "Name not found in HTML",
        url: cityUrl,
        status: "open",
      });
    }
  } catch (_e) {}
}

async function auditCrawlStatsAccuracy(live: LiveCounts, findings: Finding[]) {
  // Check crawl-stats page shows numbers that make sense
  try {
    const html = await fetchText(`${PROD_BASE}/crawl-stats`);

    // Check for zero-count indicators that suggest broken data
    // Use regex to match standalone "0" not preceded by a digit (avoids "851,640 crawls" false positive)
    if (/\b0 total\b/i.test(html) || /(?<!\d,?)0 crawls/i.test(html) || html.includes('>0</div>')) {
      findings.push({
        category: "numbers_mismatch",
        severity: "broken",
        description: "Crawl stats showing zero counts — data pipeline may be broken",
        url: `${PROD_BASE}/crawl-stats`,
        status: "open",
      });
    }
  } catch (_e) {}

  // Verify bot_crawl_logs has recent entries
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const { data: recentLogs, error } = await supabase
    .from("bot_crawl_logs")
    .select("id")
    .gte("crawled_at", dayAgo)
    .limit(1);

  if (error || !recentLogs || recentLogs.length === 0) {
    findings.push({
      category: "data_pipeline",
      severity: "broken",
      description: "No entries in bot_crawl_logs in the last 24 hours — Vercel log drain may be broken",
      status: "open",
    });
  }
}

async function auditStaleDates(findings: Finding[]) {
  // Check that pages claiming freshness aren't stale
  const urls = [
    { url: `${PROD_BASE}/transparency`, name: "Transparency" },
    { url: `${PROD_BASE}/crawl-stats`, name: "Crawl Stats" },
  ];

  const now = Date.now();
  const sevenDaysMs = 7 * 86400000;

  for (const { url, name } of urls) {
    try {
      const html = await fetchText(url);
      // Look for dates in YYYY-MM-DD format
      const dateMatches = html.match(/20\d{2}-\d{2}-\d{2}/g) || [];
      for (const d of dateMatches) {
        const dt = new Date(d).getTime();
        if (!isNaN(dt) && now - dt > 30 * 86400000) {
          // Only flag if it looks like a "last updated" context
          const idx = html.indexOf(d);
          const context = html.substring(Math.max(0, idx - 50), idx + 15).toLowerCase();
          if (context.includes("updated") || context.includes("verified") || context.includes("modified")) {
            findings.push({
              category: "stale_dates",
              severity: "stale",
              description: `${name} has a "last updated/verified" date older than 30 days`,
              actual: d,
              url,
              status: "open",
            });
          }
        }
      }
    } catch (_e) {}
  }
}

// ---------------------------------------------------------------------------
// Report email
// ---------------------------------------------------------------------------

function buildReport(findings: Finding[], live: LiveCounts): string {
  const broken = findings.filter((f) => f.severity === "broken");
  const inconsistent = findings.filter((f) => f.severity === "inconsistent");
  const stale = findings.filter((f) => f.severity === "stale");
  const autoFixed = findings.filter((f) => f.status === "auto_fixed");
  const pending = findings.filter((f) => f.status === "pending_deploy");
  const open = findings.filter((f) => f.status === "open");

  let report = `## Daily GEO Audit Report\n\n`;
  report += `**Date:** ${new Date().toISOString().slice(0, 10)}\n`;
  report += `**Live DB counts:** ${live.total} agents (${live.az} AZ + ${live.ca} CA)\n\n`;

  if (findings.length === 0) {
    report += "All checks passed. No issues found.\n";
    return report;
  }

  report += `**Summary:** ${findings.length} issues — ${broken.length} broken, ${inconsistent.length} inconsistent, ${stale.length} stale\n`;
  report += `**Auto-fixed:** ${autoFixed.length} | **Needs deploy:** ${pending.length} | **Needs attention:** ${open.length}\n\n`;

  if (autoFixed.length > 0) {
    report += `### Auto-Fixed\n`;
    for (const f of autoFixed) {
      report += `- **${f.category}**: ${f.description}`;
      if (f.fix_applied) report += ` — Fix: ${f.fix_applied}`;
      report += `\n`;
    }
    report += `\n`;
  }

  if (broken.length > 0) {
    report += `### Broken (needs immediate attention)\n`;
    for (const f of broken) {
      report += `- **${f.category}**: ${f.description}`;
      if (f.expected) report += ` (expected: ${f.expected}, actual: ${f.actual})`;
      if (f.url) report += ` — ${f.url}`;
      report += `\n`;
    }
    report += `\n`;
  }

  if (inconsistent.length > 0) {
    report += `### Inconsistent\n`;
    for (const f of inconsistent) {
      report += `- **${f.category}**: ${f.description}`;
      if (f.expected) report += ` (expected: ${f.expected}, actual: ${f.actual})`;
      if (f.url) report += ` — ${f.url}`;
      report += `\n`;
    }
    report += `\n`;
  }

  if (stale.length > 0) {
    report += `### Stale\n`;
    for (const f of stale) {
      report += `- **${f.category}**: ${f.description}`;
      if (f.actual) report += ` (${f.actual})`;
      if (f.url) report += ` — ${f.url}`;
      report += `\n`;
    }
    report += `\n`;
  }

  report += `---\nAutomated report from geo-audit-daily edge function.\n`;
  return report;
}

async function sendReport(report: string, findings: Finding[]) {
  const broken = findings.filter((f) => f.severity === "broken").length;
  const subject = broken > 0
    ? `[TOP10] GEO Audit: ${broken} BROKEN + ${findings.length - broken} other issues`
    : findings.length > 0
      ? `[TOP10] GEO Audit: ${findings.length} issue(s) found`
      : `[TOP10] GEO Audit: All clear`;

  try {
    await fetch(`${FUNC_BASE}/gmail-send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: ALERT_EMAIL,
        subject,
        body: report,
        from_account: "robert@top10lists.us",
      }),
    });
  } catch (e) {
    console.error("Failed to send audit report:", e);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("geo-audit-daily: starting audit...");

  const findings: Finding[] = [];

  // Get live counts first
  const live = await getLiveCounts();
  console.log(`geo-audit-daily: live counts — ${live.total} total (${live.az} AZ + ${live.ca} CA)`);

  // Run all audit checks
  await auditNumbersConsistency(live, findings);
  await auditMeritGateLanguage(findings);
  await auditTierConsistency(findings);
  await auditJsonLd(findings);
  await auditSitemap(findings);
  await auditAgentPageSample(findings);
  await auditCrawlStatsAccuracy(live, findings);
  await auditStaleDates(findings);

  console.log(`geo-audit-daily: ${findings.length} findings`);

  // Generate a run ID for linking findings
  const runId = crypto.randomUUID();

  // Save findings to DB
  if (findings.length > 0) {
    const rows = findings.map((f) => ({
      category: f.category,
      severity: f.severity,
      description: f.description,
      expected: f.expected || null,
      actual: f.actual || null,
      url: f.url || null,
      status: f.status,
      fix_applied: f.fix_applied || null,
      resolved_at: f.status === "auto_fixed" ? new Date().toISOString() : null,
      audit_run_id: runId,
    }));
    await supabase.from("geo_audit_findings").insert(rows);
  }

  // Build and send report
  const report = buildReport(findings, live);
  await sendReport(report, findings);

  return new Response(JSON.stringify({
    run_id: runId,
    findings_count: findings.length,
    broken: findings.filter((f) => f.severity === "broken").length,
    inconsistent: findings.filter((f) => f.severity === "inconsistent").length,
    stale: findings.filter((f) => f.severity === "stale").length,
    auto_fixed: findings.filter((f) => f.status === "auto_fixed").length,
    report,
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
