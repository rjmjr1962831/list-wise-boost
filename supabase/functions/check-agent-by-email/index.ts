import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the professional by email
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('id, name, verification_token, active, funnel_status')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (profError) {
      console.error('[check-agent-by-email] Query error:', profError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!professional) {
      // Not found - don't reveal this is the reason for security
      return new Response(
        JSON.stringify({ 
          exists: false,
          active: false,
          verification_token: null,
          hasStartedFunnel: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if they've started the funnel by looking at funnel_events
    const { data: funnelEvent } = await supabase
      .from('funnel_events')
      .select('id')
      .eq('professional_id', professional.id)
      .eq('event_name', 'step0_completed')
      .limit(1)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        exists: true,
        active: professional.active === true,
        verification_token: professional.active ? professional.verification_token : null,
        hasStartedFunnel: !!funnelEvent,
        funnel_status: professional.funnel_status
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[check-agent-by-email] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
