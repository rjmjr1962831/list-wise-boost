/**
 * vercel-log-drain -- DEPRECATED 2026-03-24.
 *
 * Bot crawl logging is now handled exclusively by logBotVisit() inside
 * each serve-bot-* edge function. The log drain caused duplicate rows,
 * bot-name casing mismatches, and missing agent_ids. Disabled permanently.
 *
 * Returns 410 Gone so Vercel stops retrying.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vercel-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // Still respond to Vercel verification probes so the integration doesn't break
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("VERCEL_LOG_DRAIN_VERIFY") || "";
    return new Response(verifyToken, {
      headers: {
        ...CORS,
        "Content-Type": "text/plain",
        "x-vercel-verify": verifyToken,
      },
    });
  }

  // Drain body to avoid Vercel connection errors, but don't process it
  try { await req.text(); } catch (_) {}

  return new Response(
    JSON.stringify({ ok: true, deprecated: true, message: "Log drain disabled. Bot logging via logBotVisit() in edge functions." }),
    { status: 410, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
