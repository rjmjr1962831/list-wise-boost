/**
 * Vercel Serverless proxy for the Supabase vercel-log-drain edge function.
 *
 * Vercel log drains require the endpoint to:
 * 1. Return x-vercel-verify header on GET (verification handshake)
 * 2. Accept POST with NDJSON/JSON payload (log data)
 *
 * Supabase edge functions require auth headers, which Vercel's log drain
 * won't send. This proxy adds them.
 */

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/vercel-log-drain';

export default async function handler(req, res) {
  // Verification handshake -- Vercel sends GET with x-vercel-verify expectation
  if (req.method === 'GET') {
    // Echo back whatever verify token Vercel expects
    // Vercel checks for this header in the response
    const verifyToken = process.env.VERCEL_LOG_DRAIN_VERIFY || '';
    res.setHeader('x-vercel-verify', verifyToken);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Forward POST to Supabase edge function
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const key = supabaseKey ? String(supabaseKey).trim() : '';

  if (!key) {
    res.status(500).json({ error: 'Missing Supabase key' });
    return;
  }

  try {
    // req.body is already parsed by Vercel; re-serialize for upstream
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const upstream = await fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
        // Forward the signature so the edge function can verify
        'x-vercel-signature': req.headers['x-vercel-signature'] || '',
      },
      body,
    });

    const result = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(result);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
