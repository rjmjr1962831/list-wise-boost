import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateRequest {
  token: string; // verification_token or professional ID
  field: string;
  value: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, field, value }: UpdateRequest = await req.json();

    if (!token || !field) {
      return new Response(
        JSON.stringify({ error: 'Missing token or field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only allow updating specific editable fields
    const allowedFields = [
      'image_url',
      'sidebar_video_url',
      'company',
      'phone',
      'email',
      'website',
      'description',
      'specialty',
      'notable_achievements',
      'press_mentions',
      'social_facebook',
      'social_twitter',
      'social_instagram',
      'social_tiktok'
    ];

    if (!allowedFields.includes(field)) {
      console.log(`Attempted to update non-allowed field: ${field}`);
      return new Response(
        JSON.stringify({ error: 'Field not allowed for self-service update' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, find the professional by token or ID
    let professionalId: string | null = null;
    
    // Try verification_token first
    const { data: byToken } = await supabase
      .from('professionals')
      .select('id')
      .eq('verification_token', token)
      .maybeSingle();
    
    if (byToken) {
      professionalId = byToken.id;
    } else {
      // Check if token looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
      if (isUUID) {
        const { data: byId } = await supabase
          .from('professionals')
          .select('id')
          .eq('id', token)
          .maybeSingle();
        if (byId) {
          professionalId = byId.id;
        }
      }
    }

    if (!professionalId) {
      console.log(`Professional not found for token: ${token}`);
      return new Response(
        JSON.stringify({ error: 'Professional not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the field
    console.log(`Updating professional ${professionalId}, field ${field}`);
    
    const { error: updateError } = await supabase
      .from('professionals')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', professionalId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log(`Successfully updated ${field} for professional ${professionalId}`);

    return new Response(
      JSON.stringify({ success: true, professionalId, field }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-professional-field:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
