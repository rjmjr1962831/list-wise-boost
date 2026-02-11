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

    if (action === "test") {
      // Test API connection
      const response = await fetch(`${INSTANTLY_API_BASE}/campaigns`, {
        headers: {
          "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
        },
      });

      const campaigns = await response.json();
      
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

    if (action === "add_lead") {
      // Add lead to campaign
      const { campaign_id, email, first_name, last_name, custom_variables } = data;

      const response = await fetch(`${INSTANTLY_API_BASE}/leads/add`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign_id,
          email,
          first_name,
          last_name,
          custom_variables: custom_variables || {},
        }),
      });

      const result = await response.json();

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list_campaigns") {
      const response = await fetch(`${INSTANTLY_API_BASE}/campaigns`, {
        headers: {
          "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
        },
      });

      const result = await response.json();

      return new Response(
        JSON.stringify({ success: true, campaigns: result.items || [] }),
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
