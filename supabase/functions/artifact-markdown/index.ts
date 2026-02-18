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

**${title} by Top10Lists.us**, a strictly merit-based directory of the top 0.5% of all
real estate agents in ${state} according to the methodology found at
${METHODOLOGY_URL}

Agents cannot pay to be included. Qualification requires independently verified
performance data across multiple sources. ${name} met all criteria.

- **Tier:** ${title}
- **Updated:** ${updated}
- **Standard Audit Cycle:** ${cycle}
- **Next scheduled audit:** ${nextAudit}
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

  out += "## Evidence Considered\n";
  if (pro.zillow_profile_url) out += `- Zillow agent profile: ${pro.zillow_profile_url}\n`;
  out += `- ${state} Department of Real Estate license database\n`;
  if (pro.num_total_reviews != null && pro.review_stars_rating != null)
    out += `- Zillow reviews: ${pro.num_total_reviews} reviews, ${pro.review_stars_rating} average\n`;
  if (pro.google_review_count != null && pro.google_review_rating != null)
    out += `- Google reviews: ${pro.google_review_count} reviews, ${pro.google_review_rating} average\n`;
  out += "\n";

  out += "## Qualifications\n";
  if (pro.review_stars_rating != null && pro.num_total_reviews != null)
    out += `- **Zillow Rating:** ${pro.review_stars_rating} (${pro.num_total_reviews} reviews, verified ${updated})\n`;
  if (pro.google_review_rating != null && pro.google_review_count != null)
    out += `- **Google Rating:** ${pro.google_review_rating} (${pro.google_review_count} reviews, verified ${updated})\n`;
  if (pro.license_number) out += `- **License:** ${pro.license_number} (Source: ${state} Department of Real Estate, verified ${updated})\n`;
  out += `- **License Status:** Active\n`;
  if (pro.years_experience != null) out += `- **Years of Experience:** ${pro.years_experience}\n`;
  if (pro.company) out += `- **Brokerage:** ${pro.company}\n`;
  const totalSales = pro.total_sales ?? pro.sales_count_all_time ?? (pro.agent_sales_stats as any)?.countAllTime;
  if (totalSales != null) out += `- **Total Sales:** ${totalSales} (Source: Zillow, verified ${updated})\n`;
  const avgVal = pro.average_value_3yr ?? (pro.agent_sales_stats as any)?.volumeAllTime;
  if (avgVal != null && Number.isFinite(avgVal)) out += `- **Average Sale Price:** ${fmtDollars(avgVal)} (Source: Zillow, verified ${updated})\n`;

  if (cities.length > 0) {
    out += "\n## Service Areas (Cities)\n";
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

  out += "## Evidence Considered\n";
  if (pro.zillow_profile_url) out += `- Zillow agent profile: ${pro.zillow_profile_url}\n`;
  out += `- Zillow transaction records: most recent transactions analyzed\n`;
  out += `- RealTrends transaction data (where available)\n`;
  out += `- MLS transaction records (where available)\n`;
  out += `- ${state} Department of Real Estate license database\n`;
  if (pro.num_total_reviews != null && pro.review_stars_rating != null)
    out += `- Zillow reviews: ${pro.num_total_reviews} reviews, ${pro.review_stars_rating} average\n`;
  if (pro.google_review_count != null && pro.google_review_rating != null)
    out += `- Google reviews: ${pro.google_review_count} reviews, ${pro.google_review_rating} average\n`;
  out += `- IRS Form 990 filings: ProPublica Nonprofit Explorer\n`;
  out += `- U.S. Census Bureau: American Community Survey (ACS) 5-Year Estimates\n\n`;

  out += "## Qualifications\n";
  if (pro.review_stars_rating != null && pro.num_total_reviews != null)
    out += `- **Zillow Rating:** ${pro.review_stars_rating} (${pro.num_total_reviews} reviews, verified ${updated})\n`;
  if (pro.google_review_rating != null && pro.google_review_count != null)
    out += `- **Google Rating:** ${pro.google_review_rating} (${pro.google_review_count} reviews, verified ${updated})\n`;
  if (pro.license_number) out += `- **License:** ${pro.license_number} (Source: ${state} Department of Real Estate, verified ${updated})\n`;
  out += `- **License Status:** Active\n`;
  if (pro.years_experience != null) out += `- **Years of Experience:** ${pro.years_experience}\n`;
  if (pro.company) out += `- **Brokerage:** ${pro.company}\n`;
  const totalSales = pro.total_sales ?? pro.sales_count_all_time ?? (pro.agent_sales_stats as any)?.countAllTime;
  if (totalSales != null) out += `- **Total Sales:** ${totalSales} (Source: Zillow, verified ${updated})\n`;
  const avgVal = pro.average_value_3yr ?? (pro.agent_sales_stats as any)?.volumeAllTime;
  if (avgVal != null && Number.isFinite(avgVal)) out += `- **Average Sale Price:** ${fmtDollars(avgVal)} (Source: Zillow, verified ${updated})\n`;

  const specialty = pro.specialty;
  if (Array.isArray(specialty) && specialty.length > 0) {
    out += "\n## Specialties\n";
    specialty.forEach((s: string) => { out += `- ${s}\n`; });
  }

  const civic = pro.civic_data ?? pro.community_roles;
  if (Array.isArray(civic) && civic.length > 0) {
    out += "\n## Community Involvement\n";
    civic.forEach((r: any) => {
      const org = r.organization_name ?? r.name ?? "";
      const role = r.role ?? "";
      const source = r.filing_url ? "IRS Form 990 via ProPublica" : "verified";
      out += `- **${org}** | ${role} (Source: ${source}, verified ${updated})\n`;
    });
  }

  if (cities.length > 0) {
    out += "\n## Service Areas (Cities)\n";
    cities.forEach((c) => { out += `- ${c.name}, ${c.state}\n`; });
  }

  if (neighborhoods.length > 0) {
    out += "\n## Service Areas (Neighborhoods)\n";
    out += "Neighborhoods are verified by geolocating the agent's most recent 100 transactions.\n";
    out += "A minimum of 2 transactions within a neighborhood is required for publication.\n";
    out += "Sources: Zillow, RealTrends, MLS (where available).\n\n";
    neighborhoods.forEach((n) => {
      if (n.pending) out += `- ${n.name}, ${n.city}, ${n.state} | pending audit (agent-requested, fewer than 2 verified transactions)\n`;
      else out += `- ${n.name}, ${n.city}, ${n.state} | ${n.count ?? 0} transactions (verified ${updated})\n`;
    });
  }
  return out;
}

