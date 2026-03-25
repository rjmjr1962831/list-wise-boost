/**
 * Vercel Edge Middleware
 *
 * Runs on EVERY request at the edge, BEFORE CDN cache lookup.
 * Logs bot crawls to bot_crawl_logs via Supabase REST API.
 * Returns undefined to pass through — CDN serves cached response normally.
 *
 * NO next/server imports — this is a Vite project, not Next.js.
 */

const PRODUCTION_ORIGIN = 'https://www.top10lists.us';
const SUPABASE_REST = 'https://wiotrvoirdgzfacuuiem.supabase.co/rest/v1';

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
  for (const [name, re] of BOT_PATTERNS) {
    if (re.test(ua)) return name;
  }
  const lower = ua.toLowerCase();
  if (lower.includes("bot") || lower.includes("crawler") || lower.includes("spider")) {
    return "unknown_bot";
  }
  return null;
}

// Only log GEO-relevant paths (state/city/neighborhood/agent pages + key content)
const LOGGABLE = /^\/(arizona|california|texas|florida|new-york|colorado)\//i;
const CONTENT_PATHS = new Set([
  "/", "/transparency", "/faq", "/for-ai", "/about/founder",
  "/about/ranking-methodology", "/crawl-stats",
]);

function isLoggablePath(p) {
  return LOGGABLE.test(p) || CONTENT_PATHS.has(p);
}

function isStaging(host) {
  if (!host) return false;
  const h = host.toLowerCase().replace(/:\d+$/, '');
  return h === 'staging.top10lists.us' || h === 'staging.toptenlists.us' || h.endsWith('.vercel.app');
}

export default function middleware(request, context) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.hostname;
  const ua = request.headers.get('user-agent') || '';

  // 1. Staging: redirect bots to production
  if (isStaging(host) && detectBot(ua)) {
    return new Response(null, {
      status: 301,
      headers: { Location: `${PRODUCTION_ORIGIN}${url.pathname}${url.search}` },
    });
  }

  // 2. Production: log bot crawls
  const botName = detectBot(ua);
  if (!isStaging(host) && botName && isLoggablePath(url.pathname)) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (key) {
      const logPromise = fetch(`${SUPABASE_REST}/bot_crawl_logs`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          page_path: url.pathname,
          user_agent: ua.slice(0, 500),
          bot_name: botName,
          crawled_at: new Date().toISOString(),
        }),
      }).catch(() => {});

      // waitUntil keeps the fetch alive after the response is sent
      if (context && context.waitUntil) {
        context.waitUntil(logPromise);
      }
    }
  }

  // Pass through — let CDN serve cached response or hit origin
  return undefined;
}
