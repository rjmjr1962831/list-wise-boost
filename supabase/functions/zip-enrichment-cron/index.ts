import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wiotrvoirdgzfacuuiem.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ENRICHMENT_KEY = "t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-enrichment-key",
};

// Census Bureau reverse geocoder
async function getZipFromCoords(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const geographies = data?.result?.geographies;
    
    if (geographies?.["2020 Census ZIP Code Tabulation Areas"]?.[0]) {
      return geographies["2020 Census ZIP Code Tabulation Areas"][0].GEOID20 || null;
    }
    
    return null;
  } catch (e) {
    console.error("Census geocoder error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth check using X-Enrichment-Key
  const authKey = req.headers.get("x-enrichment-key");
  if (authKey !== ENRICHMENT_KEY) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data: neighborhoods, error: fetchError } = await supabase
      .from("neighborhood_catalog")
      .select("id, neighborhood, city_area, state, lat, lon")
      .is("primary_zip", null)
      .in("state", ["California", "Arizona"])
      .not("lat", "is", null)
      .not("lon", "is", null)
      .limit(50);
    
    if (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`);
    }
    
    if (!neighborhoods || neighborhoods.length === 0) {
      return new Response(
        JSON.stringify({ 
          status: "complete", 
          message: "No more CA/AZ neighborhoods need zip enrichment" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Processing ${neighborhoods.length} neighborhoods...`);
    
    const updates: { id: string; primary_zip: string; zips: string[] }[] = [];
    const errors: string[] = [];
    
    for (const hood of neighborhoods) {
      try {
        const zip = await getZipFromCoords(hood.lat, hood.lon);
        if (zip) {
          updates.push({
            id: hood.id,
            primary_zip: zip,
            zips: [zip]
          });
          console.log(`${hood.neighborhood}, ${hood.city_area}: ${zip}`);
        } else {
          errors.push(`No zip for ${hood.neighborhood}, ${hood.city_area}`);
        }
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        errors.push(`Error for ${hood.neighborhood}: ${e.message}`);
      }
    }
    
    let successCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("neighborhood_catalog")
        .update({ 
          primary_zip: update.primary_zip, 
          zips: update.zips,
          updated_at: new Date().toISOString()
        })
        .eq("id", update.id);
      
      if (!updateError) {
        successCount++;
      }
    }
    
    const { count: remaining } = await supabase
      .from("neighborhood_catalog")
      .select("*", { count: "exact", head: true })
      .is("primary_zip", null)
      .in("state", ["California", "Arizona"]);
    
    // Self-chain if more remain
    if (remaining && remaining > 0) {
      fetch(req.url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Enrichment-Key": ENRICHMENT_KEY
        }
      }).catch(() => {});
    }
    
    return new Response(
      JSON.stringify({
        status: "processing",
        batch_size: neighborhoods.length,
        zips_found: updates.length,
        updated: successCount,
        remaining: remaining || 0,
        errors: errors.slice(0, 5)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
