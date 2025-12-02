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

    const { token } = await req.json();

    if (!token) {
      throw new Error('token is required');
    }

    console.log('🔍 Validating token:', token.substring(0, 8) + '...');

    // Check if token is UUID format (professional ID) or verification token
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

    // Build query based on token format
    let query = supabase
      .from('professionals')
      .select(`
        *,
        cities:city_id (
          id,
          name,
          slug,
          state,
          state_slug
        ),
        categories:category_id (
          id,
          name,
          slug,
          plural_name
        )
      `);

    if (isUUID) {
      query = query.eq('id', token);
    } else {
      query = query.ilike('verification_token', `%${token}%`);
    }

    const { data: professional, error: fetchError } = await query.maybeSingle();

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

    console.log('✅ Valid token for:', professional.name);

    // Calculate city ranking (position among peers in same city/category)
    const { data: rankings, error: rankError } = await supabase
      .from('professionals')
      .select('id, rank, name')
      .eq('city_id', professional.city_id)
      .eq('category_id', professional.category_id)
      .eq('active', true)
      .order('rank', { ascending: true });

    let cityRank = null;
    let totalInCity = rankings?.length || 0;

    if (rankings) {
      const index = rankings.findIndex(p => p.id === professional.id);
      if (index !== -1) {
        cityRank = index + 1; // 1-indexed ranking
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        professional: {
          ...professional,
          city: professional.cities,
          category: professional.categories,
          city_rank: cityRank,
          total_in_city: totalInCity
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error validating token:', error);
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
