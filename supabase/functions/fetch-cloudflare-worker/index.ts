// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CURSOR_API_KEY = Deno.env.get('CURSOR_API_KEY');

    if (!CLOUDFLARE_ACCOUNT_ID || !CURSOR_API_KEY) {
      throw new Error('Missing Cloudflare credentials (CLOUDFLARE_ACCOUNT_ID or CURSOR_API_KEY)');
    }

    const { scriptName } = await req.json().catch(() => ({}));

    if (!scriptName || typeof scriptName !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required scriptName in request body'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}`,
      {
        headers: {
          'Authorization': `Bearer ${CURSOR_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloudflare API error:', response.status, errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Cloudflare API error: ${response.status}`,
        details: errorText 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    const scriptContent = await response.text();
    
    return new Response(JSON.stringify({ 
      success: true, 
      script: scriptContent,
      scriptName 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching worker:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
