import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClaimProfileRequest {
  token: string;
  action: "start" | "claim";
  city_id?: string;
  email?: string;
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

    console.log(`📋 claim-profile called: action=${body.action}, token=${body.token.substring(0, 8)}...`);

    // Resolve professional ID from token (try verification_token first, then id)
    let professionalId: string | null = null;

    const { data: byToken } = await supabase
      .from("professionals")
      .select("id")
      .eq("verification_token", body.token)
      .maybeSingle();

    if (byToken && byToken.id) {
      professionalId = byToken.id;
    } else {
      const { data: byId } = await supabase
        .from("professionals")
        .select("id")
        .eq("id", body.token)
        .maybeSingle();

      if (byId && byId.id) {
        professionalId = byId.id;
      }
    }

    if (!professionalId) {
      console.error("❌ Invalid token - professional not found");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Resolved professional ID: ${professionalId}`);

    const nowIso = new Date().toISOString();

    if (body.action === "start") {
      // Only set started timestamp once
      const { error: startError } = await supabase
        .from("professionals")
        .update({
          funnel_started_at: nowIso,
          funnel_status: "onboarding_started",
        })
        .eq("id", professionalId)
        .is("funnel_started_at", null);

      if (startError) {
        console.error("❌ Error updating funnel start:", startError);
        throw startError;
      }

      // Best-effort analytics event
      await supabase.from("funnel_events").insert({
        professional_id: professionalId,
        event_name: "funnel_started",
        event_data: { source: "streamlined_onboarding" },
      });

      console.log("✅ Funnel started for:", professionalId);

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

      if (claimError) {
        console.error("❌ Error updating claim:", claimError);
        throw claimError;
      }

      // Record approval event for analytics/dashboard
      await supabase.from("funnel_events").insert({
        professional_id: professionalId,
        event_name: "profile_approved",
        event_data: { city_id: body.city_id },
      });

      console.log("✅ Profile claimed/approved for:", professionalId);

      return new Response(JSON.stringify({ success: true, professional_id: professionalId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ claim-profile - Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
