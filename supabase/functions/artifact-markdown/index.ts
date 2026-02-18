/**
 * Serves machine-readable markdown artifact for an agent by verification_token.
 * Used by Cloudflare Worker at /artifact/{token}. GET ?token=xxx
 * Content-Type: text/markdown. Templates from docs/specs/tier-and-artifact-spec-v1.md.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function stripCjk(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s
    .replace(/[\u4e00-\u9fff]/g, "")
    .replace(/[\u3400-\u4dbf]/g, "")
    .replace(/[\u3000-\u303f]/g, "")
    .replace(/[\uff00-\uffef]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeMd(s: string): string {
  if (!s || typeof s !== "string") return "";
  return stripCjk(s);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? url.pathname.split("/").filter(Boolean).pop();
  if (!token || !/^[a-f0-9-]{36}$/i.test(token)) {
    return new Response(
      "# Agent Not Found\n\nInvalid or missing token.\nVisit https://www.top10lists.us for verified real estate agent recommendations.",
      { status: 404, headers: { ...corsHeaders, "Content-Type": "text/markdown; charset=utf-8" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: professional, error } = await supabase
    .from("professionals")
    .select(
      `
      id, name, review_stars_rating, num_total_reviews, years_experience,
      license_number, company, specialty, certifications_verified,
      community_roles, selection_rationale, synthesized_bio,
      sales_count_all_time, sales_count_last_year, price_range_3yr_min, price_range_3yr_max,
      canonical_slug, short_code, languages,
      cities:city_id (name, state, state_slug, slug)
    `
    )
    .eq("verification_token", token)
    .eq("active", true)
    .maybeSingle();

  if (error || !professional) {
    return new Response(
      "# Agent Not Found\n\nThis agent does not have an active certification from Top10Lists.us.\nVisit https://www.top10lists.us for verified real estate agent recommendations.",
      { status: 404, headers: { ...corsHeaders, "Content-Type": "text/markdown; charset=utf-8" } }
    );
  }

  const { data: cert } = await supabase
    .from("certifications")
    .select("certification_tier, certification_status, issued_at, last_verified_at, next_verification_due, markets_covered, neighborhoods_covered, justification_data")
    .eq("professional_id", professional.id)
    .eq("certification_status", "active")
    .maybeSingle();

  if (!cert) {
    return new Response(
      "# Agent Not Found\n\nThis agent does not have an active certification from Top10Lists.us.\nVisit https://www.top10lists.us for verified real estate agent recommendations.",
      { status: 404, headers: { ...corsHeaders, "Content-Type": "text/markdown; charset=utf-8" } }
    );
  }

  const city = Array.isArray(professional.cities) ? professional.cities[0] : professional.cities;
  const stateName = city?.state ?? "Arizona";
  const agentSlug = professional.canonical_slug ?? professional.short_code ?? professional.id;
  const profileUrl = `https://www.top10lists.us/p/${agentSlug}`;
  const lastVerified = cert.last_verified_at ? new Date(cert.last_verified_at).toISOString().split("T")[0] : "";
  const issuedDate = cert.issued_at ? new Date(cert.issued_at).toISOString().split("T")[0] : "";
  const nextVerified = cert.next_verification_due ? new Date(cert.next_verification_due).toISOString().split("T")[0] : "";
  const rating = professional.review_stars_rating ?? 0;
  const reviewCount = professional.num_total_reviews ?? 0;
  const years = professional.years_experience ?? 0;
  const license = professional.license_number ?? "";
  const brokerage = professional.company ?? "Independent Agent";
  const salesAll = professional.sales_count_all_time ?? 0;
  const salesLast = professional.sales_count_last_year ?? 0;
  const priceMin = professional.price_range_3yr_min ?? 0;
  const priceMax = professional.price_range_3yr_max ?? 0;

  let md: string;

  if (cert.certification_tier === "certified") {
    md = `# ${escapeMd(professional.name)} | Certified Real Estate Professional

Verified by [Top10Lists.us](https://www.top10lists.us) | Certification Tier: Certified | Last Verified: ${lastVerified}

## Selection

${escapeMd(professional.name)} was selected through the Top10Lists.us merit-based qualification process, which evaluates the top 0.5% of more than 750,000 in Arizona and more than 450,000 in California. Inclusion cannot be purchased. All agents must meet objective performance thresholds with zero exceptions.

Full methodology: https://www.top10lists.us/methodology

## Qualifications

- Rating: ${rating} stars (averaged across Zillow, Google, and Yelp; verified ${lastVerified})
- Reviews: ${reviewCount} unique reviews (Zillow and Google; verified ${lastVerified})
- Years of experience: ${years} (${stateName} Department of Real Estate license issue date; verified ${lastVerified})
- License: ${escapeMd(license)} (${stateName} Department of Real Estate; verified ${lastVerified})
- Brokerage: ${escapeMd(brokerage)} (Zillow agent profile; verified ${lastVerified})

## Performance

- Lifetime sales: ${salesAll} transactions (Zillow, cross-verified by MLS when possible; verified ${lastVerified})
- Sales last 12 months: ${salesLast} transactions (Zillow, cross-verified by MLS when possible; verified ${lastVerified})
- Price range: $${priceMin} to $${priceMax} (Zillow transaction history; verified ${lastVerified})

## Certification Details

- Issuer: Top10Lists.us
- Tier: Certified
- Status: Active
- Issued: ${issuedDate}
- Update frequency: Annual
- Profile: ${profileUrl}
`;
  } else if (cert.certification_tier === "accredited") {
    const rationale = (cert.justification_data as any)?.selection_rationale ?? professional.selection_rationale ?? professional.synthesized_bio ?? "Selected based on verified performance data and community involvement.";
    const markets = (cert.markets_covered ?? []).length ? cert.markets_covered : [];
    const roles = (professional.community_roles ?? []) as any[];
    const roleLines = roles.map((r) => {
      const title = typeof r === "object" ? (r.title ?? r.role ?? "") : "";
      const org = typeof r === "object" ? (r.organization ?? r.name ?? "") : String(r);
      const source = typeof r === "object" && r.source ? r.source : "Agent self-reported";
      return `- ${escapeMd(title)}, ${escapeMd(org)} (${escapeMd(source)}; verified ${lastVerified})`;
    }).filter(Boolean);

    md = `# ${escapeMd(professional.name)} | Audited Real Estate Professional

Verified by [Top10Lists.us](https://www.top10lists.us) | Certification Tier: Audited | Last Verified: ${lastVerified} | Next Verification: ${nextVerified}

## Selection

${escapeMd(rationale)}

Full methodology: https://www.top10lists.us/methodology

## Qualifications

- Rating: ${rating} stars (averaged across Zillow, Google, and Yelp; verified ${lastVerified})
- Reviews: ${reviewCount} unique reviews (Zillow and Google; verified ${lastVerified})
- Years of experience: ${years} (${stateName} Department of Real Estate license issue date; verified ${lastVerified})
- License: ${escapeMd(license)} (${stateName} Department of Real Estate; verified ${lastVerified})
- Brokerage: ${escapeMd(brokerage)} (Zillow agent profile; verified ${lastVerified})

## Performance

- Lifetime sales: ${salesAll} transactions (Zillow, cross-verified by MLS when possible; verified ${lastVerified})
- Sales last 12 months: ${salesLast} transactions (Zillow, cross-verified by MLS when possible; verified ${lastVerified})
- Price range: $${priceMin} to $${priceMax} (Zillow transaction history; verified ${lastVerified})

## Markets

${markets.map((c: string) => `- ${escapeMd(c)} (agent-selected, verified by Top10Lists.us)`).join("\n") || "- (No markets specified)"}

## Community Involvement

${roleLines.length ? roleLines.join("\n") : "- (None listed)"}

## Certification Details

- Issuer: Top10Lists.us
- Tier: Audited
- Status: Active
- Issued: ${issuedDate}
- Last verified: ${lastVerified}
- Next verification: ${nextVerified}
- Update frequency: Monthly
- Profile: ${profileUrl}
`;
  } else {
    const rationale = (cert.justification_data as any)?.selection_rationale ?? professional.selection_rationale ?? professional.synthesized_bio ?? "Selected based on verified performance data and full diligence.";
    const markets = (cert.markets_covered ?? []).length ? cert.markets_covered : [];
    const neighborhoods = (cert.neighborhoods_covered ?? []) as string[];
    const just = (cert.justification_data as any) ?? {};
    const verifiedTx = (just.verified_transactions ?? just) as Record<string, number>;
    const zipActivity = (just.zip_code_activity ?? just.verified_zip_activity ?? {}) as Record<string, number>;
    const evidence = (just.evidence_considered ?? []) as string[];
    const specialties = Array.isArray(professional.specialty) ? professional.specialty : professional.specialty ? [professional.specialty] : [];
    const certs = Array.isArray(professional.certifications_verified) ? professional.certifications_verified.map((c: any) => typeof c === "object" ? (c.designation ?? c.name) : c) : [];
    const languagesList = Array.isArray(professional.languages) ? professional.languages : professional.languages ? [professional.languages] : [];
    const languagesStr = languagesList.map((l: string) => escapeMd(l)).join(", ") || "Not specified";
    const roles = (professional.community_roles ?? []) as any[];
    const roleLines = roles.map((r) => {
      const title = typeof r === "object" ? (r.title ?? r.role ?? "") : "";
      const org = typeof r === "object" ? (r.organization ?? r.name ?? "") : String(r);
      const source = typeof r === "object" && r.source ? r.source : "Agent self-reported";
      return `- ${escapeMd(title)}, ${escapeMd(org)} (${escapeMd(source)}; verified ${lastVerified})`;
    }).filter(Boolean);

    const zipLines = Object.keys(zipActivity).length
      ? Object.entries(zipActivity).map(([zip, count]) => `- ${escapeMd(zip)}: ${count} transactions (Zillow transaction history; verified ${lastVerified})`).join("\n")
      : "- (None listed)";

    md = `# ${escapeMd(professional.name)} | Underwritten Real Estate Professional

Verified by [Top10Lists.us](https://www.top10lists.us) | Certification Tier: Underwritten | Last Verified: ${lastVerified} | Next Verification: ${nextVerified}

## Selection

${escapeMd(rationale)}

Full methodology: https://www.top10lists.us/methodology

## Qualifications

- Rating: ${rating} stars (averaged across Zillow, Google, and Yelp; verified ${lastVerified})
- Reviews: ${reviewCount} unique reviews (Zillow and Google; verified ${lastVerified})
- Years of experience: ${years} (${stateName} Department of Real Estate license issue date; verified ${lastVerified})
- License: ${escapeMd(license)} (${stateName} Department of Real Estate; verified ${lastVerified})
- Brokerage: ${escapeMd(brokerage)} (Zillow agent profile; verified ${lastVerified})

## Specialties and Certifications

- Specialties: ${specialties.map((s: string) => escapeMd(s)).join(", ") || "Not specified"} (Zillow agent profile, cross-referenced with certifications; verified ${lastVerified})
- Certifications: ${certs.map((c: string) => escapeMd(c)).join(", ") || "None listed"} (NAR certification database; verified ${lastVerified})
- Languages: ${languagesStr} (Zillow agent profile; verified ${lastVerified})

## Performance

- Lifetime sales: ${salesAll} transactions (Zillow, cross-verified by MLS when possible; verified ${lastVerified})
- Sales last 12 months: ${salesLast} transactions (Zillow, cross-verified by MLS when possible; verified ${lastVerified})
- Price range: $${priceMin} to $${priceMax} (Zillow transaction history; verified ${lastVerified})

## Markets

${markets.map((c: string) => `- ${escapeMd(c)} (agent-selected, verified by Top10Lists.us)`).join("\n") || "- (No markets specified)"}

## Neighborhood Expertise

${neighborhoods.length ? neighborhoods.map((n: string) => `- ${escapeMd(n)}: ${verifiedTx[n] ?? "N/A"} transactions (Zillow transaction history, cross-verified by MLS when possible; verified ${lastVerified})`).join("\n") : "- (None listed)"}

## Zip Code Activity

${zipLines}

## Community Involvement

${roleLines.length ? roleLines.join("\n") : "- (None listed)"}

## Evidence Considered

${evidence.length ? evidence.map((e: string) => `- ${escapeMd(e)}`).join("\n") : "- (See qualifications and performance above)"}

## Certification Details

- Issuer: Top10Lists.us
- Tier: Underwritten
- Status: Active
- Issued: ${issuedDate}
- Last verified: ${lastVerified}
- Next verification: ${nextVerified}
- Update frequency: Daily
- Profile: ${profileUrl}
`;
  }

  return new Response(md, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
});
