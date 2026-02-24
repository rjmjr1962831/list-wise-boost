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

  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseKey) {
    res.status(500).json({ error: 'Missing Supabase key (SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY)' });
    return;
  }

  try {
    const token = req.query.token || '';
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    let url = `${SUPABASE_URL}/${fn}?path=${encodeURIComponent(path)}${tokenParam}`;
    // Forward preview_tier (e.g. ?preview_tier=underwritten) for artifact-markdown
    if (req.query.preview_tier) {
      url += `&preview_tier=${encodeURIComponent(req.query.preview_tier)}`;
    }
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${supabaseKey}` },
    });
    const html = await upstream.text();

    // Pass through useful custom headers from the edge function
    const passHeaders = ['x-agents-count', 'x-cities-count', 'x-page-type', 'x-agent-name', 'x-agent-tier'];
    for (const h of passHeaders) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=86400');
    res.status(upstream.status).send(html);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
