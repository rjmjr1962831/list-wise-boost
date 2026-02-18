/**
 * Serves tier-appropriate badge PNG. Lookup by agent ID, short_code, or verification_token.
 * Worker /badge/{token} proxies here with ?token=xxx. Returns image with Link header to artifact.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BADGE_BASE = "https://raw.githubusercontent.com/rjmjr1962831/list-wise-boost/main/public/badges";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const tokenParam = url.searchParams.get("token");
    const identifier = tokenParam ?? pathParts[pathParts.length - 1];

    if (!identifier) {
      return new Response(JSON.stringify({ error: "Missing agent ID or token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const isUuid = /^[a-f0-9-]{36}$/i.test(identifier);
    let professional: { id: string; name?: string } | null = null;
    let tier: string = "certified";

    if (isUuid) {
      const byToken = await supabase
        .from("professionals")
        .select("id, name")
        .eq("verification_token", identifier)
        .eq("active", true)
        .maybeSingle();
      if (byToken.data) {
        professional = byToken.data;
        const { data: cert } = await supabase
          .from("certifications")
          .select("certification_tier")
          .eq("professional_id", byToken.data.id)
          .eq("certification_status", "active")
          .maybeSingle();
        if (cert?.certification_tier) tier = cert.certification_tier;
      }
    }

    if (!professional) {
      const byIdOrCode = await supabase
        .from("professionals")
        .select("id, name, verification_token, badge_tier, badge_status")
        .or(`id.eq.${identifier},short_code.eq.${identifier}`)
        .maybeSingle();
      if (byIdOrCode.data) {
        professional = byIdOrCode.data;
        if (byIdOrCode.data.badge_status === "active" || byIdOrCode.data.badge_status === "grace_period") {
          tier = byIdOrCode.data.badge_tier || "certified";
        } else {
          const { data: cert } = await supabase
            .from("certifications")
            .select("certification_tier")
            .eq("professional_id", byIdOrCode.data.id)
            .eq("certification_status", "active")
            .maybeSingle();
          if (cert?.certification_tier) tier = cert.certification_tier;
        }
      }
    }

    const tierFile = ["certified", "accredited", "underwritten"].includes(tier) ? tier : "certified";
    const badgeUrl = `${BADGE_BASE}/${tierFile}.png`;
    const badgeResponse = await fetch(badgeUrl);

    if (!badgeResponse.ok) {
      throw new Error(`Failed to fetch badge: ${badgeResponse.status}`);
    }

    const badgeBuffer = await badgeResponse.arrayBuffer();
    const artifactToken = isUuid ? identifier : (professional as any)?.verification_token ?? professional?.id ?? identifier;
    const artifactUrl = `https://www.top10lists.us/artifact/${artifactToken}`;

    const headers: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "Link": `<${artifactUrl}>; rel="describedby"`,
      "X-Certification-Tier": tierFile,
    };
    if (professional?.name) headers["X-Agent-Name"] = professional.name;

    return new Response(badgeBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Badge serving error:", error);
    try {
      const fallback = await fetch(`${BADGE_BASE}/certified.png`);
      const buf = await fallback.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Failed to load badge" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
});
