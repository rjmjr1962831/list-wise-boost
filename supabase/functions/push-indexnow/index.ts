import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INDEXNOW_KEY = 'c24fefbb226c4059afbfa6c5cbce8639';
const SITE_HOST = 'www.top10lists.us';

// Key pages to submit to IndexNow
const KEY_URLS = [
  // Homepage
  'https://www.top10lists.us/',
  
  // Core pages
  'https://www.top10lists.us/about',
  'https://www.top10lists.us/about/ranking-methodology',
  'https://www.top10lists.us/about/founder',
  'https://www.top10lists.us/faq',
  'https://www.top10lists.us/for-agents',
  'https://www.top10lists.us/compare',
  'https://www.top10lists.us/test',
  
  // AI-specific pages
  'https://www.top10lists.us/for-ai',
  'https://www.top10lists.us/ai-liability',
  'https://www.top10lists.us/protocol-adopters',
  'https://www.top10lists.us/protocol-services',
  'https://www.top10lists.us/transparency',
  
  // Technical/AI files
  'https://www.top10lists.us/llms.txt',
  'https://www.top10lists.us/.well-known/ai-content-index.json',
  'https://www.top10lists.us/sitemap.xml',
  
  // Featured agent profiles - canonical URL format
  'https://www.top10lists.us/arizona/agents/amy-gilner-5479',
  'https://www.top10lists.us/arizona/agents/eric-swiatek-7652',
  'https://www.top10lists.us/arizona/agents/adam-hamblen-3396',
  'https://www.top10lists.us/arizona/agents/becca-grappin-1593',
  'https://www.top10lists.us/arizona/agents/arianna-ames-2139',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('push-indexnow: Starting IndexNow submission');

    // Parse optional additional URLs from request body
    let additionalUrls: string[] = [];
    try {
      const body = await req.json();
      if (body.urls && Array.isArray(body.urls)) {
        additionalUrls = body.urls;
      }
    } catch {
      // No body or invalid JSON, that's fine
    }

    const allUrls = [...KEY_URLS, ...additionalUrls];
    console.log(`push-indexnow: Submitting ${allUrls.length} URLs to IndexNow`);

    // Submit to IndexNow API
    const indexNowPayload = {
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: allUrls
    };

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(indexNowPayload),
    });

    const responseText = await response.text();
    console.log(`push-indexnow: IndexNow response status: ${response.status}`);
    console.log(`push-indexnow: IndexNow response: ${responseText}`);

    // IndexNow returns 200 for success, 202 for accepted
    const success = response.status === 200 || response.status === 202;

    if (success) {
      console.log('push-indexnow: Successfully notified IndexNow');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'IndexNow notification sent successfully',
          urlsSubmitted: allUrls.length,
          urls: allUrls,
          indexNowStatus: response.status,
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      console.error(`push-indexnow: IndexNow returned status ${response.status}: ${responseText}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: `IndexNow returned status ${response.status}`,
          error: responseText,
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('push-indexnow: Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
