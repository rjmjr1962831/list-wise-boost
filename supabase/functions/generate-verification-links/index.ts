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

    const { cityId, categoryId, regenerate = false } = await req.json();

    console.log('Generating verification links for:', { cityId, categoryId, regenerate });

    // Build query - select ALL fields
    let query = supabase
      .from('professionals')
      .select('*')
      .eq('active', true);

    if (cityId) query = query.eq('city_id', cityId);
    if (categoryId) query = query.eq('category_id', categoryId);

    const { data: agents, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    const updates = [];
    const links = [];

    for (const agent of agents || []) {
      // Generate new token if needed
      let token = agent.verification_token;
      const expiresAt = agent.verification_token_expires_at;
      const isExpired = expiresAt ? new Date(expiresAt) < new Date() : true;

      if (!token || isExpired || regenerate) {
        // Generate a secure random token
        token = crypto.randomUUID();
        const expires = new Date();
        expires.setDate(expires.getDate() + 90); // 90 days validity

        updates.push({
          id: agent.id,
          verification_token: token,
          verification_token_expires_at: expires.toISOString(),
          verification_started_at: new Date().toISOString()
        });
      }

      links.push({
        ...agent, // Include all agent fields
        verification_link: `${req.headers.get('origin') || 'https://top10lists.us'}/verify-listing/${token}`,
        token: token
      });
    }

    // Update agents with new tokens
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('professionals')
          .update({
            verification_token: update.verification_token,
            verification_token_expires_at: update.verification_token_expires_at,
            verification_started_at: update.verification_started_at
          })
          .eq('id', update.id);

        if (updateError) {
          console.error('Error updating agent:', update.id, updateError);
        }
      }
    }

    console.log(`✅ Generated ${links.length} verification links, updated ${updates.length} tokens`);

    return new Response(
      JSON.stringify({
        success: true,
        links,
        generated: updates.length,
        total: links.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-verification-links:', error);
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