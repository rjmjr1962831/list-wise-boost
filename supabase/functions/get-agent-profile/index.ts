import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken } = await req.json();

    if (!sessionToken || typeof sessionToken !== "string") {
      return new Response(
        JSON.stringify({ error: "Session token required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[get-agent-profile] Validating session: ${sessionToken.substring(0, 8)}...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .select("id, professional_id, expires_at")
      .eq("session_token", sessionToken)
      .gt("expires_at", now)
      .maybeSingle();

    if (sessionError || !session) {
      console.log("[get-agent-profile] Session not found or expired");
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extend session
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("agent_sessions")
      .update({ last_active_at: now, expires_at: newExpiresAt })
      .eq("id", session.id);

    console.log(`[get-agent-profile] Fetching professional: ${session.professional_id}`);

    // Fetch professional with city and category joins
    const { data: professional, error: profError } = await supabase
      .from("professionals")
      .select(`
        *,
        city:city_id (
          id,
          name,
          slug,
          state,
          state_slug
        ),
        category:category_id (
          id,
          name,
          slug
        )
      `)
      .eq("id", session.professional_id)
      .single();

    if (profError || !professional) {
      console.error("[get-agent-profile] Professional not found:", profError);
      return new Response(
        JSON.stringify({ error: "Professional not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch city subscriptions
    const { data: subscriptions } = await supabase
      .from("agent_city_subscriptions")
      .select(`
        id,
        subscription_type,
        is_active,
        started_at,
        expires_at,
        stripe_subscription_id,
        city:city_id (
          id,
          city_name,
          city_slug
        )
      `)
      .eq("professional_id", session.professional_id);

    // Fetch pending change requests
    const { data: pendingRequests } = await supabase
      .from("field_change_requests")
      .select("id, field_name, current_value, proposed_value, status, created_at")
      .eq("professional_id", session.professional_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    // Determine Stripe status from subscription data (no API call)
    const hasStripeSubscription = subscriptions?.some(
      (sub) => sub.stripe_subscription_id && sub.is_active
    ) || false;

    console.log(`[get-agent-profile] Success - hasStripeSubscription: ${hasStripeSubscription}`);

    return new Response(
      JSON.stringify({
        professional,
        subscriptions: subscriptions || [],
        pendingRequests: pendingRequests || [],
        hasStripeSubscription,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[get-agent-profile] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
