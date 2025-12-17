import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const pipedriveDomain = Deno.env.get("PIPEDRIVE_DOMAIN");

    if (!pipedriveToken || !pipedriveDomain) {
      throw new Error("Pipedrive credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { label = "lead", dry_run = false } = await req.json();

    console.log(`🚀 Bulk updating Pipedrive persons to label: "${label}" (dry_run: ${dry_run})`);

    // Get all active professionals with Pipedrive person IDs
    const { data: syncStates, error: fetchError } = await supabase
      .from("pipedrive_sync_state")
      .select(`
        pipedrive_person_id,
        professional_id,
        professionals!inner (
          id,
          name,
          active
        )
      `)
      .not("pipedrive_person_id", "is", null);

    if (fetchError) throw fetchError;

    // Filter to only active professionals
    const activeRecords = (syncStates || []).filter(
      (s: any) => s.professionals?.active === true
    );

    console.log(`📊 Found ${activeRecords.length} active professionals with Pipedrive IDs`);

    if (dry_run) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          message: `Would update ${activeRecords.length} Pipedrive persons to "${label}"`,
          count: activeRecords.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      total: activeRecords.length,
      successful: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Process in batches
    for (let i = 0; i < activeRecords.length; i += BATCH_SIZE) {
      const batch = activeRecords.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(activeRecords.length / BATCH_SIZE)}`);

      // Process each person in the batch
      for (const record of batch) {
        const personId = record.pipedrive_person_id;
        const professionalName = (record as any).professionals?.name || "Unknown";

        try {
          // Update the person's label in Pipedrive
          const response = await fetch(
            `https://${pipedriveDomain}.pipedrive.com/api/v2/persons/${personId}?api_token=${pipedriveToken}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ label }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pipedrive API error: ${response.status} - ${errorText}`);
          }

          results.successful++;
          console.log(`✅ Updated ${professionalName} (${personId}) to "${label}"`);
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            pipedrive_person_id: personId,
            name: professionalName,
            error: error.message,
          });
          console.error(`❌ Failed to update ${professionalName}:`, error.message);
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Complete: ${results.successful} successful, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${results.successful} persons to "${label}"`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Error in bulk update:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
