import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSTANTLY_API_KEY = Deno.env.get("INSTANTLY_API_KEY");
const INSTANTLY_API_BASE = "https://api.instantly.ai/api/v2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    console.log("Action:", action);
    console.log("API Key exists:", !!INSTANTLY_API_KEY);
    console.log("API Key length:", INSTANTLY_API_KEY?.length || 0);

    if (action === "test") {
      if (!INSTANTLY_API_KEY) {
        return new Response(
          JSON.stringify({ error: "INSTANTLY_API_KEY not set in environment" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${INSTANTLY_API_BASE}/campaigns`, {
        headers: {
          "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
        },
      });

      console.log("Instantly API status:", response.status);
      const campaigns = await response.json();
      console.log("Instantly response:", campaigns);
      
      if (response.status !== 200) {
        return new Response(
          JSON.stringify({ 
            error: "Instantly API error",
            status: response.status,
            response: campaigns
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Instantly API connected",
          campaigns: campaigns.items || [],
          count: campaigns.items?.length || 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
