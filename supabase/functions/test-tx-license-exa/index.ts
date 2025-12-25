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
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    if (!EXA_API_KEY) {
      throw new Error('EXA_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 3;

    // Get Texas licenses without city info
    const { data: licenses, error: dbError } = await supabase
      .from('state_licenses')
      .select('id, name, license_number, license_type')
      .eq('state', 'TX')
      .is('city', null)
      .limit(limit);

    if (dbError) throw dbError;

    console.log(`Testing Exa with ${licenses?.length || 0} TX licenses`);

    const results = [];

    for (const lic of licenses || []) {
      // Build search query with name and license number
      const searchQuery = `"${lic.name}" Texas real estate license ${lic.license_number}`;
      
      console.log(`\n--- Searching for: ${lic.name} (${lic.license_number}) ---`);
      console.log(`Query: ${searchQuery}`);

      const startTime = Date.now();

      // Exa.ai search
      const exaResponse = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'x-api-key': EXA_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          useAutoprompt: true,
          numResults: 10,
          type: 'auto',
          contents: {
            text: { maxCharacters: 2000 },
            highlights: true,
          },
        }),
      });

      const elapsed = Date.now() - startTime;

      if (!exaResponse.ok) {
        const errorText = await exaResponse.text();
        console.error(`Exa API error for ${lic.name}:`, exaResponse.status, errorText);
        results.push({
          name: lic.name,
          license_number: lic.license_number,
          success: false,
          error: `${exaResponse.status}: ${errorText}`,
          elapsed_ms: elapsed,
        });
        continue;
      }

      const exaData = await exaResponse.json();
      
      // Look for city mentions in results
      const nameLower = lic.name.toLowerCase();
      let foundCity: string | null = null;
      const matchedUrls: string[] = [];

      // Texas cities to look for
      const txCities = [
        'Houston', 'Dallas', 'San Antonio', 'Austin', 'Fort Worth', 
        'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo',
        'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie',
        'McKinney', 'Frisco', 'Brownsville', 'Pasadena', 'Mesquite',
        'Killeen', 'McAllen', 'Waco', 'Denton', 'Carrollton',
        'Midland', 'Abilene', 'Beaumont', 'Round Rock', 'Odessa',
        'The Woodlands', 'Sugar Land', 'Pearland', 'College Station',
        'League City', 'Tyler', 'Allen', 'Edinburg', 'Lewisville',
        'San Marcos', 'Temple', 'Flower Mound', 'New Braunfels',
        'Conroe', 'Harlingen', 'Victoria', 'Georgetown', 'Cedar Park',
        'Richardson', 'Katy', 'Spring', 'Humble', 'Baytown'
      ];

      for (const result of exaData.results || []) {
        const content = ((result.text || '') + ' ' + (result.title || '') + ' ' + (result.url || '')).toLowerCase();
        
        // Check if this result is about our agent
        if (!content.includes(nameLower.split(' ')[0]) || !content.includes(nameLower.split(' ').slice(-1)[0])) {
          continue;
        }

        matchedUrls.push(result.url);

        // Look for Texas city in content
        for (const city of txCities) {
          if (content.includes(city.toLowerCase()) && content.includes('texas') || content.includes(', tx')) {
            foundCity = city;
            console.log(`Found city: ${city} in ${result.url}`);
            break;
          }
        }
        
        if (foundCity) break;
      }

      console.log(`Results: ${exaData.results?.length || 0}, Matched: ${matchedUrls.length}, Found city: ${foundCity || 'NONE'}`);

      results.push({
        name: lic.name,
        license_number: lic.license_number,
        license_type: lic.license_type,
        success: true,
        total_results: exaData.results?.length || 0,
        matched_results: matchedUrls.length,
        found_city: foundCity,
        matched_urls: matchedUrls.slice(0, 3),
        elapsed_ms: elapsed,
        raw_titles: (exaData.results || []).slice(0, 5).map((r: any) => r.title),
      });
    }

    return new Response(JSON.stringify({
      summary: {
        tested: results.length,
        found_city: results.filter(r => r.found_city).length,
      },
      results,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-tx-license-exa:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
