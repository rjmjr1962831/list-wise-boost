/**
 * Vercel Edge Middleware
 *
 * Runs on EVERY request, before CDN caching. Two jobs:
 * 1. Staging: redirect bots to production (301)
 * 2. Production: log bot hits to page_bot_hits for accurate crawl counting
 *
 * The bot hit logging is fire-and-forget (no await) so it adds zero
 * latency to the response. The page_bot_hits table captures every bot
 * request regardless of CDN caching, unlike bot_crawl_logs which only
 * fires when the edge function executes (cache MISS).
 */

const PRODUCTION_ORIGIN = 'https://www.top10lists.us';
const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co';

const BOT_UA_PATTERN = /googlebot|bingbot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|applebot|meta-externalagent|facebookexternalhit|amazonbot|bytespider|ccbot|cohere-ai|slurp|duckduckbot|yandexbot|baiduspider|semrushbot|ahrefsbot|mj12bot|dotbot|youbot|diffbot|petalbot/i;

// Bot name extraction -- maps UA substring to clean name
const BOT_NAMES = [
  ["chatgpt-user", "ChatGPT-User"], ["oai-searchbot", "OAI-SearchBot"], ["gptbot", "GPTBot"],
  ["claudebot", "ClaudeBot"], ["claude-web", "ClaudeBot"], ["anthropic-ai", "Anthropic-AI"],
  ["perplexitybot", "PerplexityBot"], ["youbot", "YouBot"],
  ["meta-externalagent", "Meta-ExternalAgent"], ["facebookexternalhit", "FacebookExternalHit"],
  ["googlebot", "Googlebot"], ["bingbot", "Bingbot"],
  ["applebot", "Applebot"], ["bytespider", "ByteSpider"], ["ccbot", "CCBot"],
  ["semrushbot", "SEMrushBot"], ["ahrefsbot", "AhrefsBot"],
  ["mj12bot", "MJ12bot"], ["dotbot", "DotBot"],
];

// Only log hits on GEO pages (agent profiles, city/neighborhood lists)
const GEO_PAGE_PATTERN = /^\/(arizona|california)\//;

function isStaging(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return h === 'staging.top10lists.us' || h === 'staging.toptenlists.us' || h.endsWith('.vercel.app');
}

function isBot(userAgent) {
  return userAgent && BOT_UA_PATTERN.test(userAgent);
}

function extractBotName(ua) {
  const lower = ua.toLowerCase();
  for (const [pattern, name] of BOT_NAMES) {
    if (lower.includes(pattern)) return name;
  }
  return null;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.hostname;
  const ua = request.headers.get('user-agent') || '';

  // 1. Staging bot redirect
  if (isStaging(host) && isBot(ua)) {
    const path = url.pathname || '/';
    const search = url.search || '';
    const location = `${PRODUCTION_ORIGIN}${path}${search}`;
    return new Response(null, {
      status: 301,
      headers: { Location: location },
    });
  }

  // 2. Production bot hit logging (fire and forget)
  if (!isStaging(host) && isBot(ua) && GEO_PAGE_PATTERN.test(url.pathname)) {
    const botName = extractBotName(ua);
    if (botName) {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
      if (key) {
        // Fire and forget -- don't await, don't block the response
        fetch(`${SUPABASE_URL}/rest/v1/page_bot_hits`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            page_path: url.pathname,
            bot_name: botName,
          }),
        }).catch(() => {}); // Silently ignore errors
      }
    }
  }

  return undefined;
}
