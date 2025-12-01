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

    const { email, phone, licenseNumber, zillowLink } = await req.json();
    console.log('🔍 Looking up agent:', { email, phone, licenseNumber, zillowLink });

    // Normalize phone: extract last 10 digits
    const normalizePhone = (p: string) => {
      if (!p) return null;
      const digits = p.replace(/\D/g, '');
      return digits.length >= 10 ? digits.slice(-10) : null;
    };

    // Extract Zillow profile slug from URL
    const extractZillowSlug = (url: string) => {
      if (!url) return null;
      const match = url.match(/zillow\.com\/profile\/([^\/\?]+)/);
      return match ? match[1] : null;
    };

    const normalizedPhone = normalizePhone(phone);
    const zillowSlug = extractZillowSlug(zillowLink);

    console.log('📝 Normalized search params:', { normalizedPhone, zillowSlug });

    // Build query with OR conditions - select all fields for ProfessionalCard
    let query = supabase
      .from('professionals')
      .select('*')
      .eq('active', true)
      .limit(1);

    // Apply filters - try to match any of the provided fields
    const orConditions: string[] = [];
    
    if (email) {
      orConditions.push(`email.ilike.%${email}%`);
    }
    
    if (normalizedPhone) {
      orConditions.push(`phone.ilike.%${normalizedPhone}%`);
    }
    
    if (licenseNumber) {
      orConditions.push(`license_number.ilike.%${licenseNumber}%`);
    }
    
    if (zillowSlug) {
      orConditions.push(`zillow_profile_url.ilike.%${zillowSlug}%`);
    }

    if (orConditions.length === 0) {
      return new Response(
        JSON.stringify({ found: false, error: 'No search criteria provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    query = query.or(orConditions.join(','));

    const { data, error } = await query;

    if (error) {
      console.error('❌ Lookup error:', error);
      throw error;
    }

    if (data && data.length > 0) {
      const agent = data[0];
      console.log('✅ Agent found:', agent.name);
      
      // Generate or use existing verification token
      let token = agent.verification_token;
      
      if (!token) {
        // Generate new token
        token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry
        
        await supabase
          .from('professionals')
          .update({
            verification_token: token,
            verification_token_expires_at: expiresAt.toISOString(),
            verification_started_at: new Date().toISOString(),
          })
          .eq('id', agent.id);
        
        console.log('🔑 Generated new verification token');
      }

      return new Response(
        JSON.stringify({
          found: true,
          token,
          name: agent.name,
          professional: agent,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('❌ Agent not found');
    return new Response(
      JSON.stringify({ found: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error in lookup-agent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ found: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
