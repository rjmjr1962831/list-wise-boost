/**
 * DEPRECATED 2026-03-23: Vercel log drain replaced by inline logging in
 * api/serve-clean-html.js. The drain was unreliable (auto-disabled every 8 hours).
 * Bot crawl logging now happens at the proxy level in serve-clean-html.js.
 *
 * Original description:
 * Vercel Edge Function proxy for the Supabase vercel-log-drain edge function.
 *
 * Uses Edge Runtime so context.waitUntil() is available. The response is
 * returned to Vercel immediately (always 200), and the Supabase forwarding
 * runs in the background. This means Vercel's drain health monitor never
 * sees an error regardless of what happens downstream.
 *
 * Previous Node.js serverless version blocked on the Supabase round-trip,
 * so any Supabase slowness/error surfaced as a drain error → Vercel auto-pause.
 */

export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/vercel-log-drain';

async function forwardToSupabase(body, contentType, key) {
  try {
    await fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Authorization': `Bearer ${key}`,
        'apikey': key,
      },
      body,
    });
  } catch (e) {
    console.error('[drain-proxy] forward failed:', e.message);
  }
}

export default async function handler(request, context) {
  // Verification handshake -- Vercel sends GET with x-vercel-verify expectation
  if (request.method === 'GET') {
    const verifyToken = process.env.VERCEL_LOG_DRAIN_VERIFY || '';
    return new Response(verifyToken, {
      status: 200,
      headers: {
        'x-vercel-verify': verifyToken,
        'Content-Type': 'text/plain',
      },
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim();

  if (!key) {
    // Always 200 so Vercel doesn't count this as a drain error
    return new Response(JSON.stringify({ ok: true, skipped: 'no key' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.text();
  const contentType = request.headers.get('content-type') || 'application/json';

  // Return 200 to Vercel immediately. Process Supabase forwarding in background.
  context.waitUntil(forwardToSupabase(body, contentType, key));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
