import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const enrichmentKey = Deno.env.get('ENRICHMENT_API_KEY')
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    return new Response(JSON.stringify({
      status: 'diagnostic',
      env_check: {
        enrichment_key_set: !!enrichmentKey,
        deepseek_key_set: !!deepseekKey,
        supabase_url_set: !!supabaseUrl,
        supabase_key_set: !!supabaseKey,
        supabase_url: supabaseUrl,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
