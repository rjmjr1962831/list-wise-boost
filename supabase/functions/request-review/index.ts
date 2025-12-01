import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      full_name,
      email,
      phone,
      license_number,
      brokerage,
      years_licensed,
      estimated_transactions,
      message,
    } = await req.json();

    console.log('📝 Submitting review request for:', full_name);

    // Validate required fields
    if (!full_name || !email || !phone || !license_number || !brokerage) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Insert review request
    const { data, error } = await supabase
      .from('review_requests')
      .insert({
        full_name,
        email,
        phone,
        license_number,
        brokerage,
        years_licensed,
        estimated_transactions,
        message,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting review request:', error);
      throw error;
    }

    console.log('✅ Review request submitted:', data.id);

    return new Response(
      JSON.stringify({
        success: true,
        id: data.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error in request-review:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
