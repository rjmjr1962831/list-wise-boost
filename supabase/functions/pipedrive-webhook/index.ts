import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getFieldMapping(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("pipedrive_field_mapping")
    .select("field_name, pipedrive_key");

  if (error) throw error;

  // Reverse mapping: pipedrive_key -> field_name
  const mapping: Record<string, string> = {};
  for (const row of data || []) {
    mapping[row.pipedrive_key] = row.field_name;
  }
  return mapping;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    console.log("Pipedrive webhook received:", JSON.stringify(payload, null, 2));

    const { meta, data, previous } = payload;

    // Only process person updates
    if (meta?.entity !== "person") {
      return new Response(
        JSON.stringify({ success: true, message: "Ignored non-person event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const personId = data?.id;
    if (!personId) {
      return new Response(
        JSON.stringify({ success: false, error: "No person ID in payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = data?.emails?.[0]?.value || data?.email?.[0]?.value;
    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "No email in payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get field mapping
    const fieldMapping = await getFieldMapping();

    // Try to find professional by email first
    const { data: professional, error: profError } = await supabase
      .from("professionals")
      .select("id")
      .eq("email", email)
      .single();

    if (professional && !profError) {
      console.log("Updating professional from Pipedrive webhook");
      
      // Build update object for professional
      const profUpdates: Record<string, any> = {
        skip_pipedrive_sync: true, // Prevent sync loop
      };

      // Map basic fields
      if (data?.name) profUpdates.name = data.name;
      if (data?.phones?.[0]?.value) profUpdates.phone = data.phones[0].value;
      else if (data?.phone?.[0]?.value) profUpdates.phone = data.phone[0].value;

      // Map custom fields back to professional columns
      for (const [pipedriveKey, fieldName] of Object.entries(fieldMapping)) {
        if (data?.[pipedriveKey] !== undefined) {
          if (["current_listings", "total_sales", "license_number", "rank", 
               "synthesized_bio", "is_top_agent", "is_premier_agent"].includes(fieldName)) {
            profUpdates[fieldName] = data[pipedriveKey];
          }
        }
      }

      // Update professional in Supabase
      const { error: updateError } = await supabase
        .from("professionals")
        .update(profUpdates)
        .eq("id", professional.id);

      if (updateError) throw updateError;

      console.log(`✅ Professional ${professional.id} updated from Pipedrive:`, profUpdates);

      return new Response(
        JSON.stringify({ success: true, message: "Professional updated from Pipedrive", updates: profUpdates }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If not a professional, try prospect
    let { data: prospect, error: findError } = await supabase
      .from("prospects")
      .select("id")
      .eq("pipedrive_person_id", personId)
      .single();

    if (findError || !prospect) {
      // Try to find prospect by email
      const { data: prospectByEmail, error: emailError } = await supabase
        .from("prospects")
        .select("id")
        .eq("email", email)
        .single();

      if (emailError || !prospectByEmail) {
        return new Response(
          JSON.stringify({ success: true, message: "Record not found in Supabase" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      prospect = prospectByEmail;
    }

    // Build update object for prospect
    const updates: Record<string, any> = {
      pipedrive_person_id: personId,
      pipedrive_synced: true,
      pipedrive_synced_at: new Date().toISOString(),
    };

    // Map Pipedrive fields back to Supabase
    if (data?.name) updates.name = data.name;
    if (data?.emails?.[0]?.value) updates.email = data.emails[0].value;
    else if (data?.email?.[0]?.value) updates.email = data.email[0].value;
    if (data?.phones?.[0]?.value) updates.phone = data.phones[0].value;
    else if (data?.phone?.[0]?.value) updates.phone = data.phone[0].value;

    // Map custom fields
    for (const [pipedriveKey, fieldName] of Object.entries(fieldMapping)) {
      if (data?.[pipedriveKey] !== undefined) {
        if (fieldName === "prospect_status") {
          updates.status = data[pipedriveKey];
        } else if (fieldName === "supabase_id") {
          // Don't update supabase_id
        } else {
          updates[fieldName] = data[pipedriveKey];
        }
      }
    }

    // Update prospect in Supabase
    const { error: updateError } = await supabase
      .from("prospects")
      .update(updates)
      .eq("id", prospect.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: "Prospect updated from Pipedrive" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
