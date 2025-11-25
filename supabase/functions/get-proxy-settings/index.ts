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
    console.log('Fetching proxy settings from environment');

    // Read proxy settings from environment variables
    const endpoint = Deno.env.get('ROTATING_PROXY_ENDPOINT') || '';
    const username = Deno.env.get('ROTATING_PROXY_USERNAME') || '';
    const password = Deno.env.get('ROTATING_PROXY_PASSWORD') || '';
    const protocol = Deno.env.get('ROTATING_PROXY_PROTOCOL') || 'http';

    // Only return masked credentials for security
    return new Response(
      JSON.stringify({ 
        success: true,
        settings: {
          endpoint,
          username: username ? username.substring(0, 3) + '***' : '',
          password: password ? '***' : '',
          protocol,
          hasCredentials: !!(endpoint && username && password)
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error fetching proxy settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
