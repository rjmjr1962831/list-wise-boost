/**
 * serve-agent-profile-markdown
 * Returns agent artifact as text/markdown when looked up by state + canonical_slug.
 * GET ?state=arizona&slug=john-doe-1234
 * Used by Cloudflare Worker for bot requests to /:state/agents/:slug
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const url = new URL(req.url);
  const stateSlug = url.searchParams.get("state")?.toLowerCase();
  const slug = url.searchParams.get("slug");

  if (!stateSlug || !slug) {
    return new Response("state and slug required", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: pro, error } = await supabase
    .from("professionals")
    .select("id, verification_token")
    .eq("canonical_slug", slug)
    .eq("state_slug", stateSlug)
    .eq("active", true)
    .maybeSingle();

  if (error || !pro?.verification_token) {
    return new Response("Agent not found", { status: 404 });
  }

  const token = pro.verification_token;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const artifactUrl = `${supabaseUrl}/functions/v1/artifact-markdown?token=${encodeURIComponent(token)}`;

  const artifactRes = await fetch(artifactUrl, {
    headers: { "Authorization": `Bearer ${serviceKey}` },
  });
  if (!artifactRes.ok) {
    return new Response(await artifactRes.text(), {
      status: artifactRes.status,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const markdown = await artifactRes.text();
  const headers = new Headers(artifactRes.headers);
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(markdown, {
    status: 200,
    headers,
  });
});
