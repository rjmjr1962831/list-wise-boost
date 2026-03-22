/**
 * Vercel Edge Middleware
 *
 * Runs on EVERY request at the edge, before CDN caching. Two jobs:
 * 1. Staging: redirect bots to production (301)
 * 2. Production: log bot hits to bot_crawl_logs for accurate crawl counting
 *
 * Uses waitUntil() to keep the Supabase insert alive after the response
 * is sent, so logging never adds latency.
 */
import { NextResponse } from 'next/server';

const PRODUCTION_ORIGIN = 'https://www.top10lists.us';
const SUPABASE_REST = 'https://wiotrvoirdgzfacuuiem.supabase.co/rest/v1';

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

/* ── Path patterns worth logging ─────────────────────────────────── */
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

function isStaging(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return h === 'staging.top10lists.us' || h === 'staging.toptenlists.us' || h.endsWith('.vercel.app');
}

/* ── Middleware ───────────────────────────────────────────────────── */
export default function middleware(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.hostname;
  const ua = request.headers.get('user-agent') || '';

  // 1. Staging bot redirect
  if (isStaging(host) && detectBot(ua)) {
    const location = `${PRODUCTION_ORIGIN}${url.pathname}${url.search}`;
    return new Response(null, { status: 301, headers: { Location: location } });
  }

  // 2. Production bot crawl logging
  const botName = detectBot(ua);
  if (!isStaging(host) && botName && isLoggablePath(url.pathname)) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (key) {
      const row = {
        page_path: url.pathname,
        user_agent: ua.slice(0, 500),
        bot_name: botName,
        crawled_at: new Date().toISOString(),
        agent_id: null,
      };
      // Extract agent_id from artifact UUID
      const artifactMatch = url.pathname.match(ARTIFACT_PATH_RE);
      if (artifactMatch) row.agent_id = artifactMatch[1];

      const logPromise = fetch(`${SUPABASE_REST}/bot_crawl_logs`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      }).catch(() => {}); // Silent on error

      // waitUntil keeps the fetch alive after response is sent
      request.nextUrl; // ensure NextResponse context
      const response = NextResponse.next();
      response.waitUntil?.(logPromise);
      // Fallback: if waitUntil not available, the fetch is still fire-and-forget
      return response;
    }
  }

  return NextResponse.next();
}

// Only run on GEO-relevant paths + root (for staging redirect)
export const config = {
  matcher: [
    '/:state/agents/:slug*',
    '/:state/:city/top10realestateagents',
    '/:state/:city/:neighborhood/top10realestateagents',
    '/:state/top10realestateagents',
    '/artifact/:token*',
    '/',
  ],
};
