import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INSTANTLY_API_KEY = Deno.env.get("INSTANTLY_API_KEY")!;
const INSTANTLY_CAMPAIGN_ID = Deno.env.get("INSTANTLY_CAMPAIGN_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function instantlyRequest(method: string, path: string, body?: any) {
  const res = await fetch(`https://api.instantly.ai/api/v2${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function buildLeadPayload(agent: any) {
  const nameParts = (agent.name || "").trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const tier = (agent.current_tier || agent.badge_tier || "listed").toLowerCase();
  const magicLink = agent.verification_token
    ? `https://www.top10lists.us/funnel/${agent.verification_token}`
    : "";
  const specialties = Array.isArray(agent.specialty)
    ? agent.specialty.slice(0, 3).join(", ")
    : "";

  return {
    email: agent.email,
    first_name: firstName,
    last_name: lastName,
    company_name: agent.company || "",
    campaign_id: INSTANTLY_CAMPAIGN_ID,
    custom_variables: {
      tier: tier === "listed" ? "hot" : tier,
      tier_level: tier,
      state: agent.state_slug === "arizona" ? "Arizona" : "California",
      magic_link: magicLink,
      business_city: agent.business_city || "",
      num_reviews: String(agent.num_total_reviews || ""),
      star_rating: String(agent.review_stars_rating || ""),
      years_experience: String(agent.years_experience || ""),
      specialties,
      aics_current: tier === "listed" ? "23/100" : tier === "certified" ? "45/100" : tier === "audited" ? "80/100" : "95/100",
      aics_listed: "23/100",
      aics_certified: "45/100",
      aics_audited: "80/100",
      aics_underwritten: "95/100",
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dry_run === true;
  const stateFilter = body.state || null; // "arizona" | "california" | null (both)

  // Fetch agents in batches
  const states = stateFilter ? [stateFilter] : ["arizona", "california"];
  const agents: any[] = [];

  for (const state of states) {
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from("professionals")
        .select("id, name, email, state_slug, company, verification_token, business_city, num_total_reviews, review_stars_rating, years_experience, specialty, current_tier, badge_tier, instantly_id")
        .eq("active", true)
        .eq("state_slug", state)
        .not("email", "is", null)
        .range(offset, offset + 999);

      if (!data || data.length === 0) break;
      agents.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }
  }

  const stats = { total: agents.length, created: 0, updated: 0, skipped: 0, errors: 0 };

  if (dryRun) {
    return new Response(JSON.stringify({ dry_run: true, would_sync: stats.total, sample: agents.slice(0,3) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Process in batches of 50 to avoid rate limits
  const BATCH = 50;
  for (let i = 0; i < agents.length; i += BATCH) {
    const batch = agents.slice(i, i + BATCH);

    for (const agent of batch) {
      try {
        const payload = buildLeadPayload(agent);

        if (agent.instantly_id) {
          // Update existing lead
          await instantlyRequest("PATCH", `/leads/${agent.instantly_id}`, {
            first_name: payload.first_name,
            last_name: payload.last_name,
            company_name: payload.company_name,
            custom_variables: payload.custom_variables,
          });
          stats.updated++;
        } else {
          // Create new lead
          const result = await instantlyRequest("POST", "/leads", payload);
          if (result.id) {
            await supabase.from("professionals")
              .update({ instantly_id: result.id })
              .eq("id", agent.id);
            stats.created++;
          } else {
            stats.errors++;
          }
        }
      } catch {
        stats.errors++;
      }
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH < agents.length) await new Promise(r => setTimeout(r, 200));
  }

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
