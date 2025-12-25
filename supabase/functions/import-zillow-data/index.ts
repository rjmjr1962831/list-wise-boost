import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface ZillowDataRequest {
  agent_name: string;
  city: string;
  state: string;
  zillow_url?: string | null;
  zillow_rating?: number | null;
  zillow_reviews?: number | null;
  status: "found" | "not_found" | "error";
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API key check
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("CRAWLER_API_KEY");

    if (!apiKey || apiKey !== expectedKey) {
      console.error("Invalid or missing API key");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid API key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const data: ZillowDataRequest = await req.json();
    console.log("Received zillow data:", JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.agent_name || !data.city || !data.state || !data.status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: agent_name, city, state, status" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert to zillow_search_results
    const { data: result, error } = await supabase
      .from("zillow_search_results")
      .upsert(
        {
          agent_name: data.agent_name,
          city: data.city,
          state: data.state,
          zillow_url: data.zillow_url || null,
          zillow_rating: data.zillow_rating || null,
          zillow_reviews: data.zillow_reviews || null,
          status: data.status,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "agent_name,city,state",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Successfully upserted:", result?.id);
    return new Response(
      JSON.stringify({ success: true, id: result?.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
