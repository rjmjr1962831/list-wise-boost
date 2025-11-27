import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting Arizona licenses import...');

    const { csvData } = await req.json();
    
    if (!csvData) {
      throw new Error('CSV data is required');
    }

    // Parse CSV data
    const lines = csvData.split('\n');
    const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
    
    console.log(`Found ${lines.length - 1} license records to import`);

    // Process in smaller batches to avoid CPU timeout
    const batchSize = 500;
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i += batchSize) {
      const batch = [];
      const endIndex = Math.min(i + batchSize, lines.length);

      for (let j = i; j < endIndex; j++) {
        const line = lines[j].trim();
        if (!line) continue;

        const values = line.split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
        
        if (values.length < 8) {
          skipped++;
          continue;
        }

        // Parse date from MM/DD/YYYY H:MM format (extract date part before space)
        let originalDate = null;
        if (values[3]) {
          try {
            const dateOnly = values[3].split(' ')[0]; // Get date part before space
            const [month, day, year] = dateOnly.split('/');
            if (month && day && year && year.length === 4) {
              const m = month.padStart(2, '0');
              const d = day.padStart(2, '0');
              originalDate = `${year}-${m}-${d}`;
            }
          } catch (e) {
            // Skip invalid dates
          }
        }

        batch.push({
          license_number: values[0],
          last_name: values[1] || null,
          first_name: values[2] || null,
          original_date: originalDate,
          license_type: values[4] || null,
          employer_legal_name: values[5] || null,
          employer_phone: values[6] || null,
          mailing_address1: values[7] || null,
          mailing_address2: values[8] || null,
          mailing_city: values[9] || null,
          mailing_state: values[10] || null,
          mailing_zip: values[11] || null,
          mailing_county: values[12] || null,
        });
      }

      if (batch.length > 0) {
        const { error } = await supabase
          .from('arizona_licenses')
          .upsert(batch, { onConflict: 'license_number', ignoreDuplicates: true });

        if (error) {
          console.error(`Error importing batch starting at line ${i}:`, error.message);
          errors += batch.length;
        } else {
          imported += batch.length;
        }
      }

      // Log progress every 5 batches
      if (i % (batchSize * 5) === 0) {
        console.log(`Progress: ${i}/${lines.length} lines processed`);
      }
    }

    console.log(`Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        errors,
        total: lines.length - 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error importing Arizona licenses:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
