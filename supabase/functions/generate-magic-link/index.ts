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
    // Hardcoded base URL - MUST use www per project requirements
    const appUrl = 'https://www.top10lists.us';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { professional_id } = await req.json();

    if (!professional_id) {
      throw new Error('professional_id is required');
    }

    console.log('🔗 Generating magic link for professional:', professional_id);

    // Helper function to extract last 4 digits from phone
    const getLastFourDigits = (phone: string | null): string | null => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, '');
      return digits.length >= 4 ? digits.slice(-4) : null;
    };

    // Generate name slug (firstname-lastname)
    const generateNameSlug = (name: string | null): string | null => {
      if (!name) return null;
      return name
        .toLowerCase()
        .replace(/[^a-z\s-]/g, '') // Remove non-alpha chars except spaces and hyphens
        .trim()
        .replace(/\s+/g, '-'); // Replace spaces with hyphens
    };

    // Fetch professional with city info (including state_slug for dynamic URL generation)
    const { data: existing, error: fetchError } = await supabase
      .from('professionals')
      .select(`
        verification_token,
        verification_token_expires_at,
        profile_link,
        name,
        email,
        phone,
        cities:city_id (slug, state_slug)
      `)
      .eq('id', professional_id)
      .single();

    if (fetchError) throw fetchError;

    let token = existing.verification_token;
    let profileLink = existing.profile_link;

    // Get city slug, state slug, and phone digits for SEO-friendly format
    const cityData = existing.cities as any;
    const citySlug = cityData?.slug;
    const stateSlug = cityData?.state_slug;
    const phoneDigits = getLastFourDigits(existing.phone);
    const nameSlug = generateNameSlug(existing.name);

    // Check if token exists and is valid (not expired or will expire before 2050)
    const hasValidToken = token && existing.verification_token_expires_at &&
      new Date(existing.verification_token_expires_at) > new Date('2050-01-01');

    // Generate the SEO-friendly profile link: /{state}/agents/{firstname-lastname-1234}
    // Short codes are deprecated — fallback to magic link (dashboard URL) if data is incomplete
    const generateSEOLink = (currentToken: string) => {
      if (stateSlug && nameSlug && phoneDigits) {
        return `${appUrl}/${stateSlug}/agents/${nameSlug}-${phoneDigits}`;
      }
      // Fallback to magic link (dashboard URL) instead of deprecated /p/ short codes
      console.log('⚠️ Missing data for SEO link, using magic link fallback:', { stateSlug, nameSlug, phoneDigits });
      return `${appUrl}/dashboard/${currentToken}`;
    };

    // Need token before we can generate fallback link
    if (!hasValidToken) {
      token = crypto.randomUUID();
    }
    const expectedProfileLink = generateSEOLink(token);

    if (!hasValidToken || profileLink !== expectedProfileLink) {
      if (!hasValidToken) {
        console.log('🆕 Creating new permanent token');
      }

      const permanentExpiry = new Date('2099-12-31T23:59:59Z');
      profileLink = expectedProfileLink;

      console.log('📝 Updating profile with SEO link:', profileLink);

      const magicLinkUrl = `${appUrl}/dashboard/${token}`;
      const { error: updateError } = await supabase
        .from('professionals')
        .update({
          verification_token: token,
          verification_token_expires_at: permanentExpiry.toISOString(),
          verification_started_at: new Date().toISOString(),
          profile_link: profileLink,
          magic_link: magicLinkUrl,
        })
        .eq('id', professional_id);

      if (updateError) throw updateError;
    } else {
      console.log('♻️ Reusing existing token and link');
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        profile_link: profileLink,
        magic_link: `${appUrl}/dashboard/${token}`,
        professional_name: existing.name,
        is_new_token: !hasValidToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error generating magic link:', error);
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