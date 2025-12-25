import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Texas cities for validation
const TX_CITIES = [
  'Houston', 'Dallas', 'San Antonio', 'Austin', 'Fort Worth', 'El Paso',
  'Arlington', 'Corpus Christi', 'Plano', 'Laredo', 'Lubbock', 'Garland',
  'Irving', 'Amarillo', 'Grand Prairie', 'McKinney', 'Frisco', 'Brownsville',
  'Pasadena', 'Mesquite', 'Killeen', 'McAllen', 'Waco', 'Denton', 'Carrollton',
  'Midland', 'Abilene', 'Beaumont', 'Round Rock', 'Odessa', 'The Woodlands',
  'Sugar Land', 'Pearland', 'College Station', 'League City', 'Tyler', 'Allen',
  'Edinburg', 'Lewisville', 'San Marcos', 'Temple', 'Flower Mound', 'New Braunfels',
  'Conroe', 'Harlingen', 'Victoria', 'Georgetown', 'Cedar Park', 'Richardson',
  'Katy', 'Spring', 'Humble', 'Baytown', 'Lakeway', 'Pflugerville', 'Kyle',
  'Mansfield', 'Rowlett', 'Euless', 'DeSoto', 'Grapevine', 'Bedford', 'Cedar Hill',
  'Wylie', 'Haltom City', 'Keller', 'Coppell', 'Rockwall', 'Huntsville', 'Texarkana',
  'Hurst', 'Duncanville', 'Sherman', 'The Colony', 'Burleson', 'Lufkin', 'Wichita Falls',
  'San Angelo', 'Southlake', 'Weatherford', 'Friendswood', 'Colleyville', 'Cleburne'
];

function extractCity(results: any[]): string | null {
  // Combine all text from results
  const allText = results.map(r => 
    `${r.title || ''} ${r.text || ''} ${(r.highlights || []).join(' ')}`
  ).join(' ');
  
  // First: Check if any known TX city appears in the text
  for (const city of TX_CITIES) {
    // Look for city name followed by TX or Texas
    const patterns = [
      new RegExp(`\\b${city},?\\s*TX\\b`, 'i'),
      new RegExp(`\\b${city},?\\s*Texas\\b`, 'i'),
      new RegExp(`in\\s+${city}\\b`, 'i'),
      new RegExp(`${city}\\s+area\\b`, 'i'),
      new RegExp(`${city}\\s+real\\s+estate`, 'i')
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(allText)) {
        console.log(`Matched pattern for ${city}`);
        return city;
      }
    }
  }
  
  // Fallback: Look for "City, TX" pattern but ONLY return if it's a known city
  const pattern = /\b([A-Z][a-zA-Z\s]+),?\s*(?:TX|Texas)\b/gi;
  const matches = allText.match(pattern);
  
  if (matches && matches.length > 0) {
    for (const match of matches) {
      const cityName = match.replace(/,?\s*(?:TX|Texas)$/i, '').trim();
      
      // ONLY return if it's in our known cities list
      const foundCity = TX_CITIES.find(c => 
        c.toLowerCase() === cityName.toLowerCase()
      );
      
      if (foundCity) {
        return foundCity;
      }
    }
  }
  
  return null;
}

// Track which API key to use (alternates between calls)
let apiKeyIndex = 0;

function getNextApiKey(): string {
  const keys = [
    Deno.env.get('EXA_API_KEY'),
    Deno.env.get('EXA_API_KEY_2')
  ].filter(Boolean) as string[];
  
  if (keys.length === 0) {
    throw new Error('No EXA API keys configured');
  }
  
  const key = keys[apiKeyIndex % keys.length];
  apiKeyIndex++;
  console.log(`Using API key ${(apiKeyIndex - 1) % keys.length + 1} of ${keys.length}`);
  return key;
}

async function findAgentCity(
  agentName: string, 
  licenseNumber: string
): Promise<string | null> {
  const exaApiKey = getNextApiKey();
  
  // Query format that works: "[license]" Texas real estate [name]
  const query = `"${licenseNumber}" Texas real estate ${agentName}`;
  
  console.log(`Exa query: ${query}`);
  
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': exaApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query,
      type: 'auto',
      numResults: 5,
      contents: {
        text: { maxCharacters: 500 },
        highlights: true
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Exa API error: ${response.status}`, errorText);
    throw new Error(`Exa API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.results || data.results.length === 0) {
    console.log(`No results for ${agentName}`);
    return null;
  }
  
  console.log(`Got ${data.results.length} results`);
  
  // Extract city from results
  const city = extractCity(data.results);
  console.log(`Extracted city: ${city}`);
  return city;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    const EXA_API_KEY_2 = Deno.env.get('EXA_API_KEY_2');
    
    if (!EXA_API_KEY && !EXA_API_KEY_2) {
      throw new Error('No EXA API keys configured');
    }
    
    const keyCount = [EXA_API_KEY, EXA_API_KEY_2].filter(Boolean).length;
    console.log(`Using ${keyCount} Exa API key(s) for load balancing`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 3;

    // Get Texas licenses without city info
    const { data: licenses, error: dbError } = await supabase
      .from('state_licenses')
      .select('id, name, license_number')
      .eq('state', 'TX')
      .is('city', null)
      .limit(limit);

    if (dbError) throw dbError;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`FINDING CITIES FOR ${licenses?.length || 0} TX AGENTS`);
    console.log(`${'='.repeat(50)}`);

    const results = [];

    for (const lic of licenses || []) {
      console.log(`\n--- ${lic.name} (${lic.license_number}) ---`);
      
      try {
        const city = await findAgentCity(lic.name, lic.license_number);
        
        if (city) {
          // Update the database
          const { error: updateError } = await supabase
            .from('state_licenses')
            .update({ city: city })
            .eq('id', lic.id);

          if (updateError) {
            console.error(`Failed to update ${lic.name}:`, updateError);
            results.push({
              name: lic.name,
              license: lic.license_number,
              city: city,
              saved: false,
              error: updateError.message
            });
          } else {
            console.log(`✓ Saved city: ${city}`);
            results.push({
              name: lic.name,
              license: lic.license_number,
              city: city,
              saved: true
            });
          }
        } else {
          console.log(`✗ No city found`);
          results.push({
            name: lic.name,
            license: lic.license_number,
            city: null,
            saved: false
          });
        }
        
      } catch (error) {
        console.error(`Error for ${lic.name}:`, error);
        results.push({
          name: lic.name,
          license: lic.license_number,
          city: null,
          saved: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const found = results.filter(r => r.city).length;
    const saved = results.filter(r => r.saved).length;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`COMPLETE: Found ${found}/${results.length} cities, saved ${saved}`);
    console.log(`${'='.repeat(50)}`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        processed: results.length,
        citiesFound: found,
        saved: saved
      },
      results
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
