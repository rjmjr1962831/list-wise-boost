import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ClaimProfileRequest = {
  token: string;
  action: "start" | "claim";
  city_id?: string;
  email?: string;
};

async function resolveProfessionalId(supabase: ReturnType<typeof createClient>, token: string) {
  const { data: byToken } = await supabase
    .from("professionals")
    .select("id")
    .eq("verification_token", token)
    .maybeSingle();

  if (byToken?.id) return byToken.id as string;

  const { data: byId } = await supabase
    .from("professionals")
    .select("id")
    .eq("id", token)
    .maybeSingle();

  return (byId?.id as string | undefined) ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ClaimProfileRequest = await req.json();

    if (!body?.token) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body?.action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const professionalId = await resolveProfessionalId(supabase, body.token);

    if (!professionalId) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();

    if (body.action === "start") {
      // Only set started timestamp once.
      const { error: startError } = await supabase
        .from("professionals")
        .update({
          funnel_started_at: nowIso,
          funnel_status: "onboarding_started",
        })
        .eq("id", professionalId)
        .is("funnel_started_at", null);

      if (startError) throw startError;

      // Best-effort analytics event
      await supabase.from("funnel_events").insert({
        professional_id: professionalId,
        event_name: "funnel_started",
        event_data: { source: "streamlined_onboarding" },
      });

      return new Response(JSON.stringify({ success: true, professional_id: professionalId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "claim") {
      if (!body.city_id) {
        return new Response(JSON.stringify({ error: "city_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!body.email) {
        return new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure funnel started is set (but don't overwrite if already started)
      await supabase
        .from("professionals")
        .update({
          funnel_started_at: nowIso,
          funnel_status: "onboarding_started",
        })
        .eq("id", professionalId)
        .is("funnel_started_at", null);

      const { error: claimError } = await supabase
        .from("professionals")
        .update({
          city_id: body.city_id,
          email: body.email,
          is_brand_builder: true,
          funnel_status: "claim_initiated",
          funnel_completed_at: nowIso,
        })
        .eq("id", professionalId);

      if (claimError) throw claimError;

      // Record approval event for analytics/dashboard
      await supabase.from("funnel_events").insert({
        professional_id: professionalId,
        event_name: "profile_approved",
        event_data: { city_id: body.city_id },
      });

      return new Response(JSON.stringify({ success: true, professional_id: professionalId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("claim-profile - Error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
