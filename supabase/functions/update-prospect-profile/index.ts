import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { token, updates } = await req.json();

    if (!token) {
      throw new Error('token is required');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('updates object is required');
    }

    console.log('🔍 Validating token:', token.substring(0, 8) + '...');

    // Validate token and get professional
    const { data: professional, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, verification_token_expires_at')
      .eq('verification_token', token)
      .single();

    if (fetchError || !professional) {
      console.error('❌ Invalid token');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid or expired token'
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if token is expired
    if (professional.verification_token_expires_at) {
      const expiryDate = new Date(professional.verification_token_expires_at);
      if (expiryDate < new Date()) {
        console.error('❌ Token expired');
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Token has expired'
          }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Whitelist of allowed fields to update
    const allowedFields = [
      'name',
      'email',
      'phone',
      'company',
      'headline',
      'description',
      'years_experience',
      'specialty',
      'certifications',
      'languages',
      'service_areas',
      'website',
      'social_linkedin',
      'social_facebook',
      'social_instagram',
      'funnel_status',
      'address',
      'zip_code'
    ];

    // Filter updates to only allowed fields
    const filteredUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No valid fields to update'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update professional
    const { data, error: updateError } = await supabase
      .from('professionals')
      .update(filteredUpdates)
      .eq('id', professional.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Update error:', updateError);
      throw updateError;
    }

    console.log('✅ Profile updated for:', professional.name);

    return new Response(
      JSON.stringify({
        success: true,
        professional: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error updating profile:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});