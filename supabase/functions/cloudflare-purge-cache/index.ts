import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_ZONE_ID = Deno.env.get('CLOUDFLARE_ZONE_ID');
const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
const CLOUDFLARE_API_URL = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`;

interface PurgeRequest {
  urls?: string[];
  purge_everything?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_API_TOKEN) {
      console.error('Cloudflare credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudflare credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const body = await req.json();
    const { urls, purge_everything } = body as PurgeRequest;

    // Build Cloudflare purge payload
    let purgePayload: Record<string, unknown> = {};
    
    if (purge_everything) {
      purgePayload = { purge_everything: true };
      console.log('Purging entire cache');
    } else if (urls && urls.length > 0) {
      // Cloudflare allows max 30 URLs per request
      if (urls.length > 30) {
        return new Response(
          JSON.stringify({ success: false, error: 'Maximum 30 URLs per request' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      purgePayload = { files: urls };
      console.log(`Purging ${urls.length} URLs:`, urls);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Either urls array or purge_everything flag required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const response = await fetch(CLOUDFLARE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(purgePayload),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Cache purge successful:', result);
      return new Response(
        JSON.stringify({ 
          success: true, 
          purged_urls: urls?.length || 'all',
          cloudflare_result: result 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('❌ Cloudflare API error:', result.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.errors?.[0]?.message || 'Cloudflare API error',
          details: result.errors 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
  } catch (error) {
    console.error('Purge error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
