import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPEDRIVE_API_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN")!;
const PIPEDRIVE_DOMAIN = Deno.env.get("PIPEDRIVE_DOMAIN") || "top10lists";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Fetch data from Pipedrive and sync to Supabase
 * Used for manual syncing when webhook didn't fire
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professional_id, pipedrive_person_id } = await req.json();

    if (!professional_id && !pipedrive_person_id) {
      return new Response(
        JSON.stringify({ error: "professional_id or pipedrive_person_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let personId = pipedrive_person_id;

    // If we have professional_id, look up the pipedrive person ID
    if (!personId && professional_id) {
      const { data: syncState } = await supabase
        .from("pipedrive_sync_state")
        .select("pipedrive_person_id")
        .eq("professional_id", professional_id)
        .single();
      
      personId = syncState?.pipedrive_person_id;
    }

    if (!personId) {
      return new Response(
        JSON.stringify({ error: "No Pipedrive person ID found for this professional" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch person from Pipedrive
    console.log(`Fetching person ${personId} from Pipedrive...`);
    
    const pipedriveUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`;
    const response = await fetch(pipedriveUrl, {
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Pipedrive API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch from Pipedrive", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pipedriveData = await response.json();
    const personData = pipedriveData.data;

    console.log("Pipedrive person data received:", JSON.stringify(personData, null, 2));

    // Get field mappings
    const { data: mappings } = await supabase
      .from("pipedrive_field_mapping")
      .select("field_name, pipedrive_key");

    const fieldMappings: Record<string, string> = {};
    for (const row of mappings || []) {
      fieldMappings[row.pipedrive_key] = row.field_name;
    }

    // Build updates from Pipedrive data
    const updates: Record<string, any> = {};
    const fieldsFound: string[] = [];

    // Core fields
    if (personData?.name) {
      updates.name = personData.name;
      fieldsFound.push('name');
    }

    const email = personData?.emails?.[0]?.value;
    if (email) {
      updates.email = email;
      fieldsFound.push('email');
    }

    const phone = personData?.phones?.[0]?.value;
    if (phone) {
      updates.phone = phone;
      fieldsFound.push('phone');
    }

    // Custom fields - Pipedrive v2 stores these under custom_fields object
    const customFields = personData?.custom_fields || {};
    
    for (const [pipedriveKey, fieldName] of Object.entries(fieldMappings)) {
      if (['name', 'email', 'phone', 'supabase_id', 'card_url', 'profile_link', 'city_name', 'state', 'email_verified'].includes(fieldName)) {
        continue;
      }

      const value = customFields[pipedriveKey];
      
      if (value !== undefined && value !== null && value !== '') {
        fieldsFound.push(`${fieldName}: ${String(value).substring(0, 100)}...`);
        
        if (fieldName === 'specialty') {
          if (typeof value === 'string' && value.trim()) {
            updates.specialty = value.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } else if (['years_experience', 'total_sales', 'current_listings', 'rank'].includes(fieldName)) {
          const numValue = parseInt(String(value), 10);
          if (!isNaN(numValue)) {
            updates[fieldName] = numValue;
          }
        } else if (['zillow_rating', 'review_stars_rating'].includes(fieldName)) {
          const floatValue = parseFloat(String(value));
          if (!isNaN(floatValue)) {
            // zillow_rating maps to review_stars_rating in database
            updates['review_stars_rating'] = floatValue;
          }
        } else if (typeof value === 'string') {
          updates[fieldName] = value.trim();
        }
      }
    }

    // Apply updates to Supabase
    if (Object.keys(updates).length > 0) {
      const profId = professional_id || (await supabase
        .from("pipedrive_sync_state")
        .select("professional_id")
        .eq("pipedrive_person_id", personId)
        .single()).data?.professional_id;

      if (profId) {
        const { error } = await supabase
          .from("professionals")
          .update({
            ...updates,
            skip_pipedrive_sync: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", profId);

        if (error) {
          console.error("Update error:", error);
          throw error;
        }

        console.log(`Updated professional ${profId} with fields:`, Object.keys(updates));
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        personId,
        fieldsFound,
        updates: Object.keys(updates),
        rawData: personData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
