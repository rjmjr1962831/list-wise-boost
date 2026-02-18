/**
 * Badge generator: fires when an agent completes the funnel at Certified or above,
 * or after Stripe checkout for Audited/Underwritten. Upserts certification and
 * updates professionals; returns artifact, badge, and certificate URLs.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://www.top10lists.us";

interface CertificationRequest {
  professional_id?: string;
  agent_id?: string; // legacy
  tier: "certified" | "accredited" | "underwritten" | "audited";
  markets_covered: string[];
  neighborhoods_covered?: string[];
  trigger?: "funnel_completion" | "stripe_webhook" | "manual";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: CertificationRequest = await req.json();
    const professionalId = body.professional_id ?? body.agent_id;
    const tierInput = body.tier;
    const markets = body.markets_covered ?? [];
    const neighborhoods = body.neighborhoods_covered ?? [];
    // Normalize: API/frontend may send "audited"; DB uses "accredited"
    const tierForDb: "certified" | "accredited" | "underwritten" =
      tierInput === "audited" ? "accredited" : tierInput;

    if (!professionalId) {
      return new Response(JSON.stringify({ error: "professional_id or agent_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectCols = `
      id, name, email, phone, company, website,
      review_stars_rating, num_total_reviews, years_experience,
      license_number, specialty, certifications_verified,
      community_roles, notable_achievements, awards_verified,
      press_mentions, synthesized_bio, selection_rationale,
      sales_count_all_time, sales_count_last_year,
      price_range_3yr_min, price_range_3yr_max,
      verification_token, canonical_slug, short_code,
      service_areas, city_id,
      cities:city_id (name, state, state_slug, slug)
    `;

    const { data: professional, error: profError } = await supabase
      .from("professionals")
      .select(selectCols)
      .eq("id", professionalId)
      .single();

    if (profError || !professional) {
      return new Response(JSON.stringify({ error: "Professional not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const city = Array.isArray(professional.cities) ? professional.cities[0] : professional.cities;
    const stateName = city?.state ?? "Arizona";
    const verifiedDate = new Date().toISOString().split("T")[0];

    const justification_data = buildJustificationData(professional, tierForDb, markets, neighborhoods, verifiedDate);

    const now = new Date();
    const nextVerificationDue = new Date(now);
    if (tierForDb === "certified") nextVerificationDue.setFullYear(now.getFullYear() + 1);
    else if (tierForDb === "accredited") nextVerificationDue.setMonth(now.getMonth() + 1);
    else nextVerificationDue.setDate(now.getDate() + 1);

    const certPayload = {
      professional_id: professional.id,
      certification_tier: tierForDb,
      certification_status: "active",
      issued_at: now.toISOString(),
      last_verified_at: now.toISOString(),
      next_verification_due: nextVerificationDue.toISOString(),
      methodology_version: "1.0",
      markets_covered: markets,
      neighborhoods_covered: neighborhoods,
      justification_data,
      updated_at: now.toISOString(),
    };

    const { data: certification, error: certError } = await supabase
      .from("certifications")
      .upsert(certPayload, { onConflict: "professional_id" })
      .select()
      .single();

    if (certError) {
      console.error("[generate-certification] Upsert error:", certError);
      return new Response(JSON.stringify({ error: certError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tierEnum = tierForDb as "listed" | "certified" | "accredited" | "underwritten";
    await supabase
      .from("professionals")
      .update({
        current_tier: tierEnum,
        artifact_issued: true,
        last_diligence_check: now.toISOString(),
        annual_review_date: nextVerificationDue.toISOString(),
      })
      .eq("id", professional.id);

    const verification_token = professional.verification_token ?? professional.id;
    const canonical_slug = professional.canonical_slug ?? professional.short_code ?? professional.id;
    const agent_slug = canonical_slug;
    const tierLabel = tierForDb === "accredited" ? "Audited" : tierForDb === "certified" ? "Certified" : "Underwritten";

    const artifact_url = `${BASE}/artifact/${verification_token}`;
    const badge_url = `${BASE}/badge/${verification_token}`;
    const certificate_url = `${BASE}/certificate/${canonical_slug}`;
    const embed_code = `<a href="${certificate_url}" target="_blank" rel="noopener"><img src="${badge_url}" alt="Top10Lists.us ${tierLabel} Real Estate Professional" width="200" height="auto" /></a>`;

    return new Response(
      JSON.stringify({
        certification: { ...certification },
        artifact_url,
        badge_url,
        certificate_url,
        embed_code,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("[generate-certification] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildJustificationData(
  professional: any,
  tier: "certified" | "accredited" | "underwritten",
  markets: string[],
  neighborhoods: string[],
  verifiedDate: string
): Record<string, unknown> {
  const base = {
    selection_rationale:
      professional.selection_rationale ||
      professional.synthesized_bio ||
      `${professional.name} was selected through the Top10Lists.us merit-based qualification process, which evaluates the top 0.5% of more than 750,000 in Arizona and more than 450,000 in California. Inclusion cannot be purchased.`,
    rating: professional.review_stars_rating ?? null,
    review_count: professional.num_total_reviews ?? null,
    years_experience: professional.years_experience ?? null,
    license_number: professional.license_number ?? null,
    brokerage: professional.company ?? null,
    sales_all_time: professional.sales_count_all_time ?? professional.total_sales ?? null,
    sales_last_year: professional.sales_count_last_year ?? null,
    price_min: professional.price_range_3yr_min ?? null,
    price_max: professional.price_range_3yr_max ?? null,
    verified_date: verifiedDate,
  };

  if (tier === "certified") return base;

  const accredited: Record<string, unknown> = {
    ...base,
    markets_covered: markets.length ? markets : (professional.service_areas ?? []),
    community_roles: professional.community_roles ?? [],
  };

  if (tier === "accredited") return accredited;

  const designations = Array.isArray(professional.certifications_verified)
    ? professional.certifications_verified.map((c: any) =>
        typeof c === "object" ? (c.designation ?? c.name) : c
      )
    : [];
  const specialties = Array.isArray(professional.specialty) ? professional.specialty : professional.specialty ? [professional.specialty] : [];
  const evidence: string[] = [];
  if (base.rating) evidence.push(`${base.rating} averaged star rating across Zillow, Google, and Yelp`);
  if (base.review_count) evidence.push(`${base.review_count} unique reviews from Zillow and Google`);
  if (base.sales_all_time) evidence.push(`${base.sales_all_time} lifetime transactions verified by Zillow, cross-verified by MLS when possible`);
  (professional.community_roles ?? []).forEach((r: any) => {
    const org = typeof r === "object" ? r.organization ?? r.name : r;
    const source = typeof r === "object" && r.source ? r.source : "Agent self-reported";
    evidence.push(`${org} (${source})`);
  });
  if (designations.length) evidence.push(`${designations.join(", ")} (NAR certification database)`);

  return {
    ...accredited,
    neighborhoods_covered: neighborhoods,
    specialties,
    certifications: designations,
    evidence_considered: evidence,
    zip_code_activity: {}, // Underwritten: populated by enrichment; artifact shows per-zip transaction counts
  };
}
