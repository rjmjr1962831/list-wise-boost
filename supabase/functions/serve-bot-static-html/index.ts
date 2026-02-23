/**
 * serve-bot-static-html
 * Returns FULL PAGE HTML for static pages (Home, About, Arizona, etc.) so bots get rendered content.
 * Uses Cloudflare Browser Rendering REST API (replaces deprecated Prerender.io).
 * Called by Cloudflare Worker (top10-renderer) on bot cache MISS for static paths.
 *
 * GET ?path=/ or ?path=/about or ?path=/arizona
 * Returns: text/html with full page content.
 *
 * Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (with Browser Rendering - Edit permission)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BASE_URL = "https://www.top10lists.us";
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") ?? Deno.env.get("CURSOR_API_KEY");

const STATIC_PATHS = new Set([
  "/",
  "/arizona",
  "/california",
  "/about",
  "/about/founder",
  "/about/ranking-methodology",
  "/for-ai",
  "/for-ai-systems",
  "/transparency",
  "/ai-liability",
  "/ai-citation-whitepaper",
  "/protocol-services",
  "/press",
  "/editorial-updates",
  "/compare",
  "/zillow-explained",
  "/faq",
  "/privacy",
  "/terms",
  "/sms-terms",
  "/opt-in",
  "/test",
  "/are-you-an-agent",
  "/agent-onboarding",
]);

function isStaticPath(path: string): boolean {
  const normalized = path.replace(/\/+$/, "") || "/";
  return STATIC_PATHS.has(normalized);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = (url.searchParams.get("path") ?? url.pathname).replace(/^\/+/, "") || "/";
  const fullPath = path.startsWith("/") ? path : `/${path}`;

  if (!isStaticPath(fullPath)) {
    return new Response(
      JSON.stringify({ error: "Path not in static pages", path: fullPath }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    return new Response(
      JSON.stringify({ error: "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const targetUrl = `${BASE_URL}${fullPath}`;
  const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/content`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        gotoOptions: { waitUntil: "networkidle0", timeout: 30000 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const raw = await response.text();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Cloudflare Browser Rendering failed: ${response.status}`, body: raw.slice(0, 500) }),
        { status: response.status >= 500 ? 502 : response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let html: string;
    try {
      const json = JSON.parse(raw);
      html = typeof json?.result === "string" ? json.result : json?.result?.content ?? json?.content ?? "";
    } catch {
      html = raw;
    }

    if (!html || typeof html !== "string" || html.length < 500) {
      return new Response(
        JSON.stringify({ error: "Cloudflare Browser Rendering returned empty or truncated HTML" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
        "X-Rendered": "cloudflare-browser-rendering",
        ...corsHeaders,
      },
    });
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "Cloudflare Browser Rendering fetch failed", detail: msg }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
