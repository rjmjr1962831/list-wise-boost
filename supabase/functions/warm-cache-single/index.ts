import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Warming cache for: ${url}`);

    // Fetch the URL with a bot user-agent to trigger Cloudflare KV caching
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': BOT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (response.ok) {
      console.log(`Successfully warmed cache for: ${url} (status: ${response.status})`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Cache warmed for ${url}`,
          status: response.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error(`Failed to warm cache for: ${url} (status: ${response.status})`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to warm cache: HTTP ${response.status}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error warming cache:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
