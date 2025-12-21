import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvData, state, startLine, endLine } = await req.json();

    if (!csvData || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing csvData or state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${state} licenses from line ${startLine} to ${endLine}`);

    const lines = csvData.split('\n').filter((line: string) => line.trim());
    const headers = parseCSVLine(lines[0]).map((h: string) => h.toLowerCase().trim());
    
    console.log(`Headers found: ${headers.join(', ')}`);

    // Find column indices
    const stateIdx = headers.indexOf('state');
    const licenseIdx = headers.indexOf('license_number');
    const nameIdx = headers.indexOf('name');
    const cityIdx = headers.indexOf('city');
    const typeIdx = headers.indexOf('license_type');

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const batchSize = 500;
    let batch: any[] = [];

    const start = startLine || 1;
    const end = endLine || lines.length;

    for (let i = start; i < end && i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const values = parseCSVLine(line);
        
        const record = {
          state: stateIdx >= 0 ? values[stateIdx]?.trim() : state,
          license_number: values[licenseIdx]?.trim().replace(/"/g, ''),
          name: values[nameIdx]?.trim().replace(/"/g, ''),
          city: cityIdx >= 0 ? values[cityIdx]?.trim().replace(/"/g, '') : null,
          license_type: typeIdx >= 0 ? values[typeIdx]?.trim().replace(/"/g, '') : null,
        };

        // Skip if no license number or name
        if (!record.license_number || !record.name) {
          skipped++;
          continue;
        }

        batch.push(record);

        if (batch.length >= batchSize) {
          const { error: upsertError } = await supabase
            .from('state_licenses')
            .upsert(batch, { 
              onConflict: 'state,license_number',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error(`Batch upsert error: ${upsertError.message}`);
            errors += batch.length;
          } else {
            imported += batch.length;
          }
          batch = [];
          
          console.log(`Progress: ${imported} imported, ${skipped} skipped, ${errors} errors`);
        }
      } catch (lineError) {
        console.error(`Error parsing line ${i}: ${lineError}`);
        errors++;
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      const { error: upsertError } = await supabase
        .from('state_licenses')
        .upsert(batch, { 
          onConflict: 'state,license_number',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error(`Final batch upsert error: ${upsertError.message}`);
        errors += batch.length;
      } else {
        imported += batch.length;
      }
    }

    console.log(`${state} import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        state,
        imported, 
        skipped, 
        errors,
        linesProcessed: end - start
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
