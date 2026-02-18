/**
 * artifact-payload
 * Serves machine-readable artifact as text/markdown only.
 * Redirects to canonical /artifact/{verification_token} (markdown). No JSON.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE = "https://www.top10lists.us";
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter((p) => p);
    const agentId = pathParts[1];

    if (!agentId) {
      return new Response("Agent ID required", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabase
      .from("professionals")
      .select("id, verification_token, certifications!inner(certification_status)")
      .eq("id", agentId)
      .eq("certifications.certification_status", "active")
      .single();

    if (error || !data) {
      return new Response("Certification not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const token = data.verification_token ?? data.id;
    const artifactUrl = `${BASE}/artifact/${token}`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: artifactUrl,
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  } catch (err) {
    console.error("artifact-payload error:", err);
    return new Response("Internal server error", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