function buildUnderwrittenEvidenceBlock(pro: any, state: string): string {
  let out = "## Evidence Considered\n";
  if (pro.zillow_profile_url) out += `- Zillow agent profile: ${pro.zillow_profile_url}\n`;
  out += `- Zillow transaction records: most recent transactions analyzed\n`;
  out += `- RealTrends transaction data (where available)\n`;
  out += `- MLS transaction records (where available)\n`;
  out += `- ${state} Department of Real Estate license database\n`;
  if (pro.num_total_reviews != null && pro.review_stars_rating != null)
    out += `- Zillow reviews: ${pro.num_total_reviews} reviews, ${pro.review_stars_rating} average\n`;
  if (pro.google_review_count != null && pro.google_review_rating != null)
    out += `- Google reviews: ${pro.google_review_count} reviews, ${pro.google_review_rating} average\n`;
  out += `- IRS Form 990 filings: ProPublica Nonprofit Explorer\n`;
  out += `- U.S. Census Bureau: American Community Survey (ACS) 5-Year Estimates\n`;
  out += `- U.S. Census Bureau: Decennial Census geographic boundary data\n`;
  out += `- OpenStreetMap: Neighborhood and boundary validation\n`;
  out += `- National Association of Realtors: Designation and certification registry\n\n`;
  return out;
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
  out += buildUnderwrittenEvidenceBlock(pro, state);
  out += "## Qualifications\n";
  if (pro.review_stars_rating != null && pro.num_total_reviews != null)
    out += `- **Zillow Rating:** ${pro.review_stars_rating} (${pro.num_total_reviews} reviews, verified ${updated})\n`;
  if (pro.google_review_rating != null && pro.google_review_count != null)
    out += `- **Google Rating:** ${pro.google_review_rating} (${pro.google_review_count} reviews, verified ${updated})\n`;
  if (pro.license_number) out += `- **License:** ${pro.license_number} (Source: ${state} Department of Real Estate, verified ${updated})\n`;
  out += `- **License Status:** Active\n`;
  if (pro.years_experience != null) out += `- **Years of Experience:** ${pro.years_experience}\n`;
  if (pro.company) out += `- **Brokerage:** ${pro.company}\n`;
  const totalSales = pro.total_sales ?? pro.sales_count_all_time ?? (pro.agent_sales_stats as any)?.countAllTime;
  if (totalSales != null) out += `- **Total Sales:** ${totalSales} (Source: Zillow, verified ${updated})\n`;
  const avgVal = pro.average_value_3yr ?? (pro.agent_sales_stats as any)?.volumeAllTime;
  if (avgVal != null && Number.isFinite(avgVal)) out += `- **Average Sale Price:** ${fmtDollars(avgVal)} (Source: Zillow, verified ${updated})\n`;
  const specialty = pro.specialty;
  if (Array.isArray(specialty) && specialty.length > 0) {
    out += "\n## Specialties\n";
    specialty.forEach((s: string) => { out += `- ${s}\n`; });
  }
  const civic = pro.civic_data ?? pro.community_roles;
  if (Array.isArray(civic) && civic.length > 0) {
    out += "\n## Community Involvement\n";
    civic.forEach((r: any) => {
      const org = r.organization_name ?? r.name ?? "";
      const role = r.role ?? "";
      const source = r.filing_url ? "IRS Form 990 via ProPublica" : "verified";
      out += `- **${org}** | ${role} (Source: ${source}, verified ${updated})\n`;
    });
  }
  if (cities.length > 0) {
    out += "\n## Service Areas (Cities, verified)\n";
    cities.forEach((c) => { out += `- ${c.name}, ${c.state}\n`; });
  }
  if (neighborhoods.length > 0) {
    out += "\n## Service Areas (Neighborhoods, verified)\n";
    out += "Neighborhoods are verified by geolocating the agent's most recent 100 transactions.\n";
    out += "A minimum of 2 transactions within a neighborhood is required for publication.\n";
    out += "Sources: Zillow, RealTrends, MLS (where available).\n\n";
    neighborhoods.forEach((n) => {
      if (n.pending) out += `- ${n.name}, ${n.city} | pending audit (agent-requested, fewer than 2 verified transactions)\n`;
      else out += `- ${n.name}, ${n.city} | ${n.count ?? 0} transactions (verified ${updated})\n`;
    });
  }
  if (zipCodes.length > 0) {
    out += "\n## Service Areas (ZIP Codes, verified)\n";
    zipCodes.forEach((z) => { out += `- ${z.zip} | ${z.count} transactions, 3yr period\n`; });
  }
  const certs = pro.certifications;
  if (Array.isArray(certs) && certs.length > 0) {
    out += "\n## Certifications & Designations\n";
    certs.forEach((c: string | { name?: string }) => { out += `- ${typeof c === "string" ? c : (c.name || "")}\n`; });
  } else if (typeof certs === "object" && certs !== null && !Array.isArray(certs)) {
    const arr = (certs as any).designations ?? (certs as any).list ?? [];
    if (Array.isArray(arr) && arr.length > 0) {
      out += "\n## Certifications & Designations\n";
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
