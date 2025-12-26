import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_KEY = "t10l_zs_8Kx3mN7pQr2vW9yB4cF6hJ1dL5gT0aE";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== API_KEY) {
    console.error("Unauthorized request - invalid API key");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { state, limit = 50 } = await req.json();

    if (!state) {
      return new Response(JSON.stringify({ error: "state required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Getting Zillow queue for state: ${state}, limit: ${limit}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get agents needing scraping (never scraped)
    const { data: agents, error } = await supabase
      .from("state_licenses")
      .select("license_number, state, name, city")
      .eq("state", state)
      .is("zillow_scraped_at", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Error fetching queue:", error);
      throw error;
    }

    // Get remaining count
    const { count } = await supabase
      .from("state_licenses")
      .select("*", { count: "exact", head: true })
      .eq("state", state)
      .is("zillow_scraped_at", null);

    console.log(`Found ${agents?.length || 0} agents, ${count || 0} total remaining`);

    return new Response(
      JSON.stringify({
        agents: agents || [],
        remaining: (count || 0) - (agents?.length || 0),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error in get-zillow-queue:", err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
