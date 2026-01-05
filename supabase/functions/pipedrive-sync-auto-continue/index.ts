import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYNC_API_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-single-professional`;
const DELAY_BETWEEN_SYNCS_MS = 1000; // 1 second between syncs
const DELAY_AFTER_CREATE_MS = 3000; // Extra delay after new contact creation

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const maxRecords = body.max_records || 100;
    
    console.log("🚀 Pipedrive Auto-Continue Sync Starting...");
    console.log(`   Processing up to ${maxRecords} records, 1/second`);
    
    // Define state priority order
    const statePriority = ["arizona", "california", "new-mexico", "new-jersey"];
    
    const results = {
      state_processed: "",
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
      next_state: null as string | null,
      remaining_by_state: {} as Record<string, number>,
    };
    
    // Check remaining counts by state
    for (const state of statePriority) {
      const { count } = await supabase
        .from("pipedrive_sync_queue")
        .select("id, professionals!inner(state_slug, active)", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("professionals.state_slug", state)
        .eq("professionals.active", true);
      
      results.remaining_by_state[state] = count || 0;
    }
    
    console.log("📊 Queue status by state:", JSON.stringify(results.remaining_by_state));
    
    // Find the current priority state with pending items
    let currentState: string | null = null;
    for (const state of statePriority) {
      if (results.remaining_by_state[state] > 0) {
        currentState = state;
        break;
      }
    }
    
    if (!currentState) {
      console.log("✅ All states complete - nothing to process!");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All states complete - no pending items",
          remaining_by_state: results.remaining_by_state 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    results.state_processed = currentState;
    console.log(`🎯 Processing state: ${currentState} (${results.remaining_by_state[currentState]} pending)`);
    
    // Process items for current state
    while (results.processed < maxRecords) {
      // Get next pending item for this state
      const { data: queueItems, error: fetchError } = await supabase
        .from("pipedrive_sync_queue")
        .select(`
          id, 
          professional_id, 
          attempts, 
          max_attempts,
          professionals!inner(state_slug, active, name)
        `)
        .eq("status", "pending")
        .eq("professionals.state_slug", currentState)
        .eq("professionals.active", true)
        .order("created_at", { ascending: true })
        .limit(1);

      if (fetchError) {
        console.error("❌ Fetch error:", fetchError);
        results.errors.push(`Fetch error: ${fetchError.message}`);
        break;
      }

      if (!queueItems || queueItems.length === 0) {
        console.log(`✅ ${currentState} complete!`);
        
        // Find next state
        const currentIdx = statePriority.indexOf(currentState);
        for (let i = currentIdx + 1; i < statePriority.length; i++) {
          if (results.remaining_by_state[statePriority[i]] > 0) {
            results.next_state = statePriority[i];
            break;
          }
        }
        break;
      }

      const item = queueItems[0];
      const professional = (item as any).professionals;

      // Mark as processing
      await supabase
        .from("pipedrive_sync_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", item.id);

      console.log(`🔄 [${results.processed + 1}/${maxRecords}] Syncing: ${professional.name}`);

      try {
        // Call sync-single-professional
        const syncResponse = await fetch(SYNC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ professional_id: item.professional_id }),
        });

        const syncData = await syncResponse.json();

        if (!syncResponse.ok || syncData.error) {
          throw new Error(syncData.error || `HTTP ${syncResponse.status}`);
        }

        // Mark as completed
        await supabase
          .from("pipedrive_sync_queue")
          .update({ 
            status: "completed", 
            updated_at: new Date().toISOString() 
          })
          .eq("id", item.id);

        results.succeeded++;
        console.log(`✅ Synced: ${professional.name} (${syncData.action || 'synced'})`);

        // Extra delay after CREATE for Pipedrive indexing
        if (syncData.action === "created") {
          console.log(`⏳ Extra ${DELAY_AFTER_CREATE_MS}ms delay for new contact...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_AFTER_CREATE_MS));
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Sync failed for ${professional.name}:`, errorMsg);
        
        const newAttempts = (item.attempts || 0) + 1;
        const shouldRetry = newAttempts < (item.max_attempts || 3);
        
        await supabase
          .from("pipedrive_sync_queue")
          .update({ 
            status: shouldRetry ? "pending" : "failed",
            attempts: newAttempts,
            last_error: errorMsg,
            updated_at: new Date().toISOString() 
          })
          .eq("id", item.id);

        results.failed++;
        results.errors.push(`${professional.name}: ${errorMsg}`);
      }

      results.processed++;

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SYNCS_MS));
    }

    // Get updated remaining counts
    for (const state of statePriority) {
      const { count } = await supabase
        .from("pipedrive_sync_queue")
        .select("id, professionals!inner(state_slug, active)", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("professionals.state_slug", state)
        .eq("professionals.active", true);
      
      results.remaining_by_state[state] = count || 0;
    }

    console.log("\n📊 Final Summary:");
    console.log(`   State: ${results.state_processed}`);
    console.log(`   Processed: ${results.processed}`);
    console.log(`   Succeeded: ${results.succeeded}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Remaining: ${JSON.stringify(results.remaining_by_state)}`);
    console.log(`   Next state: ${results.next_state || 'none'}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
