import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, username, password, protocol } = await req.json();

    console.log('Updating proxy settings:', {
      endpoint,
      username: username ? '***' : 'empty',
      password: password ? '***' : 'empty',
      protocol
    });

    // Note: In Supabase, secrets are managed via the Supabase CLI or dashboard
    // This function validates and returns success
    // The actual storage would be handled by Lovable's secrets management
    
    if (!endpoint || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate endpoint format
    const endpointRegex = /^[\w.-]+:\d+$/;
    if (!endpointRegex.test(endpoint)) {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint format. Expected format: hostname:port' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Proxy settings validated successfully',
        settings: {
          endpoint,
          protocol,
          username: username.substring(0, 3) + '***'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error updating proxy settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
