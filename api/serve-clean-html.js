/**
 * Vercel Serverless Proxy — SSR Cache + Bot Logger
 *
 * Every request flows through this proxy (no Vercel CDN caching).
 * 1. Log bot crawl (awaited)
 * 2. Check rendered_pages cache (24h TTL)
 * 3. Cache hit → serve from DB
 * 4. Cache miss → call Supabase edge function, store result, serve it
 *
 * This is our "Private CDN" — we see every request and control the cache.
 */

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1';
const SUPABASE_REST = 'https://wiotrvoirdgzfacuuiem.supabase.co/rest/v1';

const CONTENT_PATHS = ['/for-ai', '/transparency', '/faq'];

// Functions whose output can be cached in rendered_pages
const CACHEABLE_FNS = new Set([
  'serve-bot-list-html',
  'serve-bot-agent-html',
  'serve-bot-state-html',
  'serve-bot-content-html',
  'serve-bot-home-html',
  'serve-bot-founder-html',
]);

// Cache TTL in hours by function
const TTL_HOURS = {
  'serve-bot-list-html': 24,
  'serve-bot-agent-html': 24,
  'serve-bot-state-html': 48,
  'serve-bot-content-html': 48,
  'serve-bot-home-html': 24,
  'serve-bot-founder-html': 48,
};

// Page type for rendered_pages (for selective invalidation)
const PAGE_TYPE = {
  'serve-bot-list-html': 'list',
  'serve-bot-agent-html': 'agent',
  'serve-bot-state-html': 'state',
  'serve-bot-content-html': 'content',
  'serve-bot-home-html': 'home',
  'serve-bot-founder-html': 'founder',
};

/* ── Bot detection ─────────────────────────────────────────────────── */
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
  ["Gemini-AI", /gemini-ai/i],
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

/* ── Path patterns worth logging ───────────────────────────────────── */
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

/* ── Bot crawl logger (awaited) ────────────────────────────────────── */
async function logBotCrawl(path, ua, botName, key) {
  const row = {
    page_path: path,
    user_agent: ua.slice(0, 500),
    bot_name: botName,
    crawled_at: new Date().toISOString(),
    agent_id: null,
  };

  const artifactMatch = path.match(ARTIFACT_PATH_RE);
  if (artifactMatch) row.agent_id = artifactMatch[1];

  const agentMatch = path.match(AGENT_PATH_RE);
  if (agentMatch) {
    try {
      const slug = agentMatch[2];
      const r = await fetch(`${SUPABASE_REST}/professionals?canonical_slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`, {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
      });
      const data = await r.json();
      if (data && data.length > 0) row.agent_id = data[0].id;
    } catch (_) {}
  }

  try {
    await fetch(`${SUPABASE_REST}/bot_crawl_logs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
  } catch (err) {
    console.error('[crawl-log] insert failed:', err.message);
  }
}

/* ── SSR Cache: check rendered_pages ───────────────────────────────── */
async function getCachedPage(path, ttlHours, key) {
  try {
    const r = await fetch(
      `${SUPABASE_REST}/rendered_pages?path=eq.${encodeURIComponent(path)}&select=html_content,created_at&limit=1`,
      { headers: { Authorization: `Bearer ${key}`, apikey: key } }
    );
    const data = await r.json();
    if (!data || data.length === 0) return null;

    const age = (Date.now() - new Date(data[0].created_at).getTime()) / 3600000;
    if (age > ttlHours) return null; // expired

    return data[0].html_content;
  } catch (_) {
    return null;
  }
}

async function setCachedPage(path, html, pageType, key) {
  try {
    await fetch(`${SUPABASE_REST}/rendered_pages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        path,
        html_content: html,
        page_type: pageType,
        created_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error('[cache] upsert failed:', err.message);
  }
}

/* ── Main handler ──────────────────────────────────────────────────── */
export default async function handler(req, res) {
  let { fn, path } = req.query;
  if (path && (path.includes('undefined') || path === 'undefined')) path = null;
  if ((!fn || !path) && req.url) {
    try {
      const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      fn = fn || u.searchParams.get('fn');
      path = path || u.searchParams.get('path');
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
    res.status(500).json({ error: 'Missing Supabase key.' });
    return;
  }

  const ua = req.headers['user-agent'] || '';

  // Determine if this request has dynamic params (search, token, etc.)
  const hasDynamicParams = !!(req.query.agent || req.query.market || req.query.search_only || req.query.token || req.query.preview_tier || req.query.q);
  const isCacheable = CACHEABLE_FNS.has(fn) && !hasDynamicParams;

  try {
    let html = null;
    let fromCache = false;

    // 1. Check SSR cache (only for cacheable functions without dynamic params)
    if (isCacheable) {
      const ttl = TTL_HOURS[fn] || 24;
      html = await getCachedPage(path, ttl, key);
      if (html) fromCache = true;
    }

    // 2. Cache miss → call upstream edge function
    if (!html) {
      let url = `${SUPABASE_URL}/${fn}?path=${encodeURIComponent(path)}`;
      if (req.query.token) url += `&token=${encodeURIComponent(req.query.token)}`;
      if (req.query.preview_tier) url += `&preview_tier=${encodeURIComponent(req.query.preview_tier)}`;
      for (const p of ['q', 'agent', 'market', 'range', 'search_only']) {
        if (req.query[p]) url += `&${p}=${encodeURIComponent(req.query[p])}`;
      }

      const upstream = await fetch(url, {
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "x-forwarded-user-agent": ua,
        },
      });
      html = await upstream.text();

      if (upstream.status === 401) {
        res.status(401).json({ error: 'Upstream 401', message: html });
        return;
      }

      // Store in cache (only successful responses for cacheable functions)
      if (isCacheable && upstream.status >= 200 && upstream.status < 400) {
        const pageType = PAGE_TYPE[fn] || 'other';
        // Don't await cache write — it's not critical to the response
        setCachedPage(path, html, pageType, key).catch(() => {});
      }

      // Pass through custom headers
      const passHeaders = ['x-agents-count', 'x-cities-count', 'x-page-type', 'x-agent-name', 'x-agent-tier'];
      for (const h of passHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
    }

    // 3. Bot crawl logging — awaited before response
    const botName = detectBot(ua);
    if (botName && isLoggablePath(path)) {
      await logBotCrawl(path, ua, botName, key);
    }

    // 4. Serve — no CDN caching, every request hits this proxy
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=0');
    if (fromCache) res.setHeader('X-Cache', 'HIT');
    res.status(200).send(html);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
