import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PRERENDER_TOKEN = Deno.env.get('PRERENDER_TOKEN');
const PRERENDER_SERVICE_URL = 'https://service.prerender.io';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comprehensive list of bot user-agents
const BOT_USER_AGENTS = [
  // Search Engine Crawlers
  'googlebot',
  'bingbot',
  'slurp', // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'sogou',
  'exabot',
  'facebot',
  'ia_archiver',
  
  // Social Media Crawlers
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'pinterestbot',
  'slackbot',
  'telegrambot',
  'whatsapp',
  'discordbot',
  'tumblr',
  'redditbot',
  'vkshare',
  
  // SEO & Analytics Tools
  'rogerbot', // Moz
  'ahrefsbot',
  'semrushbot',
  'dotbot', // OpenSiteExplorer
  'screaming frog',
  'majestic',
  'sitebulb',
  'seobilitybot',
  
  // Other Important Crawlers
  'applebot',
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'flipboard',
  'developers.google.com/+/web/snippet',
  'skypeuripreview',
  'w3c_validator',
  'redditbot',
  'applebot',
  'whatsapp',
  'flipboard',
  'tumblr',
  'bitlybot',
  'vkshare',
  'nuzzel',
  'discordbot',
  'qwantify',
  'pinterestbot',
  'bitrix link preview',
];

// Additional bot detection patterns
const BOT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /scrape/i,
  /preview/i,
];

function isBot(userAgent: string): boolean {
  if (!userAgent) return false;
  
  const lowerUserAgent = userAgent.toLowerCase();
  
  // Check against known bot user agents
  const isKnownBot = BOT_USER_AGENTS.some(bot => 
    lowerUserAgent.includes(bot.toLowerCase())
  );
  
  if (isKnownBot) return true;
  
  // Check against bot patterns
  const matchesPattern = BOT_PATTERNS.some(pattern => 
    pattern.test(userAgent)
  );
  
  return matchesPattern;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userAgent = req.headers.get('user-agent') || '';
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Detect if the request is from a bot
    const isBotRequest = isBot(userAgent);
    
    console.log(`Request from: ${userAgent}`);
    console.log(`Is Bot: ${isBotRequest}`);
    console.log(`Target URL: ${targetUrl}`);

    // If it's not a bot, return a signal to serve the normal React app
    if (!isBotRequest) {
      return new Response(
        JSON.stringify({ 
          isBot: false, 
          message: 'Regular user - serve React app normally' 
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If it's a bot, fetch pre-rendered content from Prerender.io
    console.log('Bot detected - fetching pre-rendered content from Prerender.io');
    
    const prerenderUrl = `${PRERENDER_SERVICE_URL}/${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(prerenderUrl, {
      headers: {
        'X-Prerender-Token': PRERENDER_TOKEN || '',
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      console.error(`Prerender.io error: ${response.status} ${response.statusText}`);
      throw new Error(`Prerender.io returned ${response.status}`);
    }

    const html = await response.text();
    
    console.log('Successfully fetched pre-rendered HTML');

    // Return the pre-rendered HTML with appropriate headers
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'X-Prerendered': 'true',
      },
    });

  } catch (error) {
    console.error('Error in prerender-proxy function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        isBot: false,
        fallback: 'Error occurred - serve React app'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

