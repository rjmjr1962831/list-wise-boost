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

const CONTENT_PATHS = ['/for-ai', '/transparency', '/faq'];

export default async function handler(req, res) {
  let { fn, path } = req.query;
  // Reject malformed path (e.g. "undefined" or "undefinedfor-ai" from bad rewrite param interpolation)
  if (path && (path.includes('undefined') || path === 'undefined')) path = null;
  // Fallback: parse from req.url when query params missing or malformed
  if ((!fn || !path) && req.url) {
    try {
      const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      fn = fn || u.searchParams.get('fn');
      path = path || u.searchParams.get('path');
      // When rewrite forwards original path, pathname may be the content path (e.g. /for-ai)
      if (!path && u.pathname && CONTENT_PATHS.includes(u.pathname)) {
        path = u.pathname;
        fn = fn || 'serve-bot-content-html';
      }
    } catch (_) {}
  }
  if (!fn || !path) {
    res.status(400).json({ error: 'Missing fn or path parameter' });
    return;
  }

  // Only allow known function names
  const allowed = ['serve-bot-state-html', 'serve-bot-list-html', 'serve-bot-agent-html', 'serve-bot-content-html', 'serve-bot-crawl-stats-html', 'artifact-markdown'];
  if (!allowed.includes(fn)) {
    res.status(403).json({ error: 'Unknown function' });
    return;
  }

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = supabaseKey ? String(supabaseKey).trim() : '';
  if (!key) {
    res.status(500).json({ error: 'Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in Vercel env.' });
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
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        // Forward original user-agent so edge functions can identify bot crawlers
        "x-forwarded-user-agent": req.headers["user-agent"] || "",
      },
    });
    const html = await upstream.text();

    if (upstream.status === 401) {
      res.status(401).setHeader('Content-Type', 'application/json').json({
        error: 'Upstream 401',
        message: html || 'Missing or invalid Supabase key. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in Vercel (Settings > Environment Variables) and redeploy.',
      });
      return;
    }

    // Pass through useful custom headers from the edge function
    const passHeaders = ['x-agents-count', 'x-cities-count', 'x-page-type', 'x-agent-name', 'x-agent-tier'];
    for (const h of passHeaders) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Browser + Vercel CDN caching (ptm purges CDN on deploy)
    // Crawl stats: 1 hour cache (heavy queries, rolling data barely changes)
    // Agent/list/state pages: 5 min cache
    // Content pages (for-ai, transparency, faq): no CDN cache for real-time updates
    const cacheable5m = ['serve-bot-agent-html', 'serve-bot-list-html', 'serve-bot-state-html'];
    const cacheable1h = ['serve-bot-crawl-stats-html'];
    if (cacheable1h.includes(fn)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
      res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    } else if (cacheable5m.includes(fn)) {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=0');
    }
    res.status(upstream.status).send(html);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}

