import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPEDRIVE_API_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN")!;
const PIPEDRIVE_DOMAIN = Deno.env.get("PIPEDRIVE_DOMAIN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Normalize state abbreviations to full names
function normalizeState(state: string | null | undefined): string {
  if (!state) return '';
  const stateMap: Record<string, string> = {
    'AZ': 'Arizona',
    'CA': 'California',
    'CO': 'Colorado',
    'FL': 'Florida',
    'NJ': 'New Jersey',
    'NM': 'New Mexico',
    'NV': 'Nevada',
    'NY': 'New York',
    'OH': 'Ohio',
    'TX': 'Texas',
  };
  const upperState = state.trim().toUpperCase();
  return stateMap[upperState] || state;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 100, dryRun = true, offset = 0 } = await req.json();

    console.log(`🔧 Bulk fix Pipedrive fields - limit: ${limit}, offset: ${offset}, dryRun: ${dryRun}`);

    // Get field mapping for state and active_status
    const { data: fieldMappings, error: mappingError } = await supabase
      .from("pipedrive_field_mapping")
      .select("field_name, pipedrive_key")
      .in("field_name", ["state", "active_status"]);

    if (mappingError) throw mappingError;

    const fieldMap: Record<string, string> = {};
    for (const row of fieldMappings || []) {
      fieldMap[row.field_name] = row.pipedrive_key;
    }

    if (!fieldMap.state || !fieldMap.active_status) {
      throw new Error("Missing field mappings for state or active_status");
    }

    console.log(`📋 Field mappings - state: ${fieldMap.state}, active_status: ${fieldMap.active_status}`);

    // Get synced professionals with their Pipedrive person IDs
    const { data: syncedProfessionals, error: fetchError } = await supabase
      .from("pipedrive_sync_state")
      .select(`
        pipedrive_person_id,
        professional_id,
        professionals!inner (
          id,
          name,
          active,
          business_address,
          cities:city_id (state)
        )
      `)
      .not("pipedrive_person_id", "is", null)
      .range(offset, offset + limit - 1);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${syncedProfessionals?.length || 0} synced professionals to process`);

    if (!syncedProfessionals || syncedProfessionals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No more professionals to process",
          processed: 0,
          hasMore: false
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ name: string; personId: number; state: string; activeStatus: string; success: boolean; error?: string }> = [];
    let updated = 0;
    let errors = 0;

    for (const sync of syncedProfessionals) {
      const professional = sync.professionals as any;
      const personId = sync.pipedrive_person_id;

      if (!professional || !personId) {
        console.log(`⏭️ Skipping - missing professional or person ID`);
        continue;
      }

      // Determine correct state value
      const businessAddress = professional.business_address || {};
      const city = Array.isArray(professional.cities) ? professional.cities[0] : professional.cities;
      const rawState = businessAddress.state || city?.state || '';
      const normalizedState = normalizeState(rawState);

      // Determine correct active status
      const activeStatus = professional.active ? 'Active' : 'Inactive';

      if (dryRun) {
        console.log(`🔍 [DRY RUN] Would update ${professional.name} (ID: ${personId}): state="${normalizedState}", active_status="${activeStatus}"`);
        results.push({
          name: professional.name,
          personId,
          state: normalizedState,
          activeStatus,
          success: true
        });
        updated++;
        continue;
      }

      try {
        // Update Pipedrive person with corrected fields
        const updatePayload = {
          custom_fields: {
            [fieldMap.state]: normalizedState,
            [fieldMap.active_status]: activeStatus
          }
        };

        const response = await fetch(
          `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload)
          }
        );

        const data = await response.json();

        if (data.success) {
          console.log(`✅ Updated ${professional.name} (ID: ${personId}): state="${normalizedState}", active_status="${activeStatus}"`);
          results.push({
            name: professional.name,
            personId,
            state: normalizedState,
            activeStatus,
            success: true
          });
          updated++;
        } else {
          console.error(`❌ Failed to update ${professional.name}:`, data);
          results.push({
            name: professional.name,
            personId,
            state: normalizedState,
            activeStatus,
            success: false,
            error: JSON.stringify(data)
          });
          errors++;
        }

        // Rate limiting - 100ms between API calls
        await delay(100);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Error updating ${professional.name}:`, errorMsg);
        results.push({
          name: professional.name,
          personId,
          state: normalizedState,
          activeStatus,
          success: false,
          error: errorMsg
        });
        errors++;
      }
    }

    const hasMore = syncedProfessionals.length === limit;

    console.log(`📊 Bulk fix complete - updated: ${updated}, errors: ${errors}, hasMore: ${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: syncedProfessionals.length,
        updated,
        errors,
        hasMore,
        nextOffset: offset + limit,
        dryRun,
        results: results.slice(0, 20) // Return first 20 for visibility
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Bulk fix error:", errorMsg);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
