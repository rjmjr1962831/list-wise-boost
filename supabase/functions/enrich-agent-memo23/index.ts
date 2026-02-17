import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * EMERGENCY SHUTDOWN - Feb 13, 2026
 * This function has been disabled to stop wasteful Apify runs.
 * The original architecture was broken - it timed out before saving data.
 * DO NOT RE-ENABLE without fixing the async architecture.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('⛔ FUNCTION DISABLED - enrich-agent-memo23 has been shut down');
  console.log('⛔ Reason: Synchronous wait for Apify causes 60s timeout, data never saved');
  console.log('⛔ Contact: Robert Maynard');

  return new Response(JSON.stringify({
    error: 'FUNCTION_DISABLED',
    message: 'This enrichment function has been disabled. It was timing out before saving data to the database.',
    timestamp: new Date().toISOString()
  }), {
    status: 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
