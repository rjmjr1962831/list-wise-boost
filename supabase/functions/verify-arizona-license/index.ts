import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LicenseRecord {
  LastName: string;
  FirstName: string;
  MiddleName: string;
  OriginalDate: string;
  LicNumber: string;
  LicType: string;
  EmployerLegalName: string;
}

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

    // Fetch the CSV file from the public folder
    // In production, this will be served from the CDN
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/supabase', '') || '';
    const csvUrl = `${baseUrl}/arizona-licenses.csv`;
    
    console.log(`Fetching CSV from: ${csvUrl}`);
    const csvResponse = await fetch(csvUrl);
    
    if (!csvResponse.ok) {
      console.error('Failed to fetch CSV file');
      throw new Error('Failed to fetch license database');
    }

    const csvText = await csvResponse.text();
    const lines = csvText.split('\n');
    
    // Skip header row
    let foundRecord: LicenseRecord | null = null;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Parse CSV line (handle quoted fields)
      const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(field => 
        field.replace(/^"|"$/g, '').trim()
      );
      
      if (!fields || fields.length < 5) continue;
      
      const recordLicense = fields[4]?.trim();
      
      // Check if license number matches (normalize by removing spaces and padding)
      if (recordLicense && recordLicense.replace(/\s/g, '') === licenseNumber.replace(/\s/g, '')) {
        foundRecord = {
          LastName: fields[0],
          FirstName: fields[1],
          MiddleName: fields[2],
          OriginalDate: fields[3],
          LicNumber: fields[4],
          LicType: fields[5],
          EmployerLegalName: fields[6] || '',
        };
        break;
      }
    }

    if (foundRecord) {
      console.log('License found in database:', foundRecord);
      
      // Calculate years of experience from OriginalDate
      const originalDate = new Date(foundRecord.OriginalDate);
      const currentDate = new Date();
      const yearsExperience = currentDate.getFullYear() - originalDate.getFullYear();
      
      console.log(`Calculated ${yearsExperience} years of experience from ${foundRecord.OriginalDate}`);
      
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
          originalDate: foundRecord.OriginalDate,
          licenseType: foundRecord.LicType,
          employer: foundRecord.EmployerLegalName,
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
