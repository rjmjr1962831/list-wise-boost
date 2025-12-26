import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_KEY = "t10l_zs_8Kx3mN7pQr2vW9yB4cF6hJ1dL5gT0aE";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface ZillowAgentData {
  license_number: string;
  state: string;
  zillow_status?: string;
  zillow_url?: string;
  zillow_rating?: number;
  zillow_reviews?: number;
  total_sales?: number;
  sales_last_12_months?: number;
  years_experience?: number;
  price_range_min?: number;
  price_range_max?: number;
  avg_price?: number;
  brokerage_name?: string;
  phone?: string;
  email?: string;
  website?: string;
  bio?: string;
  specialties?: string;
  service_areas?: string;
  zillow_reviews_json?: Record<string, unknown>;
  zillow_error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API key check
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== API_KEY) {
      console.error("Invalid or missing API key");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const { agents } = await req.json();

    if (!agents || !Array.isArray(agents)) {
      return new Response(
        JSON.stringify({ error: "agents array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Importing Zillow data for ${agents.length} agents`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const agent of agents as ZillowAgentData[]) {
      const { license_number, state, ...zillowData } = agent;

      if (!license_number || !state) {
        errors++;
        errorDetails.push("Missing license_number or state");
        continue;
      }

      const { error } = await supabase
        .from("state_licenses")
        .update({
          ...zillowData,
          zillow_scraped_at: new Date().toISOString(),
        })
        .eq("license_number", license_number)
        .eq("state", state);

      if (error) {
        errors++;
        errorDetails.push(`${license_number}: ${error.message}`);
        console.error(`Error updating ${license_number}:`, error);
      } else {
        updated++;
      }
    }

    console.log(`Import complete: ${updated} updated, ${errors} errors`);

    return new Response(
      JSON.stringify({ updated, errors, errorDetails: errorDetails.slice(0, 10) }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
