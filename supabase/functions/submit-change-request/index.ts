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
    const { sessionToken, fieldName, currentValue, proposedValue, reason } = await req.json();

    if (!sessionToken || typeof sessionToken !== "string") {
      return new Response(
        JSON.stringify({ error: "Session token required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!fieldName) {
      return new Response(
        JSON.stringify({ error: "Field name required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[submit-change-request] Validating session: ${sessionToken.substring(0, 8)}...`);

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
      console.log("[submit-change-request] Session not found or expired");
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

    // Get professional info for Pipedrive task
    const { data: professional } = await supabase
      .from("professionals")
      .select("name, email, verification_token")
      .eq("id", session.professional_id)
      .single();

    if (!professional) {
      return new Response(
        JSON.stringify({ error: "Professional not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[submit-change-request] Creating request for ${professional.name} - field: ${fieldName}`);

    // Create field change request record
    const changeRequestText = reason 
      ? `Agent requested change. Reason: ${reason}`
      : "Agent requested change via self-service dashboard.";

    const { data: request, error: insertError } = await supabase
      .from("field_change_requests")
      .insert({
        professional_id: session.professional_id,
        field_name: fieldName,
        current_value: currentValue || null,
        proposed_value: proposedValue || null,
        change_request: changeRequestText,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[submit-change-request] Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create change request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[submit-change-request] Created request: ${request.id}`);

    // Call existing create-pipedrive-task function to create activity
    const profileLink = `https://www.top10lists.us/profile/${professional.verification_token || session.professional_id}/fields`;

    try {
      const { error: pipedriveError } = await supabase.functions.invoke("create-pipedrive-task", {
        body: {
          fieldName,
          profileLink,
          professionalName: professional.name,
          professionalEmail: professional.email,
          professionalId: session.professional_id,
          changeRequest: changeRequestText,
          currentValue: currentValue || "",
          proposedValue: proposedValue || "",
        },
      });

      if (pipedriveError) {
        console.error("[submit-change-request] Pipedrive task error (non-fatal):", pipedriveError);
      } else {
        console.log("[submit-change-request] Pipedrive task created");
      }
    } catch (pipedriveErr) {
      // Non-fatal - log but don't fail the request
      console.error("[submit-change-request] Pipedrive error (non-fatal):", pipedriveErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        requestId: request.id,
        message: "Your change request has been submitted for review.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[submit-change-request] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
