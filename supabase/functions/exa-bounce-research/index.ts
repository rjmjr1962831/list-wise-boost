/**
 * Bounce research: returns professional context for bounced-email tasks.
 * Exa API DEPRECATED – returns empty results; no external search.
 * POST body: { professional_id: string }
 * Returns: { results: [], suggestedEmails: [], query: string, deprecation?: string }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const professionalId = body?.professional_id;
    if (!professionalId) {
      return new Response(
        JSON.stringify({ error: "professional_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: pro, error: proError } = await supabase
      .from("professionals")
      .select("id, name, email, company, business_name, business_city, state_slug")
      .eq("id", professionalId)
      .single();

    if (proError || !pro) {
      return new Response(
        JSON.stringify({ error: "Professional not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const company = (pro.company || pro.business_name || "").trim();
    const city = (pro.business_city || "").trim();
    const state = (pro.state_slug || "").replace(/-/g, " ");
    const query = [pro.name, "real estate agent", city, state, company].filter(Boolean).join(" ");
    const fullQuery = query ? query + " contact email" : "";

    return new Response(
      JSON.stringify({
        results: [],
        suggestedEmails: [],
        query: fullQuery,
        deprecation: "Exa API deprecated; no external search performed.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("exa-bounce-research error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
