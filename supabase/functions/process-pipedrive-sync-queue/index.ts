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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
      to: "contentforms@top10lists.us",
      subject: "Sync failure",
      content: "text/html",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            h2 { color: #d32f2f; }
            h3 { color: #1976d2; margin-top: 20px; }
            ul, ol { margin: 10px 0; padding-left: 20px; }
            li { margin: 5px 0; }
            pre { background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; border: 1px solid #ddd; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
            .alert-box { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🚨 Pipedrive Sync Failure Alert</h2>
            
            <div class="alert-box">
              <strong>A professional record has permanently failed to sync to Pipedrive after ${attempts} attempts.</strong>
            </div>
            
            <h3>Failure Details:</h3>
            <ul>
              <li><strong>Professional:</strong> ${professionalName}</li>
              <li><strong>Professional ID:</strong> ${professionalId}</li>
              <li><strong>Time:</strong> ${timestamp}</li>
              <li><strong>Error Type:</strong> Max retry attempts exceeded</li>
            </ul>
            
            <h3>Error Message:</h3>
            <pre>${errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            
            <h3>Recommended Resolution:</h3>
            <ol>
              <li><strong>Verify Professional Data:</strong> Check that the professional has a valid email address and all required fields are populated in the database</li>
              <li><strong>Check Pipedrive Connection:</strong> Verify that Pipedrive API credentials (PIPEDRIVE_API_TOKEN, PIPEDRIVE_DOMAIN) are valid and the service is accessible</li>
              <li><strong>Review Field Mappings:</strong> Ensure all custom field mappings in the pipedrive_field_mapping table are correct and match Pipedrive's field keys</li>
              <li><strong>Check Professional Email:</strong> Confirm the professional has a valid, non-generic email address (Pipedrive sync skips professionals without emails)</li>
              <li><strong>Manual Retry:</strong> After fixing the issue, you can manually retry the sync from the Admin Dashboard → Pipedrive section</li>
              <li><strong>Check Edge Function Logs:</strong> Review detailed error logs at: https://supabase.com/dashboard/project/${projectId}/logs/edge-functions</li>
            </ol>
            
            <h3>Next Steps:</h3>
            <ul>
              <li>Review the professional's data in the database for completeness</li>
              <li>Test the Pipedrive API connection manually if needed</li>
              <li>After fixing, the sync will be retried automatically or can be triggered manually</li>
            </ul>
            
            <div class="footer">
              This is an automated alert from Top10Lists Pipedrive Sync Queue Processor
            </div>
          </div>
        </body>
        </html>
      `,
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
      } catch (error) {
        console.error(`❌ Error processing queue item ${item.id}:`, error);
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
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
