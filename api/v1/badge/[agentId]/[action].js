/**
 * Badge verify/image proxy - fetches from Supabase with auth.
 * GET /api/v1/badge/:agentId/verify  -> artifact-verify
 * GET /api/v1/badge/:agentId/image   -> badge-image
 */
const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1';

const FN_MAP = { verify: 'artifact-verify', image: 'badge-image' };

function getKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const key = getKey();
  if (!key) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: 'config_error', message: 'Missing Supabase key in Vercel env' });
    return;
  }

  const agentId = req.query.agentId;
  const action = req.query.action;
  const fn = FN_MAP[action];
  if (!agentId || !fn) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const url = `${SUPABASE_URL}/${fn}/${agentId}`;
  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    const text = await upstream.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', upstream.headers.get('cache-control') || 'public, max-age=300');
    if (upstream.status >= 300 && upstream.status < 400 && upstream.headers.get('location')) {
      res.redirect(upstream.status, upstream.headers.get('location'));
      return;
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.status(upstream.status).send(text);
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
