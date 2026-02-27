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
    const agentId = pathParts[pathParts.length - 1]; // last segment (rewrite: .../artifact-payload/:id)

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

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
    const query = supabase
      .from("professionals")
      .select("id, verification_token, certifications!inner(certification_status)")
      .eq("certifications.certification_status", "active");
    if (isUuid) {
      query.eq("id", agentId);
    } else {
      query.eq("canonical_slug", agentId);
    }
    const { data, error } = await query.single();

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
