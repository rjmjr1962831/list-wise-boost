import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CertificationTier = "listed" | "certified" | "audited" | "underwritten";

interface FunnelSelectTierRequest {
  token: string;
  tier: CertificationTier;
  listedAction?: "stay_listed" | "delete_listing";
  billingCycle?: "monthly" | "annual";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: FunnelSelectTierRequest = await req.json();

    if (!body.token || !body.tier) {
      return new Response(
        JSON.stringify({ error: "Missing token or tier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTiers: CertificationTier[] = ["listed", "certified", "audited", "underwritten"];
    if (!validTiers.includes(body.tier)) {
      return new Response(
        JSON.stringify({ error: "Invalid tier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let prof: { id: string } | null = null;
    const { data: byToken } = await supabase
      .from("professionals")
      .select("id")
      .eq("verification_token", body.token)
      .maybeSingle();
    if (byToken) prof = byToken;
    else if (/^[0-9a-f-]{36}$/i.test(body.token)) {
      const { data: byId } = await supabase
        .from("professionals")
        .select("id")
        .eq("id", body.token)
        .maybeSingle();
      if (byId) prof = byId;
    }

    if (!prof) {
      return new Response(
        JSON.stringify({ error: "Professional not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isFree = body.tier === "listed" || body.tier === "certified";
    const nextBillDate = isFree ? null : body.billingCycle === "annual"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const updatePayload: Record<string, unknown> = {
      current_tier: body.tier,
      next_bill_date: nextBillDate,
      funnel_completed_at: new Date().toISOString(),
      funnel_status: "completed",
      updated_at: new Date().toISOString(),
    };

    if (body.tier === "certified") {
      updatePayload.artifact_issued = true;
    }

    if (body.tier === "listed" && body.listedAction === "delete_listing") {
      updatePayload.active = false;
    }

    const { error: updateError } = await supabase
      .from("professionals")
      .update(updatePayload)
      .eq("id", prof.id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, professionalId: prof.id, tier: body.tier }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("funnel-select-tier error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
