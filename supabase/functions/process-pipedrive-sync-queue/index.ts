import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "robert@top10lists.us";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper to safely extract error message
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function sendFailureAlert(
  professionalName: string,
  professionalId: string,
  errorMessage: string,
  attempts: number
) {
  try {
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/Phoenix',
      dateStyle: 'full',
      timeStyle: 'long'
    });

    const projectId = SUPABASE_URL.split('//')[1].split('.')[0];

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: SMTP_USERNAME!,
          password: SMTP_PASSWORD!,
        },
      },
    });

    await client.send({
      from: SMTP_FROM_EMAIL!,
      to: ADMIN_EMAIL,
      subject: "URGENT: Pipedrive Sync Failure - Action Required",
      content: "auto",
      html: `<pre style="font-family: monospace; white-space: pre-wrap;">
PIPEDRIVE SYNC FAILURE ALERT

A professional record has permanently failed to sync to Pipedrive after ${attempts} attempts.

FAILURE DETAILS:
- Professional: ${professionalName}
- Professional ID: ${professionalId}
- Time: ${timestamp}
- Error Type: Max retry attempts exceeded

ERROR MESSAGE:
${errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}

RECOMMENDED RESOLUTION:
1. Verify Professional Data: Check that the professional has a valid email address
2. Check Pipedrive Connection: Verify API credentials are valid
3. Review Field Mappings: Ensure custom field mappings are correct
4. Manual Retry: After fixing, retry from Admin Dashboard

--
Automated alert from Top10Lists Sync Queue
</pre>`,
    });

    await client.close();
    console.log(`📧 Failure alert email sent for ${professionalName}`);
  } catch (emailError) {
    console.error("❌ Failed to send alert email:", emailError);
    // Don't throw - we don't want email failures to stop processing
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse options from request body
    const body = await req.json().catch(() => ({}));
    const stateFilter = body.state || null; // Filter by state (e.g., "arizona")
    const delayMs = body.delay_ms || 1000; // Default 1 second between syncs
    const maxRecords = body.max_records || 50; // Max records per run
    
    console.log(`🔄 Starting Pipedrive sync queue processing...`);
    console.log(`   State filter: ${stateFilter || 'all'}, Delay: ${delayMs}ms, Max: ${maxRecords}`);

    // IMPORTANT: Process ONE at a time to prevent race conditions creating duplicates
    const MAX_RECORDS_PER_RUN = maxRecords;
    const BATCH_SIZE = 1;
    const DELAY_BETWEEN_SYNCS_MS = delayMs; // Configurable delay between syncs
    const DELAY_AFTER_CREATE_MS = 3000; // Wait 3s after creates for Pipedrive search index
    const STALE_PROCESSING_MINUTES = 10; // Reset items stuck in "processing" for more than 10 minutes
    
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ professional_id: string; error: string }>,
    };

    // First: Reset any stale "processing" items back to "pending"
    const staleThreshold = new Date();
    staleThreshold.setMinutes(staleThreshold.getMinutes() - STALE_PROCESSING_MINUTES);
    
    const { data: staleItems, error: staleError } = await supabase
      .from("pipedrive_sync_queue")
      .update({ status: "pending" })
      .eq("status", "processing")
      .lt("updated_at", staleThreshold.toISOString())
      .select("id");
    
    if (!staleError && staleItems && staleItems.length > 0) {
      console.log(`♻️ Reset ${staleItems.length} stale "processing" items back to "pending"`);
    }

    // Process in batches until queue is empty or max records reached
    while (results.processed < MAX_RECORDS_PER_RUN) {
      // Fetch next batch of pending items, optionally filtered by state
      let query = supabase
        .from("pipedrive_sync_queue")
        .select(`
          id, 
          professional_id, 
          attempts, 
          max_attempts, 
          last_error,
          professionals!inner(state_slug, active)
        `)
        .eq("status", "pending")
        .eq("professionals.active", true); // Only sync active agents
      
      // Apply state filter if specified
      if (stateFilter) {
        query = query.eq("professionals.state_slug", stateFilter.toLowerCase());
      }
      
      const { data: queueItems, error: fetchError } = await query
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (fetchError) {
        console.error("❌ Error fetching queue items:", fetchError);
        throw fetchError;
      }

      const queueItemsData = queueItems ?? [];
      if (queueItemsData.length === 0) {
        console.log(`✅ No more items in queue to process (processed ${results.processed} total)`);
        break;
      }

      console.log(`📋 Found ${queueItemsData.length} items in batch (${results.processed}/${MAX_RECORDS_PER_RUN} total processed so far)`);

      // Process each item in this batch
      for (const item of queueItemsData) {
        if (results.processed >= MAX_RECORDS_PER_RUN) {
          console.log(`⚠️ Reached max records limit (${MAX_RECORDS_PER_RUN}), stopping`);
          break;
        }
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

        // Rate limiting delay between all syncs
        console.log(`⏳ Waiting ${DELAY_BETWEEN_SYNCS_MS}ms before next sync...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SYNCS_MS));

        // Extra delay after CREATE to let Pipedrive index the new contact
        if (syncResult?.action === 'created') {
          console.log(`⏳ Additional ${DELAY_AFTER_CREATE_MS}ms wait for Pipedrive index after CREATE...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_AFTER_CREATE_MS));
        }

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

            // Fetch professional name for alert email
            const { data: professional } = await supabase
              .from("professionals")
              .select("name")
              .eq("id", item.professional_id)
              .single();

            // Send failure alert email
            await sendFailureAlert(
              professional?.name || "Unknown Professional",
              item.professional_id,
              errorMessage,
              newAttempts
            );
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
      } catch (err) {
        console.error(`❌ Error processing queue item ${item.id}:`, err);
        results.failed++;
        const errorMessage = getErrorMessage(err);
        results.errors.push({
          professional_id: item.professional_id,
          error: errorMessage,
        });

        // Mark as failed with retry
        const newAttempts = item.attempts + 1;
        const shouldRetry = newAttempts < item.max_attempts;

        if (shouldRetry) {
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
        } else {
          // Max retries reached
          await supabase
            .from("pipedrive_sync_queue")
            .update({
              status: "failed",
              attempts: newAttempts,
              last_error: `Max retries reached: ${errorMessage}`,
              next_retry_at: null,
            })
            .eq("id", item.id);

          // Fetch professional name and send alert
          const { data: professional } = await supabase
            .from("professionals")
            .select("name")
            .eq("id", item.professional_id)
            .single();

          await sendFailureAlert(
            professional?.name || "Unknown Professional",
            item.professional_id,
            errorMessage,
            newAttempts
          );
        }
        }
      }
      
      // Check if we've hit the limit mid-batch
      if (results.processed >= MAX_RECORDS_PER_RUN) {
        console.log(`⚠️ Reached max records limit (${MAX_RECORDS_PER_RUN}), exiting batch loop`);
        break;
      }
    } // End of while loop

    console.log(
      `✅ Queue processing complete: ${results.processed} processed, ${results.succeeded} succeeded, ${results.failed} failed`
    );

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Fatal error processing queue:", err);
    const errorMessage = getErrorMessage(err);

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
