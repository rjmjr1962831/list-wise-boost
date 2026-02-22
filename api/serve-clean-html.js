/**
 * Vercel Serverless Proxy for Supabase Clean-Room HTML.
 *
 * Supabase gateway forces content-type: text/plain on edge function
 * HTML responses as a security measure. This proxy fetches the HTML
 * and re-serves it with correct content-type: text/html headers.
 *
 * Used by vercel.json rewrites for state, city, neighborhood, and agent profile clean-room pages.
 */

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1';

export default async function handler(req, res) {
  const { fn, path } = req.query;

  if (!fn || !path) {
    res.status(400).json({ error: 'Missing fn or path parameter' });
    return;
  }

  // Only allow known function names
  const allowed = ['serve-bot-state-html', 'serve-bot-list-html', 'serve-bot-agent-html', 'artifact-markdown'];
  if (!allowed.includes(fn)) {
    res.status(403).json({ error: 'Unknown function' });
    return;
  }

  try {
    const token = req.query.token || '';
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    const url = `${SUPABASE_URL}/${fn}?path=${encodeURIComponent(path)}${tokenParam}`;
    const upstream = await fetch(url);
    const html = await upstream.text();

    // Pass through useful custom headers from the edge function
    const passHeaders = ['x-agents-count', 'x-cities-count', 'x-page-type', 'x-agent-name', 'x-agent-tier'];
    for (const h of passHeaders) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Browser/Cloudflare: cache 5 min, serve stale up to 1hr while revalidating
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    // Vercel CDN: no caching so tier changes propagate in real time
    res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=0');
    res.status(upstream.status).send(html);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
