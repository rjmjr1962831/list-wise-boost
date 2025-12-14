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
 * SYNC STRATEGY:
 * - Initial creation: Supabase is source of truth
 * - After sync: Pipedrive edits become source of truth
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

/**
 * REVIEW-REQUIRED FIELDS (Pipedrive is source of truth)
 * 
 * These fields can ONLY be synced FROM Pipedrive → Supabase.
 * They require admin review before changes are applied.
 * 
 * Agent-editable fields (Supabase is source of truth) are NOT in this list:
 * - image_url, sidebar_video_url, description, specialty
 * - notable_achievements, press_mentions, company
 * - phone, email, website (contact info agents can update)
 * - social_facebook, social_twitter, social_instagram, social_tiktok, social_linkedin
 */
const REVIEW_REQUIRED_FIELDS = [
  // Identity (verified)
  'name',
  
  // Metrics (third-party verified)
  'review_stars_rating',
  'num_total_reviews',
  'years_experience',
  'total_sales',
  'current_listings',
  
  // License info (verified via ADRE)
  'license_number',
  'license_type',
  'license_status',
  'license_issued_at',
  'license_expires_at',
  
  // AI-generated content (admin-reviewed)
  'synthesized_bio',
  
  // Rankings and status (admin-controlled)
  'rank',
  'is_top_agent',
  'is_premier_agent',
  'is_brand_builder',
  
  // Zillow metrics (scraped, verified)
  'zillow_profile_url',
  'zillow_rating',
  'zillow_reviews',
  'zillow_page',
  'zillow_position',
  'zillow_total_agents',
  'agents_ahead',
];

// Fetch field mappings from database (pipedrive_key -> field_name)
async function getFieldMappings(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("pipedrive_field_mapping")
    .select("field_name, pipedrive_key");
  
  if (error || !data) {
    console.error("Failed to fetch field mappings:", error);
    return {};
  }
  
  // Create reverse mapping: pipedrive_key -> field_name
  const mapping: Record<string, string> = {};
  for (const row of data) {
    mapping[row.pipedrive_key] = row.field_name;
  }
  return mapping;
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
      const fieldsUpdated: string[] = [];

      // Get field mappings from database
      const fieldMappings = await getFieldMappings();
      
      // Sync core contact fields
      if (personData?.name) {
        updates.name = personData.name;
        fieldsUpdated.push('name');
      }

      // Primary email
      const email = personData?.emails?.[0]?.value || personData?.email?.[0]?.value;
      if (email) {
        updates.email = email;
        fieldsUpdated.push('email');
      }

      // Primary phone
      const phone = personData?.phones?.[0]?.value || personData?.phone?.[0]?.value;
      if (phone) {
        updates.phone = phone;
        fieldsUpdated.push('phone');
      }

      // Sync custom fields from Pipedrive
      // In REST API v2, custom fields are under personData.custom_fields
      // In webhooks, custom field keys may be flattened on the person object
      const rawCustomFieldsSource =
        personData && typeof personData.custom_fields === "object" && personData.custom_fields !== null
          ? personData.custom_fields
          : personData || {};
      const customFields = rawCustomFieldsSource as Record<string, unknown>;

      for (const [pipedriveKey, fieldName] of Object.entries(fieldMappings)) {
        // Skip fields we already handled or that are agent-editable (not synced from Pipedrive)
        // Agent-editable fields: email, phone, website, specialty, business_name, company, social links, etc.
        if (['supabase_id', 'card_url', 'profile_link', 'city_name', 'state', 'email_verified'].includes(fieldName)) {
          continue;
        }
        
        // Only sync REVIEW-REQUIRED fields from Pipedrive
        // These are fields where Pipedrive is the source of truth
        if (!REVIEW_REQUIRED_FIELDS.includes(fieldName)) {
          continue;
        }

        // Look for the custom field value in the custom_fields object
        const value = customFields[pipedriveKey];
        
        if (value !== undefined && value !== null) {
          // Handle different field types
          if (fieldName === 'specialty') {
            // Specialty is stored as array in Supabase
            if (typeof value === 'string' && value.trim()) {
              updates.specialty = value.split(',').map((s: string) => s.trim()).filter(Boolean);
              fieldsUpdated.push('specialty');
            }
          } else if (['years_experience', 'total_sales', 'current_listings', 'rank', 'zillow_reviews', 'zillow_page', 'zillow_position', 'zillow_total_agents', 'agents_ahead'].includes(fieldName)) {
            // Numeric fields
            const numValue = parseInt(String(value), 10);
            if (!isNaN(numValue)) {
              updates[fieldName] = numValue;
              fieldsUpdated.push(fieldName);
            }
          } else if (['zillow_rating'].includes(fieldName)) {
            // Decimal fields
            const floatValue = parseFloat(String(value));
            if (!isNaN(floatValue)) {
              updates[fieldName] = floatValue;
              fieldsUpdated.push(fieldName);
            }
          } else if (['is_top_agent', 'is_premier_agent', 'is_brand_builder'].includes(fieldName)) {
            // Boolean fields - Pipedrive stores these as option IDs or strings
            // Skip these as they're complex to parse from Pipedrive
            continue;
          } else if (typeof value === 'string' && value.trim()) {
            // String fields (including synthesized_bio, website, etc.)
            updates[fieldName] = value.trim();
            fieldsUpdated.push(fieldName);
          }
        }
      }

      if (fieldsUpdated.length > 0) {
        console.log(`📤 Syncing ${fieldsUpdated.length} fields to professional ${professionalId}:`, fieldsUpdated);
        
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

        console.log(`✅ Professional ${professionalId} updated from Pipedrive with fields:`, fieldsUpdated);

        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "updated",
            fieldsUpdated
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
