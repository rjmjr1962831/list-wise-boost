const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://www.top10lists.us';

const TEST_URLS = [
  '/arizona/phoenix/top10realestateagents',
  '/arizona/scottsdale/top10realestateagents',
  '/arizona/mesa/top10realestateagents',
  '/arizona/tucson/top10realestateagents',
];

interface CacheStatus {
  url: string;
  fullUrl: string;
  cached: boolean;
  lastCachedAt: string | null;
  cacheAgeHours: number | null;
  error?: string;
}

interface BotTestResult {
  url: string;
  fullUrl: string;
  responseSize: number;
  responseSizeKB: number;
  hasJsonLd: boolean;
  hasAgentData: boolean;
  agentNamesFound: string[];
  isHealthy: boolean;
  error?: string;
  responsePreview?: string;
}

interface DiagnosticsRequest {
  action: 'check' | 'recache' | 'recache-all' | 'bot-test';
  urls?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const prerenderToken = Deno.env.get('PRERENDER_TOKEN');
    
    if (!prerenderToken) {
      return new Response(
        JSON.stringify({ error: 'PRERENDER_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, urls } = await req.json() as DiagnosticsRequest;

    console.log(`Prerender diagnostics action: ${action}`);

    switch (action) {
      case 'check':
        return await handleCacheCheck(prerenderToken, urls || TEST_URLS);
      case 'recache':
        return await handleRecache(prerenderToken, urls || []);
      case 'recache-all':
        return await handleRecache(prerenderToken, TEST_URLS);
      case 'bot-test':
        return await handleBotTest(urls || TEST_URLS);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in prerender-diagnostics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCacheCheck(token: string, urls: string[]): Promise<Response> {
  console.log(`Checking cache status for ${urls.length} URLs`);
  
  const results: CacheStatus[] = [];
  
  for (const path of urls) {
    const fullUrl = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    
    try {
      // Check cache status via prerender.io API
      // The API endpoint for checking cache is: GET https://api.prerender.io/cache
      const response = await fetch(`https://api.prerender.io/cache?url=${encodeURIComponent(fullUrl)}`, {
        method: 'GET',
        headers: {
          'X-Prerender-Token': token
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Cache check for ${path}:`, JSON.stringify(data));
        
        const lastCachedAt = data.cached_at || data.lastCached || null;
        let cacheAgeHours: number | null = null;
        
        if (lastCachedAt) {
          const cachedDate = new Date(lastCachedAt);
          const now = new Date();
          cacheAgeHours = Math.round((now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60) * 10) / 10;
        }
        
        results.push({
          url: path,
          fullUrl,
          cached: data.cached === true || !!data.cached_at || !!data.lastCached,
          lastCachedAt,
          cacheAgeHours
        });
      } else {
        const errorText = await response.text();
        console.error(`Cache check failed for ${path}: ${response.status} - ${errorText}`);
        results.push({
          url: path,
          fullUrl,
          cached: false,
          lastCachedAt: null,
          cacheAgeHours: null,
          error: `API error: ${response.status}`
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Cache check error for ${path}:`, errorMessage);
      results.push({
        url: path,
        fullUrl,
        cached: false,
        lastCachedAt: null,
        cacheAgeHours: null,
        error: errorMessage
      });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return new Response(
    JSON.stringify({ results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRecache(token: string, urls: string[]): Promise<Response> {
  if (urls.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No URLs provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`Triggering recache for ${urls.length} URLs`);
  
  const results = [];
  
  for (const path of urls) {
    const fullUrl = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    
    try {
      const response = await fetch('https://api.prerender.io/recache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Prerender-Token': token
        },
        body: JSON.stringify({ url: fullUrl })
      });

      const responseText = await response.text();
      
      results.push({
        url: path,
        fullUrl,
        success: response.ok,
        status: response.status,
        response: responseText
      });

      console.log(`${response.ok ? '✅' : '❌'} Recache ${path}: ${response.status}`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        url: path,
        fullUrl,
        success: false,
        error: errorMessage
      });
      console.error(`❌ Recache ${path}: ${errorMessage}`);
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return new Response(
    JSON.stringify({
      message: 'Recache triggered',
      succeeded,
      failed,
      results
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleBotTest(urls: string[]): Promise<Response> {
  console.log(`Running bot test for ${urls.length} URLs`);
  
  const results: BotTestResult[] = [];
  
  // Test with different bot user agents
  const botUserAgents = [
    'GPTBot/1.0',
    'ClaudeBot/1.0',
    'PerplexityBot/1.0'
  ];
  
  for (const path of urls) {
    const fullUrl = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    
    try {
      // Make request as GPTBot (most important one)
      console.log(`Bot test for ${path} as GPTBot...`);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) GPTBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });

      if (!response.ok) {
        results.push({
          url: path,
          fullUrl,
          responseSize: 0,
          responseSizeKB: 0,
          hasJsonLd: false,
          hasAgentData: false,
          agentNamesFound: [],
          isHealthy: false,
          error: `HTTP ${response.status}`
        });
        continue;
      }

      const html = await response.text();
      const responseSize = new TextEncoder().encode(html).length;
      const responseSizeKB = Math.round(responseSize / 1024 * 10) / 10;
      
      // Check for JSON-LD schema
      const hasJsonLd = html.includes('application/ld+json') && 
                        (html.includes('"@type":"RealEstateAgent"') || 
                         html.includes('"@type":"ItemList"') ||
                         html.includes('"@type": "RealEstateAgent"') ||
                         html.includes('"@type": "ItemList"'));
      
      // Check for agent data patterns (not just placeholder text)
      // Look for real agent names, not template variables
      const hasAgentData = !html.includes('Loading agents...') &&
                          !html.includes('No agents found') &&
                          (html.includes('years of experience') || 
                           html.includes('Review') ||
                           html.includes('★') ||
                           html.includes('rating'));
      
      // Try to extract agent names from the response
      const agentNamesFound: string[] = [];
      const nameMatches = html.match(/<h[23][^>]*class="[^"]*agent[^"]*"[^>]*>([^<]+)<\/h[23]>/gi) ||
                          html.match(/itemprop="name">([^<]+)</gi) ||
                          html.match(/"name":\s*"([^"]+)"/g);
      
      if (nameMatches) {
        nameMatches.slice(0, 5).forEach(match => {
          const name = match.replace(/<[^>]+>/g, '')
                           .replace(/itemprop="name">/g, '')
                           .replace(/"name":\s*"/g, '')
                           .replace(/"/g, '')
                           .trim();
          if (name && name.length > 2 && name.length < 50 && !name.includes('{')) {
            agentNamesFound.push(name);
          }
        });
      }
      
      // Health check: response should be 60KB+ and have agent data
      const isHealthy = responseSizeKB >= 60 && (hasJsonLd || hasAgentData);
      
      // Get a preview of the response (first 500 chars)
      const responsePreview = html.substring(0, 500);
      
      results.push({
        url: path,
        fullUrl,
        responseSize,
        responseSizeKB,
        hasJsonLd,
        hasAgentData,
        agentNamesFound,
        isHealthy,
        responsePreview
      });
      
      console.log(`✅ Bot test ${path}: ${responseSizeKB}KB, JSON-LD: ${hasJsonLd}, Agent Data: ${hasAgentData}, Healthy: ${isHealthy}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Bot test ${path}:`, errorMessage);
      results.push({
        url: path,
        fullUrl,
        responseSize: 0,
        responseSizeKB: 0,
        hasJsonLd: false,
        hasAgentData: false,
        agentNamesFound: [],
        isHealthy: false,
        error: errorMessage
      });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const healthyCount = results.filter(r => r.isHealthy).length;
  const unhealthyCount = results.filter(r => !r.isHealthy).length;

  return new Response(
    JSON.stringify({
      message: 'Bot test complete',
      healthy: healthyCount,
      unhealthy: unhealthyCount,
      results
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
