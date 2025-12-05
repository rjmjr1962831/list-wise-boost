import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Pipedrive Webhook Handler - 2-Way Sync
 * 
 * Receives webhooks from Pipedrive when person records change.
 * Updates corresponding professional records in Supabase.
 * 
 * Setup in Pipedrive:
 * 1. Settings → Webhooks → Create webhook
 * 2. Event: person.updated, person.deleted, person.merged
 * 3. URL: https://bgdtekbhelormzbymkhh.supabase.co/functions/v1/pipedrive-webhook
 */

interface PipedriveWebhookPayload {
  v?: number;
  meta: {
    action?: string;
    entity?: string;
    object?: string;
    id: number;
    company_id?: number;
    user_id?: number;
    host?: string;
    timestamp?: number;
  };
  data?: any;
  current?: any;
  previous?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Pipedrive sends GET for verification
  if (req.method === "GET") {
    return new Response("Webhook active", { status: 200, headers: corsHeaders });
  }

  try {
    const payload: PipedriveWebhookPayload = await req.json();
    
    const entity = payload.meta?.entity || payload.meta?.object;
    const action = payload.meta?.action;
    const personId = payload.meta?.id || payload.data?.id || payload.current?.id;

    console.log(`📥 Pipedrive webhook: ${action} ${entity} ID:${personId}`);

    // Only handle person events
    if (entity !== "person") {
      console.log(`⏭️ Ignoring non-person event: ${entity}`);
      return new Response(
        JSON.stringify({ success: true, message: "Ignored non-person event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!personId) {
      return new Response(
        JSON.stringify({ success: false, error: "No person ID in payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find professional by sync state (most reliable)
    const { data: syncState } = await supabase
      .from("pipedrive_sync_state")
      .select("professional_id")
      .eq("pipedrive_person_id", personId)
      .single();

    // If not found by sync state, try email lookup
    let professionalId = syncState?.professional_id;
    
    if (!professionalId) {
      const personData = payload.data || payload.current;
      const email = personData?.emails?.[0]?.value || personData?.email?.[0]?.value;
      
      if (email) {
        const { data: profByEmail } = await supabase
          .from("professionals")
          .select("id")
          .eq("email", email)
          .single();
        
        professionalId = profByEmail?.id;
      }
    }

    if (!professionalId) {
      console.log(`⚠️ No professional linked to Pipedrive person ${personId}`);
      return new Response(
        JSON.stringify({ success: true, message: "No linked professional" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different actions
    if (action === "deleted" || action === "delete") {
      console.log(`🗑️ Person ${personId} deleted, clearing sync state`);
      
      await supabase
        .from("pipedrive_sync_state")
        .delete()
        .eq("professional_id", professionalId);

      return new Response(
        JSON.stringify({ success: true, action: "sync_state_cleared" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "merged" || action === "merge") {
      console.log(`🔀 Merge detected for person ${personId}`);
      const survivingId = payload.current?.id || payload.data?.id;
      
      if (survivingId) {
        await supabase
          .from("pipedrive_sync_state")
          .update({
            pipedrive_person_id: survivingId,
            updated_at: new Date().toISOString()
          })
          .eq("professional_id", professionalId);
      }

      return new Response(
        JSON.stringify({ success: true, action: "merge_handled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "updated" || action === "update" || action === "added" || action === "add") {
      const personData = payload.data || payload.current;
      const updates: Record<string, any> = {};
      let hasUpdates = false;

      // Only sync core contact fields from Pipedrive → Supabase
      // (Pipedrive is authoritative for these when edited there)
      
      if (personData?.name) {
        updates.name = personData.name;
        hasUpdates = true;
      }

      // Primary email
      const email = personData?.emails?.[0]?.value || personData?.email?.[0]?.value;
      if (email) {
        updates.email = email;
        hasUpdates = true;
      }

      // Primary phone
      const phone = personData?.phones?.[0]?.value || personData?.phone?.[0]?.value;
      if (phone) {
        updates.phone = phone;
        hasUpdates = true;
      }

      if (hasUpdates) {
        console.log(`📤 Syncing to professional ${professionalId}:`, Object.keys(updates));
        
        // Set skip flag to prevent reverse sync loop
        const { error } = await supabase
          .from("professionals")
          .update({
            ...updates,
            skip_pipedrive_sync: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", professionalId);

        if (error) {
          console.error(`❌ Update failed:`, error);
          throw error;
        }

        // Update sync state hash to prevent immediate re-sync
        await supabase
          .from("pipedrive_sync_state")
          .update({ updated_at: new Date().toISOString() })
          .eq("professional_id", professionalId);

        console.log(`✅ Professional ${professionalId} updated from Pipedrive`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "updated",
            fieldsUpdated: Object.keys(updates)
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: "no_changes" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Handled ${action}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
