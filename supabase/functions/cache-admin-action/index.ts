import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  console.log(`🔧 Cache admin action requested: ${action}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let result: any;
    let message: string;

    switch (action) {
      case 'start-cron':
        const { error: startError } = await supabase.rpc('start_warm_cache_cron');
        if (startError) throw startError;
        message = '✅ Warm cache cron STARTED (runs every 10 minutes)';
        result = { success: true, action: 'start-cron' };
        break;

      case 'stop-cron':
        const { error: stopError } = await supabase.rpc('stop_warm_cache_cron');
        if (stopError) throw stopError;
        message = '⏹️ Warm cache cron STOPPED';
        result = { success: true, action: 'stop-cron' };
        break;

      case 'check-cron':
        const { data: cronData, error: checkError } = await supabase.rpc('check_warm_cache_cron');
        if (checkError) throw checkError;
        message = cronData?.running 
          ? `✅ Cron is RUNNING (schedule: ${cronData.schedule})`
          : '⏹️ Cron is NOT running';
        result = { success: true, action: 'check-cron', status: cronData };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: start-cron, stop-cron, check-cron' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`✅ Action completed: ${message}`);

    // Return HTML page for easy viewing from email click
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Cache Admin Action</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
    .success { color: #059669; background: #d1fae5; padding: 20px; border-radius: 8px; }
    .actions { margin-top: 30px; }
    .btn { display: inline-block; padding: 12px 24px; margin: 8px; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .btn-blue { background: #3b82f6; color: white; }
    .btn-green { background: #10b981; color: white; }
    .btn-red { background: #ef4444; color: white; }
    .btn-gray { background: #6b7280; color: white; }
  </style>
</head>
<body>
  <h1>🔧 Cache Admin Action</h1>
  <div class="success">
    <h2>${message}</h2>
    <pre>${JSON.stringify(result, null, 2)}</pre>
  </div>
  <div class="actions">
    <h3>Quick Actions:</h3>
    <a href="${SUPABASE_URL}/functions/v1/warm-cache" class="btn btn-blue">🔄 Run Warm Cache</a>
    <a href="${SUPABASE_URL}/functions/v1/check-cache-health" class="btn btn-gray">🏥 Run Health Check</a>
    <a href="${SUPABASE_URL}/functions/v1/cache-admin-action?action=start-cron" class="btn btn-green">▶️ Start Cron</a>
    <a href="${SUPABASE_URL}/functions/v1/cache-admin-action?action=stop-cron" class="btn btn-red">⏹️ Stop Cron</a>
    <a href="${SUPABASE_URL}/functions/v1/cache-admin-action?action=check-cron" class="btn btn-gray">📊 Check Cron Status</a>
  </div>
</body>
</html>
    `;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  } catch (error: any) {
    console.error(`❌ Action failed:`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
