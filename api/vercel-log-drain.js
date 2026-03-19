/**
 * Vercel Serverless proxy for the Supabase vercel-log-drain edge function.
 *
 * Vercel log drains require the endpoint to:
 * 1. Return x-vercel-verify header on GET (verification handshake)
 * 2. Accept POST with NDJSON/JSON payload (log data)
 *
 * Supabase edge functions require auth headers, which Vercel's log drain
 * won't send. This proxy adds them.
 *
 * Body parser is DISABLED so we forward the raw payload unchanged --
 * Vercel sends JSON arrays or NDJSON depending on drain config, and
 * re-serializing via JSON.stringify corrupts NDJSON and Buffer payloads.
 */

export const config = {
  api: {
    bodyParser: false,
  },
};

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/vercel-log-drain';

/**
 * Buffer the raw request body from the incoming stream.
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // Verification handshake -- Vercel sends GET with x-vercel-verify expectation
  if (req.method === 'GET') {
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
    // Read raw body bytes -- no parsing, no re-serialization
    const rawBody = await getRawBody(req);

    // Forward original Content-Type so the edge function can parse correctly
    const contentType = req.headers['content-type'] || 'application/json';

    const upstream = await fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        Authorization: `Bearer ${key}`,
        apikey: key,
        'x-vercel-signature': req.headers['x-vercel-signature'] || '',
      },
      body: rawBody,
    });

    const result = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(result);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
