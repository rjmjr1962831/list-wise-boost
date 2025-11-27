import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// LicenseRecord interface is no longer needed - we query the database directly

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { professionalId, licenseNumber } = await req.json();

    if (!professionalId || !licenseNumber) {
      throw new Error('Missing professionalId or licenseNumber');
    }

    console.log(`Verifying license ${licenseNumber} for professional ${professionalId}`);

    // Normalize license number for database query (remove spaces, uppercase)
    const normalizedLicense = licenseNumber.replace(/\s/g, '').toUpperCase();
    console.log(`Querying database for normalized license: ${normalizedLicense}`);

    // Query the arizona_licenses table directly (indexed for fast lookup)
    const { data: foundRecord, error: queryError } = await supabaseClient
      .from('arizona_licenses')
      .select('*')
      .eq('license_number', normalizedLicense)
      .maybeSingle();

    if (queryError) {
      console.error('Error querying Arizona licenses database:', queryError);
      throw queryError;
    }

    if (foundRecord) {
      console.log('✅ License found in database:', foundRecord);
      
      // Calculate years of experience from original_date
      const originalDate = new Date(foundRecord.original_date);
      const currentDate = new Date();
      const yearsExperience = currentDate.getFullYear() - originalDate.getFullYear();
      
      console.log(`Calculated ${yearsExperience} years of experience from ${foundRecord.original_date}`);
      
      // Update professional record with verified data
      const { data: professional, error: fetchError } = await supabaseClient
        .from('professionals')
        .select('years_experience, badges')
        .eq('id', professionalId)
        .single();
      
      if (fetchError) {
        console.error('Error fetching professional:', fetchError);
        throw fetchError;
      }
      
      // Add "License Verified" badge if not already present
      const badges = professional?.badges || [];
      if (!badges.includes('License Verified')) {
        badges.push('License Verified');
      }
      
      // Update professional with verified years of experience
      const { error: updateError } = await supabaseClient
        .from('professionals')
        .update({
          years_experience: yearsExperience,
          license_verified_at: new Date().toISOString(),
          badges: badges,
        })
        .eq('id', professionalId);
      
      if (updateError) {
        console.error('Error updating professional:', updateError);
        throw updateError;
      }
      
      return new Response(
        JSON.stringify({
          verified: true,
          yearsExperience,
          originalDate: foundRecord.original_date,
          licenseType: foundRecord.license_type,
          employer: foundRecord.employer_legal_name,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('License not found in database, keeping memo23 data');
      
      // License not found, keep existing data but don't add verification badge
      return new Response(
        JSON.stringify({
          verified: false,
          message: 'License not found in Arizona database',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in verify-arizona-license:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
