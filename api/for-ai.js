/**
 * Dedicated handler for /for-ai to avoid Vercel rewrite query-param issues.
 * Proxies to serve-bot-content-html with path=/for-ai hardcoded.
 */
const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1';

export default async function handler(req, res) {
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = supabaseKey ? String(supabaseKey).trim() : '';
  if (!key) {
    res.status(500).json({ error: 'Missing Supabase key' });
    return;
  }
  try {
    const url = `${SUPABASE_URL}/serve-bot-content-html?path=${encodeURIComponent('/for-ai')}`;
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    const html = await upstream.text();
    if (upstream.status === 401) {
      res.status(401).setHeader('Content-Type', 'application/json').json({ error: 'Upstream 401' });
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=0');
    res.status(upstream.status).send(html);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
