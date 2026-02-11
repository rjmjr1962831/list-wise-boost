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
    const INSTANTLY_API_KEY = Deno.env.get("INSTANTLY_API_KEY");
    
    return new Response(
      JSON.stringify({ 
        has_key: !!INSTANTLY_API_KEY,
        key_length: INSTANTLY_API_KEY?.length || 0,
        key_preview: INSTANTLY_API_KEY ? INSTANTLY_API_KEY.substring(0, 10) + "..." : "none"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
