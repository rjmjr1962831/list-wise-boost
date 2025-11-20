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
    const { professionalId } = await req.json();

    if (!professionalId) {
      throw new Error('professionalId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the professional's email
    const { data: professional, error: fetchError } = await supabase
      .from('professionals')
      .select('email, email_verified_at')
      .eq('id', professionalId)
      .single();

    if (fetchError || !professional) {
      throw new Error('Professional not found');
    }

    if (!professional.email) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No email to verify',
          verified: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip if already verified
    if (professional.email_verified_at) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email already verified',
          verified: true,
          verifiedAt: professional.email_verified_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(professional.email);

    if (!isValidFormat) {
      console.log(`Invalid email format for professional ${professionalId}: ${professional.email}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid email format',
          verified: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for common invalid domains
    const domain = professional.email.split('@')[1].toLowerCase();
    const invalidDomains = ['test.com', 'example.com', 'fake.com', 'invalid.com'];
    
    if (invalidDomains.includes(domain)) {
      console.log(`Invalid email domain for professional ${professionalId}: ${domain}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid email domain',
          verified: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For now, mark as verified if it passes basic validation
    // In production, you could integrate with a service like:
    // - AbstractAPI Email Validation
    // - Hunter.io Email Verifier
    // - ZeroBounce
    // - NeverBounce
    
    const verifiedAt = new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from('professionals')
      .update({ 
        email_verified_at: verifiedAt
      })
      .eq('id', professionalId);

    if (updateError) {
      throw updateError;
    }

    console.log(`Email verified for professional ${professionalId}: ${professional.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email verified successfully',
        verified: true,
        verifiedAt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in verify-email:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        verified: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
