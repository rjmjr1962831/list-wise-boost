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

    const { professionalId, cityIds, markVerified } = await req.json();

    if (!professionalId || !cityIds || !Array.isArray(cityIds) || cityIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing professionalId or cityIds array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Saving city selection: professional=${professionalId}, cities=${cityIds.length}, markVerified=${markVerified}`);

    // Get city names from cities table
    const { data: citiesData, error: citiesError } = await supabase
      .from("cities")
      .select("id, name, state")
      .in("id", cityIds);

    if (citiesError) {
      console.error("Error fetching cities:", citiesError);
      return new Response(
        JSON.stringify({ error: citiesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cityNames = citiesData?.map(c => c.name) || [];

    // Build update object
    const updateData: Record<string, unknown> = {
      cities_subscribed: cityNames,
      updated_at: new Date().toISOString(),
    };

    // If marking as verified, update verification status
    if (markVerified) {
      updateData.profile_verified_at = new Date().toISOString();
      updateData.funnel_status = 'cities_selected';
    }

    // If only one city, also set as primary city_id
    if (cityIds.length === 1) {
      updateData.city_id = cityIds[0];
    }

    // Update the professional
    const { error: updateError } = await supabase
      .from("professionals")
      .update(updateData)
      .eq("id", professionalId);

    if (updateError) {
      console.error("Error updating professional:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create professional_cities records for each selected city
    // First, remove existing entries
    await supabase
      .from("professional_cities")
      .delete()
      .eq("professional_id", professionalId);

    // Insert new city associations
    const cityAssociations = cityIds.map((cityId: string, index: number) => ({
      professional_id: professionalId,
      city_id: cityId,
      rank: index + 1,
      active: true,
    }));

    const { error: insertError } = await supabase
      .from("professional_cities")
      .insert(cityAssociations);

    if (insertError) {
      console.error("Error inserting city associations:", insertError);
      // Non-fatal - continue anyway
    }

    console.log(`Successfully saved city selection for ${professionalId}: ${cityNames.join(", ")}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        cityNames,
        verified: markVerified || false 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in save-city-selection:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
