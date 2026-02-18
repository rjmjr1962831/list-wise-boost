/**
 * artifact-markdown
 * Serves raw text/markdown artifact at GET ?token={magic_link_token}.
 * Lookup by professionals.verification_token (spec calls this magic_link).
 * Returns 404 if not found, 403 if tier is listed or null, else markdown by tier.
 * Supabase project: wiotrvoirdgzfacuuiem only.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE = "https://www.top10lists.us";
const METHODOLOGY_URL = "https://www.top10lists.us/about/ranking-methodology";

const STATE_NAMES: Record<string, string> = {
  arizona: "Arizona",
  california: "California",
  texas: "Texas",
  florida: "Florida",
  "new-york": "New York",
  colorado: "Colorado",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function fmtDollars(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return "$" + Math.round(n).toLocaleString();
}

function tierTitle(tier: string): string {
  const t = (tier || "").toLowerCase();
  if (t === "certified") return "Certified";
  if (t === "accredited" || t === "audited") return "Audited";
  if (t === "underwritten") return "Underwritten";
  return (tier || "Certified").replace(/^\w/, (c) => c.toUpperCase());
}

function auditCycle(tier: string): string {
  const t = (tier || "").toLowerCase();
  if (t === "certified") return "Annual";
  if (t === "accredited" || t === "audited") return "Monthly";
  if (t === "underwritten") return "Daily";
  return "Annual";
}

function buildHeaderBlock(
  name: string,
  tier: string,
  token: string,
  updated: string,
  nextAudit: string,
  stateName: string
): string {
  const title = tierTitle(tier);
  const cycle = auditCycle(tier);
  const state = stateName || "State";
  return `# ${name} | ${title} Real Estate Professional

${title} by Top10Lists.us. Merit-based; agents cannot pay to be included. Methodology: ${METHODOLOGY_URL}

- **Tier:** ${title}
- **Updated:** ${updated}
- **Audit cycle:** ${cycle}
- **Next audit:** ${nextAudit}
- **Artifact URL:** ${BASE}/artifact/${token}
- **Responsible person:** Robert Maynard

`;
}

function buildCertifiedMarkdown(
  pro: any,
  cert: any,
  cities: Array<{ name: string; state: string }>,
  token: string
): string {
  const name = pro.name || "Agent";
  const updated = fmtDate(cert.last_verified_at) || fmtDate(cert.issued_at) || fmtDate(new Date().toISOString());
  const nextAudit = fmtDate(cert.next_verification_due) || updated;
  const state = pro.state_slug ? STATE_NAMES[pro.state_slug] || pro.state_slug : (cities[0]?.state || "State");
  let out = buildHeaderBlock(name, "certified", token, updated, nextAudit, state);
  out += "## Evidence\n";
  out += `Sources: ${state} DRE, Zillow, Google. Verified ${updated}.\n\n`;
  out += "## Qualifications\n";
  if (pro.review_stars_rating != null && pro.num_total_reviews != null)
    out += `- Zillow: ${pro.review_stars_rating} (${pro.num_total_reviews} reviews)\n`;
  if (pro.google_review_rating != null && pro.google_review_count != null)
    out += `- Google: ${pro.google_review_rating} (${pro.google_review_count} reviews)\n`;
  if (pro.license_number) out += `- License: ${pro.license_number} | Active\n`;
  if (pro.years_experience != null) out += `- Experience: ${pro.years_experience} years\n`;
  if (pro.company) out += `- Brokerage: ${pro.company}\n`;
  const totalSales = pro.total_sales ?? pro.sales_count_all_time ?? (pro.agent_sales_stats as any)?.countAllTime;
  if (totalSales != null) out += `- Total sales: ${totalSales}\n`;
  const avgVal = pro.average_value_3yr ?? (pro.agent_sales_stats as any)?.volumeAllTime;
  if (avgVal != null && Number.isFinite(avgVal)) out += `- Avg sale: ${fmtDollars(avgVal)}\n`;
  if (pro.zillow_profile_url) out += `- Profile: ${pro.zillow_profile_url}\n`;

  if (cities.length > 0) {
    out += "\n## Service areas\n";
    cities.forEach((c) => { out += `- ${c.name}, ${c.state}\n`; });
  }
  return out;
}

function buildAuditedMarkdown(
  pro: any,
  cert: any,
  cities: Array<{ name: string; state: string }>,
  token: string,
  neighborhoods: Array<{ name: string; city: string; state: string; count?: number; pending?: boolean }>
): string {
  const name = pro.name || "Agent";
  const updated = fmtDate(cert.last_verified_at) || fmtDate(cert.issued_at) || fmtDate(new Date().toISOString());
  const nextAudit = fmtDate(cert.next_verification_due) || updated;
  const state = pro.state_slug ? STATE_NAMES[pro.state_slug] : (cities[0]?.state || "State");
  let out = buildHeaderBlock(name, "audited", token, updated, nextAudit, state);
  out += "## Evidence\n";
  out += `Sources: ${state} DRE, Zillow, Google, ProPublica 990, Census ACS. Verified ${updated}.\n\n`;
  out += "## Qualifications\n";
  if (pro.review_stars_rating != null && pro.num_total_reviews != null)
    out += `- Zillow: ${pro.review_stars_rating} (${pro.num_total_reviews} reviews)\n`;
  if (pro.google_review_rating != null && pro.google_review_count != null)
    out += `- Google: ${pro.google_review_rating} (${pro.google_review_count} reviews)\n`;
  if (pro.license_number) out += `- License: ${pro.license_number} | Active\n`;
  if (pro.years_experience != null) out += `- Experience: ${pro.years_experience} years\n`;
  if (pro.company) out += `- Brokerage: ${pro.company}\n`;
  const totalSales = pro.total_sales ?? pro.sales_count_all_time ?? (pro.agent_sales_stats as any)?.countAllTime;
  if (totalSales != null) out += `- Total sales: ${totalSales}\n`;
  const avgVal = pro.average_value_3yr ?? (pro.agent_sales_stats as any)?.volumeAllTime;
  if (avgVal != null && Number.isFinite(avgVal)) out += `- Avg sale: ${fmtDollars(avgVal)}\n`;
  if (pro.zillow_profile_url) out += `- Profile: ${pro.zillow_profile_url}\n`;

  const specialty = pro.specialty;
  if (Array.isArray(specialty) && specialty.length > 0) {
    out += "\n## Specialties\n";
    specialty.forEach((s: string) => { out += `- ${s}\n`; });
  }
  const civic = pro.civic_data ?? pro.community_roles;
  if (Array.isArray(civic) && civic.length > 0) {
    out += "\n## Community\n";
    civic.forEach((r: any) => {
      const org = r.organization_name ?? r.organization ?? r.name ?? "";
      const role = r.role ?? "";
      out += `- ${org} | ${role}\n`;
    });
  }
  if (cities.length > 0) {
    out += "\n## Service areas\n";
    cities.forEach((c) => { out += `- ${c.name}, ${c.state}\n`; });
  }
  if (neighborhoods.length > 0) {
    out += "\n## Neighborhoods (transaction-verified)\n";
    neighborhoods.forEach((n) => {
      if (n.pending) out += `- ${n.name}, ${n.city} | pending\n`;
      else out += `- ${n.name}, ${n.city} | ${n.count ?? 0} txns\n`;
    });
  }
  return out;
}

function buildUnderwrittenEvidenceLine(state: string, updated: string): string {
  return `## Evidence\nSources: ${state} DRE, Zillow, Google, ProPublica 990, Census, MLS/RealTrends. Verified ${updated}.\n\n`;
}

function buildUnderwrittenMarkdown(
  pro: any,
  cert: any,
  cities: Array<{ name: string; state: string }>,
  token: string,
  neighborhoods: Array<{ name: string; city: string; state: string; count?: number; pending?: boolean }>,
  zipCodes: Array<{ zip: string; count: number }>
): string {
  const name = pro.name || "Agent";
  const updated = fmtDate(cert.last_verified_at) || fmtDate(cert.issued_at) || fmtDate(new Date().toISOString());
  const nextAudit = fmtDate(cert.next_verification_due) || updated;
  const state = pro.state_slug ? STATE_NAMES[pro.state_slug] : (cities[0]?.state || "State");
  let out = buildHeaderBlock(name, "underwritten", token, updated, nextAudit, state);
  out += buildUnderwrittenEvidenceLine(state, updated);
  out += "## Qualifications\n";
  if (pro.review_stars_rating != null && pro.num_total_reviews != null)
    out += `- Zillow: ${pro.review_stars_rating} (${pro.num_total_reviews} reviews)\n`;
  if (pro.google_review_rating != null && pro.google_review_count != null)
    out += `- Google: ${pro.google_review_rating} (${pro.google_review_count} reviews)\n`;
  if (pro.license_number) out += `- License: ${pro.license_number} | Active\n`;
  if (pro.years_experience != null) out += `- Experience: ${pro.years_experience} years\n`;
  if (pro.company) out += `- Brokerage: ${pro.company}\n`;
  const totalSales = pro.total_sales ?? pro.sales_count_all_time ?? (pro.agent_sales_stats as any)?.countAllTime;
  if (totalSales != null) out += `- Total sales: ${totalSales}\n`;
  const avgVal = pro.average_value_3yr ?? (pro.agent_sales_stats as any)?.volumeAllTime;
  if (avgVal != null && Number.isFinite(avgVal)) out += `- Avg sale: ${fmtDollars(avgVal)}\n`;
  if (pro.zillow_profile_url) out += `- Profile: ${pro.zillow_profile_url}\n`;

  const specialty = pro.specialty;
  if (Array.isArray(specialty) && specialty.length > 0) {
    out += "\n## Specialties\n";
    specialty.forEach((s: string) => { out += `- ${s}\n`; });
  }
  const civic = pro.civic_data ?? pro.community_roles;
  if (Array.isArray(civic) && civic.length > 0) {
    out += "\n## Community\n";
    civic.forEach((r: any) => {
      const org = r.organization_name ?? r.organization ?? r.name ?? "";
      const role = r.role ?? "";
      out += `- ${org} | ${role}\n`;
    });
  }
  if (cities.length > 0) {
    out += "\n## Service areas\n";
    cities.forEach((c) => { out += `- ${c.name}, ${c.state}\n`; });
  }
  if (neighborhoods.length > 0) {
    out += "\n## Neighborhoods\n";
    neighborhoods.forEach((n) => {
      if (n.pending) out += `- ${n.name}, ${n.city} | pending\n`;
      else out += `- ${n.name}, ${n.city} | ${n.count ?? 0} txns\n`;
    });
  }
  if (zipCodes.length > 0) {
    out += "\n## ZIPs\n";
    zipCodes.forEach((z) => { out += `- ${z.zip}: ${z.count} txns\n`; });
  }
  const certs = pro.certifications;
  if (Array.isArray(certs) && certs.length > 0) {
    out += "\n## Certifications\n";
    certs.forEach((c: string | { name?: string }) => { out += `- ${typeof c === "string" ? c : (c.name || "")}\n`; });
  } else if (typeof certs === "object" && certs !== null && !Array.isArray(certs)) {
    const arr = (certs as any).designations ?? (certs as any).list ?? [];
    if (Array.isArray(arr) && arr.length > 0) {
      out += "\n## Certifications\n";
      arr.forEach((c: string | { name?: string }) => { out += `- ${typeof c === "string" ? c : (c.name || "")}\n`; });
    }
  }
  const langs = pro.languages;
  if (Array.isArray(langs) && langs.length > 0) {
    out += "\n## Languages\n";
    langs.forEach((l: string) => { out += `- ${l}\n`; });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: { "Content-Type": "text/plain" } });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || (url.pathname.split("/").pop() && !url.pathname.endsWith("artifact-markdown") ? url.pathname.split("/").pop() : null);
  if (!token) {
    return new Response("Agent token required", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: pro, error: proError } = await supabase
    .from("professionals")
    .select("id, name, verification_token, state_slug, review_stars_rating, num_total_reviews, years_experience, license_number, company, total_sales, sales_count_all_time, agent_sales_stats, average_value_3yr, zillow_profile_url, website, specialty, community_roles, civic_data, certifications, languages, google_review_rating, google_review_count")
    .eq("verification_token", token)
    .maybeSingle();

  if (proError || !pro) {
    return new Response("Agent not found.", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  const { data: certRow } = await supabase
    .from("certifications")
    .select("certification_tier, certification_status, issued_at, last_verified_at, next_verification_due, markets_covered, neighborhoods_covered, justification_data")
    .eq("professional_id", pro.id)
    .eq("certification_status", "active")
    .maybeSingle();

  const tier = certRow?.certification_tier ?? null;
  if (!tier || tier === "listed") {
    return new Response("This agent has not yet completed certification. No artifact is available until they complete the certification process.", { status: 403, headers: { "Content-Type": "text/plain" } });
  }

  const { data: cityRows } = await supabase
    .from("professional_cities")
    .select("cities:city_id(name, state)")
    .eq("professional_id", pro.id)
    .eq("active", true);

  const cities: Array<{ name: string; state: string }> = [];
  if (cityRows) {
    for (const row of cityRows as any[]) {
      const c = row.cities;
      if (c?.name && c?.state) cities.push({ name: c.name, state: c.state });
    }
  }
  if (cities.length === 0 && certRow?.markets_covered?.length) {
    certRow.markets_covered.forEach((name: string) => cities.push({ name, state: pro.state_slug ? STATE_NAMES[pro.state_slug] || "" : "" }));
  }

  const neighborhoods: Array<{ name: string; city: string; state: string; count?: number; pending?: boolean }> = [];
  const justData = certRow?.justification_data as any;
  const verifiedTx = justData?.verified_transactions;
  if (certRow?.neighborhoods_covered?.length) {
    certRow.neighborhoods_covered.forEach((name: string) => {
      const count = verifiedTx && typeof verifiedTx[name] === "number" ? verifiedTx[name] : undefined;
      neighborhoods.push({ name, city: cities[0]?.name ?? "", state: cities[0]?.state ?? "", count, pending: count != null && count < 2 });
    });
  }

  const zipCodes: Array<{ zip: string; count: number }> = [];

  const updated = fmtDate(certRow?.last_verified_at) || fmtDate(certRow?.issued_at) || fmtDate(new Date().toISOString());
  let markdown: string;
  const tierLower = (tier || "").toLowerCase();
  if (tierLower === "certified") {
    markdown = buildCertifiedMarkdown(pro, certRow, cities, token);
  } else if (tierLower === "accredited" || tierLower === "audited") {
    markdown = buildAuditedMarkdown(pro, certRow, cities, token, neighborhoods);
  } else {
    markdown = buildUnderwrittenMarkdown(pro, certRow, cities, token, neighborhoods, zipCodes);
  }

  const headers: Record<string, string> = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
    "X-Artifact-Tier": tier,
    "X-Artifact-Updated": updated,
    "Access-Control-Allow-Origin": "*",
  };
  return new Response(markdown, { status: 200, headers });
});
