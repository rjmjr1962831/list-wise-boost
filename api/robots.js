/**
 * Dynamic robots.txt: staging = Disallow /, production = Allow / + sitemaps.
 * Ensures AI bot traffic and crawl budget focus on Main (Production) only.
 */

const PRODUCTION_HOST = 'www.top10lists.us';

const STAGING_BODY = `# robots.txt - Staging (no-index zone)
# All crawlers blocked. Use production for discovery.

User-agent: *
Disallow: /

Sitemap: https://www.top10lists.us/sitemap.xml
`;

const PRODUCTION_BODY = `# robots.txt for Top10Lists.us (Production)
# Last Updated: February 2026

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /profile/
Disallow: /funnel/
Disallow: /funnel-test/
Disallow: /dashboard/
Disallow: /visibility/
Disallow: /agent-setup/

Allow: /arizona/
Allow: /california/
Allow: /colorado/
Allow: /texas/
Allow: /florida/
Allow: /new-york/

# AI Crawler Declarations - pre-rendered HTML for citation
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: GoogleOther
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Applebot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: Cohere-AI
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

User-agent: AmazonBot
Allow: /

User-agent: AhrefsBot
Allow: /

User-agent: SemrushBot
Allow: /

User-agent: MJ12bot
Allow: /

User-agent: DotBot
Allow: /

# Sitemaps - 15,730 verified pages
Sitemap: https://www.top10lists.us/sitemap.xml
Sitemap: https://www.top10lists.us/sitemap-pages.xml
Sitemap: https://www.top10lists.us/sitemap-states.xml
Sitemap: https://www.top10lists.us/sitemap-cities.xml
Sitemap: https://www.top10lists.us/sitemap-neighborhoods.xml
Sitemap: https://www.top10lists.us/sitemap-agents.xml
`;

function isProduction(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return h === PRODUCTION_HOST || h === 'top10lists.us';
}

module.exports = (req, res) => {
  const host = (req.headers['x-forwarded-host'] || req.headers['host'] || '').split(',')[0].trim();
  const body = isProduction(host) ? PRODUCTION_BODY : STAGING_BODY;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(body);
};
