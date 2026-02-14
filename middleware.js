/**
 * Bot redirection: on Staging, send AI/search bots to Production (301).
 * Preserves SEO signal and keeps Bot Analytics on Main only.
 */

const PRODUCTION_ORIGIN = 'https://www.top10lists.us';

const BOT_UA_PATTERN = /googlebot|bingbot|gptbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|applebot|meta-externalagent|facebookexternalhit|amazonbot|bytespider|ccbot|cohere-ai|slurp|duckduckbot|yandexbot|baiduspider|semrushbot|ahrefsbot|mj12bot|dotbot/i;

function isStaging(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return h === 'staging.top10lists.us' || h === 'staging.toptenlists.us' || h.endsWith('.vercel.app');
}

function isBot(userAgent) {
  return userAgent && BOT_UA_PATTERN.test(userAgent);
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.hostname;
  const ua = request.headers.get('user-agent') || '';

  if (isStaging(host) && isBot(ua)) {
    const path = url.pathname || '/';
    const search = url.search || '';
    const location = `${PRODUCTION_ORIGIN}${path}${search}`;
    return new Response(null, {
      status: 301,
      headers: { Location: location },
    });
  }

  return undefined;
}
