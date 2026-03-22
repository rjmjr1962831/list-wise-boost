/**
 * Vercel Serverless Proxy for Supabase Clean-Room HTML.
 *
 * Supabase gateway forces content-type: text/plain on edge function
 * HTML responses as a security measure. This proxy fetches the HTML
 * and re-serves it with correct content-type: text/html headers.
 *
 * Used by vercel.json rewrites for state, city, neighborhood, and agent profile clean-room pages.
 *
 * Also logs bot crawls directly to bot_crawl_logs (replaces unreliable Vercel log drain).
 */

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1';
const SUPABASE_REST = 'https://wiotrvoirdgzfacuuiem.supabase.co/rest/v1';

const CONTENT_PATHS = ['/for-ai', '/transparency', '/faq'];

/* ── Bot detection (matches vercel-log-drain + serve-bot-crawl-stats-html) ── */
const BOT_PATTERNS = [
  ["ChatGPT-User", /chatgpt-user/i],
  ["OAI-SearchBot", /oai-searchbot/i],
  ["GPTBot", /gptbot/i],
  ["ClaudeBot", /claudebot/i],
  ["claude-web", /claude-web|anthropic-ai/i],
  ["PerplexityBot", /perplexitybot/i],
  ["YouBot", /youbot/i],
  ["Meta-ExternalAgent", /meta-externalagent/i],
  ["Googlebot", /googlebot(?!-image)/i],
  ["GoogleOther", /googleother/i],
  ["Google-Extended", /google-extended/i],
  ["Bingbot", /bingbot/i],
  ["Applebot", /applebot/i],
  ["AhrefsBot", /ahrefsbot/i],
  ["SEMrushBot", /semrushbot/i],
  ["DotBot", /dotbot/i],
  ["MJ12bot", /mj12bot/i],
  ["ByteSpider", /bytespider/i],
  ["CCBot", /ccbot/i],
  ["FacebookExternalHit", /facebookexternalhit/i],
  ["Twitterbot", /twitterbot/i],
  ["LinkedInBot", /linkedinbot/i],
  ["YandexBot", /yandexbot/i],
  ["Baiduspider", /baiduspider/i],
  ["DuckDuckBot", /duckduckbot/i],
];

function detectBot(ua) {
  if (!ua) return null;
  for (const [name, pattern] of BOT_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  const lower = ua.toLowerCase();
  if (lower.includes("bot") || lower.includes("crawler") || lower.includes("spider")) {
    return "unknown_bot";
  }
  return null;
}

/* ── Path patterns worth logging ─────────────────────────────────────── */
const AGENT_PATH_RE = /^\/([a-z-]+)\/agents\/([a-z0-9-]+)\/?$/;
const CITY_PATH_RE = /^\/([a-z-]+)\/([a-z0-9-]+)\/top10realestateagents\/?$/;
const NEIGHBORHOOD_PATH_RE = /^\/([a-z-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\/top10realestateagents\/?$/;
const ARTIFACT_PATH_RE = /^\/artifact\/([0-9a-f-]{36})/;
const STATE_PATH_RE = /^\/([a-z-]+)\/top10realestateagents\/?$/;

function isLoggablePath(p) {
  return AGENT_PATH_RE.test(p) || CITY_PATH_RE.test(p) ||
    NEIGHBORHOOD_PATH_RE.test(p) || ARTIFACT_PATH_RE.test(p) ||
    STATE_PATH_RE.test(p);
}

/**
 * Fire-and-forget: log bot crawl to bot_crawl_logs via Supabase REST API.
 * Does not await — never blocks the response. Errors are silently logged.
 */
function logBotCrawl(path, ua, botName, key) {
  const row = {
    page_path: path,
    user_agent: ua.slice(0, 500),
    bot_name: botName,
    crawled_at: new Date().toISOString(),
    agent_id: null,
  };

  // Resolve agent_id from artifact UUID
  const artifactMatch = path.match(ARTIFACT_PATH_RE);
  if (artifactMatch) row.agent_id = artifactMatch[1];

  // For agent profile pages, resolve slug → id inline
  const agentMatch = path.match(AGENT_PATH_RE);
  if (agentMatch) {
    const slug = agentMatch[2];
    // Fire slug resolution + insert as a chain; don't block caller
    fetch(`${SUPABASE_REST}/professionals?canonical_slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) row.agent_id = data[0].id;
        return insertRow(row, key);
      })
      .catch(() => insertRow(row, key)); // insert even if slug resolution fails
    return;
  }

  insertRow(row, key);
}

function insertRow(row, key) {
  fetch(`${SUPABASE_REST}/bot_crawl_logs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  }).catch(err => {
    console.error('[crawl-log] insert failed:', err.message);
  });
}

/* ── Main handler ────────────────────────────────────────────────────── */
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
  const allowed = ['serve-bot-state-html', 'serve-bot-list-html', 'serve-bot-agent-html', 'serve-bot-content-html', 'serve-bot-crawl-stats-html', 'serve-bot-founder-html', 'artifact-markdown', 'serve-bot-home-html', 'serve-bot-pages-html', 'serve-bot-qa-html'];
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

  // ── Bot crawl logging (fire-and-forget, never blocks response) ──
  const ua = req.headers['user-agent'] || '';
  const botName = detectBot(ua);
  if (botName && isLoggablePath(path)) {
    logBotCrawl(path, ua, botName, key);
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
        "x-forwarded-user-agent": ua,
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
    // No CDN cache — every request hits origin so inline bot logging captures all crawls.
    // Browser cache only (5 min) to avoid redundant fetches from same user session.
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=0');
    res.status(upstream.status).send(html);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
