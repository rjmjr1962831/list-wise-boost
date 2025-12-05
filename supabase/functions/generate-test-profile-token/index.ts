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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      throw new Error('Admin access required');
    }

    const { professionalId } = await req.json();

    // Generate a verification token that expires in 7 days
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update the professional with the new token
    const { data: professional, error: updateError } = await supabaseClient
      .from('professionals')
      .update({
        verification_token: verificationToken,
        verification_token_expires_at: expiresAt.toISOString(),
        verification_started_at: new Date().toISOString(),
        funnel_status: 'welcome'
      })
      .eq('id', professionalId)
      .select('id, name, email, verification_token, city_id, category_id, cities(name, slug), categories(name, slug)')
      .single();

    if (updateError) throw updateError;

    console.log(`✅ Generated test token for ${professional.name}: ${verificationToken}`);

    return new Response(
      JSON.stringify({
        success: true,
        token: verificationToken,
        professionalId: professional.id,
        professionalName: professional.name,
        funnelUrl: `/profile/${verificationToken}`,
        expiresAt: expiresAt.toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error generating test token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message.includes('required') || error.message.includes('Invalid') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
