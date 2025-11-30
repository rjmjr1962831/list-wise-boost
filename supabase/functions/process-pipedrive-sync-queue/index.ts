import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔄 Starting Pipedrive sync queue processing...");

    // Fetch pending or failed items that are ready for retry
    const { data: queueItems, error: fetchError } = await supabase
      .from("pipedrive_sync_queue")
      .select("id, professional_id, attempts, max_attempts, last_error")
      .in("status", ["pending", "failed"])
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order("created_at", { ascending: true })
      .limit(10); // Process 10 at a time to avoid timeouts

    if (fetchError) {
      console.error("❌ Error fetching queue items:", fetchError);
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log("✅ No items in queue to process");
      return new Response(
        JSON.stringify({ success: true, message: "No items to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Found ${queueItems.length} items to process`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ professional_id: string; error: string }>,
    };

    // Process each item
    for (const item of queueItems) {
      try {
        // Mark as processing
        await supabase
          .from("pipedrive_sync_queue")
          .update({ status: "processing" })
          .eq("id", item.id);

        console.log(`🔄 Syncing professional ${item.professional_id}...`);

        // Call the sync function
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          "sync-single-professional",
          {
            body: { professional_id: item.professional_id },
          }
        );

        results.processed++;

        if (syncError || !syncResult?.success) {
          // Sync failed
          const errorMessage = syncError?.message || syncResult?.error || "Unknown error";
          console.error(`❌ Sync failed for ${item.professional_id}:`, errorMessage);

          const newAttempts = item.attempts + 1;
          const shouldRetry = newAttempts < item.max_attempts;

          if (shouldRetry) {
            // Calculate exponential backoff: 2^attempts minutes
            const backoffMinutes = Math.pow(2, newAttempts);
            const nextRetry = new Date();
            nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);

            await supabase
              .from("pipedrive_sync_queue")
              .update({
                status: "failed",
                attempts: newAttempts,
                last_error: errorMessage,
                next_retry_at: nextRetry.toISOString(),
              })
              .eq("id", item.id);

            console.log(`⏳ Will retry in ${backoffMinutes} minutes (attempt ${newAttempts}/${item.max_attempts})`);
          } else {
            // Max retries reached, mark as permanently failed
            await supabase
              .from("pipedrive_sync_queue")
              .update({
                status: "failed",
                attempts: newAttempts,
                last_error: `Max retries reached: ${errorMessage}`,
                next_retry_at: null,
              })
              .eq("id", item.id);

            console.log(`❌ Max retries reached for ${item.professional_id}`);
          }

          results.failed++;
          results.errors.push({
            professional_id: item.professional_id,
            error: errorMessage,
          });
        } else {
          // Sync succeeded
          console.log(`✅ Successfully synced ${item.professional_id}`);

          await supabase
            .from("pipedrive_sync_queue")
            .update({
              status: "completed",
              attempts: item.attempts + 1,
              last_error: null,
            })
            .eq("id", item.id);

          results.succeeded++;
        }
      } catch (error) {
        console.error(`❌ Error processing queue item ${item.id}:`, error);
        results.failed++;
        results.errors.push({
          professional_id: item.professional_id,
          error: error instanceof Error ? error.message : String(error),
        });

        // Mark as failed with retry
        const newAttempts = item.attempts + 1;
        const backoffMinutes = Math.pow(2, newAttempts);
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);

        await supabase
          .from("pipedrive_sync_queue")
          .update({
            status: "failed",
            attempts: newAttempts,
            last_error: error instanceof Error ? error.message : String(error),
            next_retry_at: nextRetry.toISOString(),
          })
          .eq("id", item.id);
      }
    }

    console.log(
      `✅ Queue processing complete: ${results.processed} processed, ${results.succeeded} succeeded, ${results.failed} failed`
    );

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Fatal error processing queue:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
