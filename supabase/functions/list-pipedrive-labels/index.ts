import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const pipedriveDomain = Deno.env.get("PIPEDRIVE_DOMAIN");

    if (!pipedriveToken || !pipedriveDomain) {
      throw new Error("Pipedrive credentials not configured");
    }

    // Fetch person fields to find label options
    const response = await fetch(
      `https://${pipedriveDomain}.pipedrive.com/api/v1/personFields?api_token=${pipedriveToken}`
    );

    if (!response.ok) {
      throw new Error(`Pipedrive API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Find the label field
    const labelField = data.data?.find((f: any) => f.key === "label");
    
    console.log("Label field found:", JSON.stringify(labelField, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        labelField: labelField || null,
        options: labelField?.options || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
