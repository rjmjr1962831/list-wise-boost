/**
 * Bot Detection Utility
 * Identifies search engine crawlers, LLM bots, and other automated agents
 */

// Comprehensive list of bot user agents
const BOT_PATTERNS = [
  // Search Engines
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /sogou/i,
  /exabot/i,
  
  // LLM/AI Bots
  /gptbot/i, // OpenAI
  /chatgpt-user/i,
  /claude-web/i, // Anthropic
  /anthropic-ai/i,
  /cohere-ai/i,
  /perplexitybot/i,
  /you.com/i,
  
  // Social Media Crawlers
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /pinterest/i,
  /whatsapp/i,
  /telegrambot/i,
  /slackbot/i,
  /discordbot/i,
  
  // SEO & Analytics
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i, // Majestic
  /dotbot/i,
  /screaming frog/i,
  /seobility/i,
  
  // Other Common Bots
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /go-http-client/i,
  /http\.rb/i,
  /okhttp/i,
  
  // Prerender services
  /prerender/i,
  /headless/i,
  /phantomjs/i,
  /puppeteer/i,
];

/**
 * Detects if the request is from a bot based on user agent
 */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  
  const ua = userAgent.toLowerCase();
  
  // Check against all bot patterns
  return BOT_PATTERNS.some(pattern => pattern.test(ua));
}

/**
 * Extracts bot type from user agent for analytics
 */
export function getBotType(userAgent: string | null | undefined): string | null {
  if (!userAgent || !isBot(userAgent)) return null;
  
  const ua = userAgent.toLowerCase();
  
  // Search Engines
  if (ua.includes('googlebot')) return 'Google';
  if (ua.includes('bingbot')) return 'Bing';
  if (ua.includes('slurp')) return 'Yahoo';
  if (ua.includes('duckduckbot')) return 'DuckDuckGo';
  if (ua.includes('baiduspider')) return 'Baidu';
  if (ua.includes('yandexbot')) return 'Yandex';
  
  // LLM Bots
  if (ua.includes('gptbot') || ua.includes('chatgpt')) return 'ChatGPT';
  if (ua.includes('claude')) return 'Claude';
  if (ua.includes('anthropic')) return 'Anthropic';
  if (ua.includes('cohere')) return 'Cohere';
  if (ua.includes('perplexity')) return 'Perplexity';
  
  // Social Media
  if (ua.includes('facebook')) return 'Facebook';
  if (ua.includes('twitter')) return 'Twitter';
  if (ua.includes('linkedin')) return 'LinkedIn';
  if (ua.includes('pinterest')) return 'Pinterest';
  
  // SEO Tools
  if (ua.includes('semrush')) return 'SEMrush';
  if (ua.includes('ahrefs')) return 'Ahrefs';
  if (ua.includes('mj12bot')) return 'Majestic';
  
  // Generic
  if (ua.includes('crawler')) return 'Crawler';
  if (ua.includes('spider')) return 'Spider';
  if (ua.includes('bot')) return 'Bot';
  
  return 'Unknown Bot';
}

/**
 * Client-side hook for bot detection (primarily for analytics)
 * Note: Client-side detection is less reliable than server-side
 */
export function useClientBotDetection() {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const botDetected = isBot(userAgent);
  const botType = getBotType(userAgent);
  
  return {
    isBot: botDetected,
    botType,
    userAgent
  };
}
