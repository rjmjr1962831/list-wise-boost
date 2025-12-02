import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRERENDER_TOKEN = Deno.env.get('PRERENDER_TOKEN');
const RECACHE_URL = "https://api.prerender.io/recache";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!PRERENDER_TOKEN) {
      console.error('PRERENDER_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'PRERENDER_TOKEN not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Recaching URL: ${url}`);

    const response = await fetch(RECACHE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prerenderToken: PRERENDER_TOKEN,
        url: url,
      }),
    });

    if (response.ok) {
      console.log(`✅ Successfully recached: ${url}`);
      return new Response(
        JSON.stringify({ success: true, url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed to recache ${url}: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          url, 
          error: `${response.status}: ${errorText}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Recache error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
