/**
 * Setup Agent Notifications Queue via Cloudflare REST API
 * No wrangler required. Uses CLOUDFLARE_ACCOUNT_ID + CURSOR_API_KEY (same as update-cloudflare-worker).
 *
 * Invoke: POST https://...supabase.co/functions/v1/setup-agent-notifications-queue
 * Body: {} (optional)
 *
 * Steps:
 * 1. Create queue agent-notifications-queue
 * 2. Deploy consumer worker agent-notifier-consumer
 * 3. Attach consumer to queue (max_batch_size: 10, max_batch_timeout: 30s)
 *
 * After setup: Add NOTIFICATION_QUEUE binding to top10-renderer in Cloudflare Dashboard.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONSUMER_SCRIPT = `const DEFAULT_NOTIFY_URL='https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/log-bot-visit';export default{async queue(batch,env,ctx){const u=env.NOTIFICATION_ENDPOINT||DEFAULT_NOTIFY_URL;for(const m of batch.messages){try{const b=m.body,url=b.request_url||'',path=url?new URL(url).pathname:null;const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json',...(env.NOTIFICATION_AUTH_TOKEN&&{'Authorization':'Bearer '+env.NOTIFICATION_AUTH_TOKEN})},body:JSON.stringify({url:url||path,path,bot_type:b.bot_name,timestamp:b.timestamp,user_agent:b.user_agent||null,method:'GET'})});r.ok?m.ack():m.retry()}catch(e){m.retry()}}}}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const API_TOKEN = Deno.env.get("CURSOR_API_KEY"); // Cloudflare API token

    if (!ACCOUNT_ID || !API_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing CLOUDFLARE_ACCOUNT_ID or CURSOR_API_KEY in Supabase secrets",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const auth = { Authorization: `Bearer ${API_TOKEN}` };
    const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;
    const steps: string[] = [];

    // 1. Create queue
    let queueId: string | undefined;
    const createRes = await fetch(`${base}/queues`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ queue_name: "agent-notifications-queue" }),
    });
    const createData = await createRes.json();
    if (createRes.ok && createData.result?.queue_id) {
      queueId = createData.result.queue_id;
    } else {
      const listRes = await fetch(`${base}/queues`, { headers: auth });
      const listData = await listRes.json();
      const queues = Array.isArray(listData.result) ? listData.result : [];
      const q = queues.find((x: { queue_name: string }) => x.queue_name === "agent-notifications-queue");
      if (!q?.queue_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Create queue failed and queue not found",
            details: createData,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: createRes.ok ? 500 : createRes.status }
        );
      }
      queueId = q.queue_id;
    }
    steps.push("Queue created/found");

    // 2. Deploy consumer worker (multipart with main_module for ES module)
    const metadata = JSON.stringify({
      main_module: "worker.js",
      compatibility_date: "2024-01-01",
    });
    const form = new FormData();
    form.append("metadata", new Blob([metadata], { type: "application/json" }));
    form.append("worker.js", new Blob([CONSUMER_SCRIPT], { type: "application/javascript+module" }), "worker.js");
    const deployRes = await fetch(`${base}/workers/scripts/agent-notifier-consumer`, {
      method: "PUT",
      headers: auth,
      body: form,
    });
    if (!deployRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Deploy consumer worker failed",
          details: await deployRes.text(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: deployRes.status }
      );
    }
    steps.push("Consumer worker deployed");

    // 3. Create queue consumer
    const consumerRes = await fetch(`${base}/queues/${queueId}/consumers`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "worker",
        script: "agent-notifier-consumer",
        settings: { batch_size: 10, max_wait_time_ms: 30000 },
      }),
    });
    if (consumerRes.ok) {
      steps.push("Queue consumer attached");
    } else {
      steps.push("Consumer may already exist (or check API error)");
    }

    // 4. Set NOTIFICATION_AUTH_TOKEN so consumer can call log-bot-visit
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (anonKey) {
      const secretRes = await fetch(`${base}/workers/scripts/agent-notifier-consumer/secrets`, {
        method: "PUT",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "NOTIFICATION_AUTH_TOKEN", text: anonKey, type: "secret_text" }),
      });
      if (secretRes.ok) {
        steps.push("NOTIFICATION_AUTH_TOKEN secret set");
      } else {
        steps.push("NOTIFICATION_AUTH_TOKEN secret failed (add manually in Dashboard)");
      }
    } else {
      steps.push("SUPABASE_ANON_KEY not set - add NOTIFICATION_AUTH_TOKEN manually in Cloudflare Dashboard");
    }

    return new Response(
      JSON.stringify({
        success: true,
        steps,
        queue_id: queueId,
        next_step: "Add NOTIFICATION_QUEUE binding to top10-renderer in Cloudflare Dashboard: Workers → top10-renderer → Settings → Bindings → Add Queue Producer (agent-notifications-queue → NOTIFICATION_QUEUE)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("setup-agent-notifications-queue:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
