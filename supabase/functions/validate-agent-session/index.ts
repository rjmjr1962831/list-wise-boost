import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken } = await req.json();

    if (!sessionToken || typeof sessionToken !== 'string') {
      return new Response(
        JSON.stringify({ valid: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[validate-agent-session] Validating session token: ${sessionToken.substring(0, 8)}...`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Look up the session
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .select("id, professional_id, expires_at")
      .eq("session_token", sessionToken)
      .gt("expires_at", now)
      .maybeSingle();

    if (sessionError || !session) {
      console.log("[validate-agent-session] Session not found or expired");
      return new Response(
        JSON.stringify({ valid: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extend session on activity (rolling 24-hour expiry)
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { error: updateError } = await supabase
      .from("agent_sessions")
      .update({
        last_active_at: now,
        expires_at: newExpiresAt,
      })
      .eq("id", session.id);

    if (updateError) {
      console.error("[validate-agent-session] Error extending session:", updateError);
      // Continue anyway - session is still valid
    }

    console.log(`[validate-agent-session] Session valid for professional: ${session.professional_id}`);

    return new Response(
      JSON.stringify({
        valid: true,
        professionalId: session.professional_id,
        expiresAt: newExpiresAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[validate-agent-session] Unexpected error:", error);
    return new Response(
      JSON.stringify({ valid: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
