import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a cryptographically random 32-character session token
function generateSessionToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json();

    if (!email || !code || typeof email !== 'string' || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.trim();

    console.log(`[verify-agent-code] Processing verification for email: ${normalizedEmail.substring(0, 3)}***`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limiting - 5 failures in 15 minutes = lockout
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    // Check for active lockout
    const { data: lockout } = await supabase
      .from("agent_rate_limits")
      .select("locked_until")
      .eq("email", normalizedEmail)
      .gt("locked_until", new Date().toISOString())
      .maybeSingle();

    if (lockout) {
      console.log(`[verify-agent-code] Account locked for email: ${normalizedEmail.substring(0, 3)}***`);
      return new Response(
        JSON.stringify({ success: false, error: "Too many failed attempts. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count recent failures
    const { count: failureCount } = await supabase
      .from("agent_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .eq("attempt_type", "verification_failure")
      .gte("created_at", fifteenMinutesAgo);

    if (failureCount && failureCount >= 5) {
      // Lock the account for 15 minutes
      await supabase
        .from("agent_rate_limits")
        .insert({
          email: normalizedEmail,
          attempt_type: "lockout",
          locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });

      console.log(`[verify-agent-code] Account locked due to too many failures: ${normalizedEmail.substring(0, 3)}***`);
      return new Response(
        JSON.stringify({ success: false, error: "Too many failed attempts. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up professional by email
    const { data: professional, error: lookupError } = await supabase
      .from("professionals")
      .select("id, name, email, active")
      .eq("email", normalizedEmail)
      .eq("active", true)
      .maybeSingle();

    if (lookupError || !professional) {
      console.log("[verify-agent-code] Professional not found or inactive");
      // Record failure
      await supabase.from("agent_rate_limits").insert({
        email: normalizedEmail,
        attempt_type: "verification_failure",
      });
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the verification code
    const now = new Date().toISOString();
    const { data: verificationCode, error: codeError } = await supabase
      .from("agent_verification_codes")
      .select("id, professional_id, code, expires_at, used_at")
      .eq("professional_id", professional.id)
      .eq("code", normalizedCode)
      .gt("expires_at", now)
      .is("used_at", null)
      .maybeSingle();

    if (codeError || !verificationCode) {
      console.log("[verify-agent-code] Invalid or expired code");
      // Record failure
      await supabase.from("agent_rate_limits").insert({
        email: normalizedEmail,
        attempt_type: "verification_failure",
      });
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark code as used
    const { error: updateError } = await supabase
      .from("agent_verification_codes")
      .update({ used_at: now })
      .eq("id", verificationCode.id);

    if (updateError) {
      console.error("[verify-agent-code] Error marking code as used:", updateError);
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Create session
    const { error: sessionError } = await supabase
      .from("agent_sessions")
      .insert({
        professional_id: professional.id,
        session_token: sessionToken,
        expires_at: expiresAt,
        last_active_at: now,
      });

    if (sessionError) {
      console.error("[verify-agent-code] Error creating session:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear rate limit failures for this email on successful verification
    await supabase
      .from("agent_rate_limits")
      .delete()
      .eq("email", normalizedEmail);

    console.log(`[verify-agent-code] Successfully verified and created session for professional: ${professional.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionToken: sessionToken,
        redirectUrl: "/agent/dashboard",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[verify-agent-code] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
