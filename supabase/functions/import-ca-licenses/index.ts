import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { csvData, startLine = 0, batchSize = 1000 } = await req.json();
    
    if (!csvData) {
      return new Response(
        JSON.stringify({ error: 'csvData is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing CA licenses starting at line ${startLine}, batch size ${batchSize}`);

    // Parse CSV
    const lines = csvData.split('\n');
    const header = lines[0].split(',');
    
    // Find column indices
    const firstNameIdx = header.indexOf('first_name');
    const lastNameIdx = header.indexOf('last_name');
    const licenseNumberIdx = header.indexOf('license_number');
    const licenseTypeIdx = header.indexOf('license_type');
    const cityIdx = header.indexOf('city');
    const licenseDateIdx = header.indexOf('license_date');

    // Calculate cutoff date (40 years ago from today)
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 40);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log(`Filtering out licenses before ${cutoffDateStr} (40+ years)`);

    const records: any[] = [];
    let skippedTooOld = 0;
    let skippedInvalid = 0;

    // Process lines (skip header)
    const endLine = Math.min(startLine + batchSize, lines.length);
    for (let i = startLine === 0 ? 1 : startLine; i < endLine; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // Simple CSV parsing (handles basic cases)
      const parts = line.split(',');
      if (parts.length < 6) {
        skippedInvalid++;
        continue;
      }

      const firstName = parts[firstNameIdx]?.trim() || '';
      const lastName = parts[lastNameIdx]?.trim() || '';
      const licenseNumber = parts[licenseNumberIdx]?.trim() || '';
      const licenseType = parts[licenseTypeIdx]?.trim() || '';
      const city = parts[cityIdx]?.trim() || '';
      const licenseDate = parts[licenseDateIdx]?.trim() || '';

      if (!licenseNumber || !firstName) {
        skippedInvalid++;
        continue;
      }

      // Filter out licenses older than 40 years
      if (licenseDate && licenseDate < cutoffDateStr) {
        skippedTooOld++;
        continue;
      }

      const name = `${firstName} ${lastName}`.trim();

      records.push({
        license_number: licenseNumber,
        name: name,
        state: 'CA',
        city: city || null,
        license_type: licenseType || null,
      });
    }

    console.log(`Prepared ${records.length} records, skipped ${skippedTooOld} (too old), ${skippedInvalid} (invalid)`);

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted: 0, 
          skippedTooOld,
          skippedInvalid,
          nextLine: endLine,
          hasMore: endLine < lines.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert in chunks of 500 to avoid payload limits
    const chunkSize = 500;
    let totalInserted = 0;
    let totalErrors = 0;

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      
      const { data, error } = await supabase
        .from('state_licenses')
        .upsert(chunk, { 
          onConflict: 'license_number,state',
          ignoreDuplicates: true 
        });

      if (error) {
        console.error(`Error inserting chunk ${i / chunkSize}:`, error.message);
        totalErrors += chunk.length;
      } else {
        totalInserted += chunk.length;
      }
    }

    console.log(`Inserted ${totalInserted} records, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: totalInserted,
        errors: totalErrors,
        skippedTooOld,
        skippedInvalid,
        nextLine: endLine,
        hasMore: endLine < lines.length,
        totalLines: lines.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error importing CA licenses:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
