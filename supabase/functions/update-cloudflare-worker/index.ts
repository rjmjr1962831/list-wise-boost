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
    const CLOUDFLARE_GLOBAL_API_KEY = Deno.env.get('CLOUDFLARE_GLOBAL_API_KEY');

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_GLOBAL_API_KEY) {
      throw new Error('Missing Cloudflare credentials (CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_GLOBAL_API_KEY)');
    }

    const { scriptName = 'orange-truth-a103', scriptContent } = await req.json();

    if (!scriptContent) {
      throw new Error('Missing scriptContent in request body');
    }

    console.log(`Updating Cloudflare Worker: ${scriptName}`);
    console.log(`Script content length: ${scriptContent.length} characters`);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}`,
      {
        method: 'PUT',
        headers: {
          'X-Auth-Email': 'robert@aryah.ai',
          'X-Auth-Key': CLOUDFLARE_GLOBAL_API_KEY,
          'Content-Type': 'application/javascript',
        },
        body: scriptContent,
      }
    );

    const responseText = await response.text();
    console.log('Cloudflare API response status:', response.status);
    console.log('Cloudflare API response:', responseText);

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Cloudflare API error: ${response.status}`,
        details: responseText 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      result,
      scriptName 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating worker:', error);
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
