import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Self-service fields that agents can edit directly
// NOTE: Email is NOT included - email changes require support
const ALLOWED_FIELDS = [
  "phone",
  "description",
  "get_to_know_me",
  "image_url",
  "website",
  "sidebar_video_url",
  "social_facebook",
  "social_instagram",
  "social_linkedin",
  "social_twitter",
  "social_tiktok",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken, updates } = await req.json();

    if (!sessionToken || typeof sessionToken !== "string") {
      return new Response(
        JSON.stringify({ error: "Session token required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No updates provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[update-agent-profile] Validating session: ${sessionToken.substring(0, 8)}...`);

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
      console.log("[update-agent-profile] Session not found or expired");
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

    // Filter updates to only allowed fields
    const sanitizedUpdates: Record<string, unknown> = {};
    const rejectedFields: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_FIELDS.includes(key)) {
        sanitizedUpdates[key] = value;
      } else {
        rejectedFields.push(key);
      }
    }

    if (rejectedFields.length > 0) {
      console.log(`[update-agent-profile] Rejected fields: ${rejectedFields.join(", ")}`);
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No allowed fields to update",
          rejectedFields,
          allowedFields: ALLOWED_FIELDS 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[update-agent-profile] Updating professional ${session.professional_id}:`, 
      Object.keys(sanitizedUpdates));

    // Update professionals table
    sanitizedUpdates.updated_at = now;

    const { data: updated, error: updateError } = await supabase
      .from("professionals")
      .update(sanitizedUpdates)
      .eq("id", session.professional_id)
      .select()
      .single();

    if (updateError) {
      console.error("[update-agent-profile] Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[update-agent-profile] Success`);

    // TODO: Optionally sync update to Pipedrive as an activity
    // This can be added later if needed

    return new Response(
      JSON.stringify({
        success: true,
        professional: updated,
        updatedFields: Object.keys(sanitizedUpdates).filter(k => k !== "updated_at"),
        rejectedFields,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[update-agent-profile] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
