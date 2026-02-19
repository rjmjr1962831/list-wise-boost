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

/**
 * Creates an agent dashboard session from a valid verification token.
 * Used when approved agents click their magic link - they bypass login
 * and go straight to their dashboard.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-session-from-token] Processing token: ${token.substring(0, 8)}...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up professional by verification_token or id
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    
    let professional: any = null;

    if (isUUID) {
      // Try by ID first
      const { data: byId } = await supabase
        .from("professionals")
        .select("id, name, email, active, funnel_status")
        .eq("id", token)
        .maybeSingle();
      
      professional = byId;

      if (!professional) {
        // Try by verification_token
        const { data: byToken } = await supabase
          .from("professionals")
          .select("id, name, email, active, funnel_status")
          .eq("verification_token", token)
          .maybeSingle();
        
        professional = byToken;
      }
    } else {
      // Fuzzy match on verification_token
      const { data: byTokenFuzzy } = await supabase
        .from("professionals")
        .select("id, name, email, active, funnel_status")
        .ilike("verification_token", `%${token}%`)
        .maybeSingle();
      
      professional = byTokenFuzzy;
    }

    if (!professional) {
      console.log("[create-session-from-token] Professional not found");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!professional.active) {
      console.log("[create-session-from-token] Professional not active");
      return new Response(
        JSON.stringify({ success: false, error: "Profile not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow admins to bypass funnel_status check (for Test Agent Dashboard)
    let adminBypass = false;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: adminRoles } = await supabase
          .from("admin_users")
          .select("role")
          .eq("id", user.id);
        adminBypass = adminRoles?.some((r: { role: string }) =>
          r.role === "admin" || r.role === "superadmin"
        ) ?? false;
      }
    }

    // Only create session for approved agents (unless admin bypass)
    if (!adminBypass && professional.funnel_status !== 'approved') {
      console.log(`[create-session-from-token] Funnel status is '${professional.funnel_status}', not 'approved'`);
      return new Response(
        JSON.stringify({ success: false, error: "Profile not approved", funnel_status: professional.funnel_status }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Create session
    const { error: sessionError } = await supabase
      .from("agent_sessions")
      .insert({
        professional_id: professional.id,
        token: sessionToken,
        expires_at: expiresAt,
      });

    if (sessionError) {
      console.error("[create-session-from-token] Error creating session:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-session-from-token] Session created for professional: ${professional.id} (${professional.name})`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionToken: sessionToken,
        professionalId: professional.id,
        name: professional.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[create-session-from-token] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
