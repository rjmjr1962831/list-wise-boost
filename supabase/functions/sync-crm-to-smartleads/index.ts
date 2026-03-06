/**
 * Sync a Supabase professional to Smartlead (add/update lead, add to campaign).
 * API ref: https://api.smartlead.ai/reference
 * Env: SMARTLEADS_API_KEY (or set in Supabase Edge Function secrets).
 * Vault: optional secret name 'smartleads_api_key' (read below if env missing).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SMARTLEADS_BASE = "https://api.smartlead.ai/api/v1";

async function getApiKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const fromEnv = Deno.env.get("SMARTLEADS_API_KEY");
  if (fromEnv) return fromEnv;
  const { data } = await supabase.from("vault.decrypted_secrets").select("decrypted_secret").eq("name", "smartleads_api_key").maybeSingle();
  return data?.decrypted_secret ?? null;
}

async function smartleadRequest(
  apiKey: string,
  method: string,
  path: string,
  body?: object
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const url = `${SMARTLEADS_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (data as any)?.message || data?.error || res.statusText };
  }
  return { ok: true, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const apiKey = await getApiKey(supabase);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "SMARTLEADS_API_KEY not configured. Set in Supabase Edge Function secrets or .env." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const { professional_id, campaign_id, action = "add" } = payload;

    // List campaigns only (Smartlead: GET /api/v1/analytics/campaign-list or /campaigns)
    if (payload.list_campaigns === true) {
      let result = await smartleadRequest(apiKey, "GET", "/analytics/campaign-list");
      if (!result.ok) {
        result = await smartleadRequest(apiKey, "GET", "/campaigns");
      }
      if (!result.ok) {
        return new Response(
          JSON.stringify({ error: "Smartlead campaigns fetch failed", details: result.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const raw = result.data as any;
      const campaigns = Array.isArray(raw) ? raw : (raw?.campaigns ?? raw?.data ?? []);
      return new Response(JSON.stringify({ campaigns }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!professional_id) {
      return new Response(
        JSON.stringify({ error: "professional_id required. Use list_campaigns: true to list campaigns." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: professional, error: fetchError } = await supabase
      .from("professionals")
      .select("id, email, name, phone, company, business_name, state_slug, business_city, canonical_slug, lead_status")
      .eq("id", professional_id)
      .single();

    if (fetchError || !professional) {
      return new Response(
        JSON.stringify({ error: "Professional not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!professional.email || professional.email === "pending@123.com") {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no valid email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nameParts = (professional.name ?? "").split(" ", 2);
    const first_name = nameParts[0] ?? "";
    const last_name = nameParts[1] ?? "";
    const company = professional.company ?? professional.business_name ?? "";
    const profileUrl =
      professional.canonical_slug && professional.state_slug
        ? `https://www.top10lists.us/${professional.state_slug}/agents/${professional.canonical_slug}`
        : "";

    const leadPayload = {
      email: professional.email,
      first_name,
      last_name,
      company_name: company,
      ...(professional.phone && { phone: professional.phone }),
      ...(professional.business_city && { city: professional.business_city }),
      ...(professional.state_slug && { state: professional.state_slug }),
      ...(profileUrl && { custom_variables: { profile_url: profileUrl } }),
    };

    if (!campaign_id) {
      return new Response(
        JSON.stringify({
          error: "campaign_id required to add lead to Smartlead. Use list_campaigns: true in the request body to list campaigns.",
          lead_preview: { email: professional.email, first_name: leadPayload.first_name, last_name: leadPayload.last_name },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add lead to campaign (Smartlead "Push Leads/List to Campaign")
    const result = await smartleadRequest(apiKey, "POST", `/campaigns/${campaign_id}/leads`, {
      lead_list: [leadPayload],
    });
    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: "Smartlead add-to-campaign failed", details: result.error }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        action: "add_to_campaign",
        campaign_id,
        email: professional.email,
        smartlead_response: result.data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-crm-to-smartleads error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
