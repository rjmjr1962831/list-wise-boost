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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { professionalId, cityId } = await req.json();

    if (!professionalId || !cityId) {
      return new Response(
        JSON.stringify({ error: "Missing professionalId or cityId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Saving free city selection: professional=${professionalId}, city=${cityId}`);

    // Get city name from cities table
    const { data: cityData } = await supabase
      .from("cities")
      .select("name")
      .eq("id", cityId)
      .single();

    const cityName = cityData?.name || cityId;

    // Update the professional's city_id, funnel_status, and cities_subscribed
    const { error: updateError } = await supabase
      .from("professionals")
      .update({ 
        city_id: cityId,
        funnel_status: 'free_selected',
        cities_subscribed: [cityName]
      })
      .eq("id", professionalId);

    if (updateError) {
      console.error("Error updating professional:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to create subscription if city exists in pricing table
    const { data: pricingCity } = await supabase
      .from("arizona_city_pricing")
      .select("id")
      .eq("city_name", cityName)
      .single();

    if (pricingCity) {
      // Remove any existing free subscription for this professional
      await supabase
        .from("agent_city_subscriptions")
        .delete()
        .eq("professional_id", professionalId)
        .eq("subscription_type", "free");

      // Create a new free subscription record
      await supabase
        .from("agent_city_subscriptions")
        .insert({
          professional_id: professionalId,
          city_id: pricingCity.id,
          subscription_type: "free",
          is_active: true,
          started_at: new Date().toISOString(),
        });
    }

    console.log(`Successfully saved free city selection for ${professionalId}: ${cityName}`);

    return new Response(
      JSON.stringify({ success: true, cityName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in save-free-city-selection:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});