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
  // Only use title and url - no contents/highlights needed
  const allText = results.map(r => 
    `${r.title || ''} ${r.url || ''}`
  ).join(' ');
  
  for (const city of TX_CITIES) {
    const patterns = [
      new RegExp(`\\b${city},?\\s*TX\\b`, 'i'),
      new RegExp(`\\b${city},?\\s*Texas\\b`, 'i'),
      new RegExp(`in\\s+${city}\\b`, 'i'),
      new RegExp(`${city}\\s+area\\b`, 'i'),
      new RegExp(`${city}\\s+real\\s+estate`, 'i')
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(allText)) {
        return city;
      }
    }
  }
  
  const pattern = /\b([A-Z][a-zA-Z\s]+),?\s*(?:TX|Texas)\b/gi;
  const matches = allText.match(pattern);
  
  if (matches && matches.length > 0) {
    for (const match of matches) {
      const cityName = match.replace(/,?\s*(?:TX|Texas)$/i, '').trim();
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

// API key management with round-robin
let apiKeyIndex = 0;
let apiKeys: string[] = [];

function initApiKeys() {
  apiKeys = [
    Deno.env.get('EXA_API_KEY'),
    Deno.env.get('EXA_API_KEY_2')
  ].filter(Boolean) as string[];
  
  if (apiKeys.length === 0) {
    throw new Error('No EXA API keys configured');
  }
  console.log(`Initialized ${apiKeys.length} Exa API key(s)`);
}

function getNextApiKey(): string {
  const key = apiKeys[apiKeyIndex % apiKeys.length];
  apiKeyIndex++;
  return key;
}

// Exponential backoff retry
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited (429), wait and retry
      if (response.status === 429) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limited, backing off ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Request failed, backing off ${delay}ms (attempt ${attempt + 1}/${maxRetries}): ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

async function findAgentCity(
  agentName: string, 
  licenseNumber: string
): Promise<string | null> {
  const exaApiKey = getNextApiKey();
  const query = `"${licenseNumber}" Texas real estate ${agentName}`;
  
  const response = await fetchWithRetry('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': exaApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query,
      type: 'auto',
      numResults: 5
      // NO contents/highlights - just basic search results (titles, URLs)
      // This reduces Exa cost by ~66%
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Exa API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.results || data.results.length === 0) {
    return null;
  }
  
  return extractCity(data.results);
}

interface License {
  id: string;
  name: string;
  license_number: string;
}

interface Result {
  name: string;
  license: string;
  city: string | null;
  saved: boolean;
  error?: string;
  marked?: boolean;
}

// Process a single license
async function processLicense(
  lic: License,
  supabase: any
): Promise<Result> {
  try {
    const city = await findAgentCity(lic.name, lic.license_number);
    
    if (city) {
      const { error: updateError } = await supabase
        .from('state_licenses')
        .update({ city: city })
        .eq('id', lic.id);

      if (updateError) {
        console.log(`✗ ${lic.name}: found ${city} but save failed`);
        return {
          name: lic.name,
          license: lic.license_number,
          city: city,
          saved: false,
          error: updateError.message
        };
      } else {
        console.log(`✓ ${lic.name}: ${city}`);
        return {
          name: lic.name,
          license: lic.license_number,
          city: city,
          saved: true
        };
      }
    } else {
      // Mark as NOT_FOUND so we don't retry this agent
      const { error: updateError } = await supabase
        .from('state_licenses')
        .update({ city: 'NOT_FOUND' })
        .eq('id', lic.id);
      
      console.log(`- ${lic.name}: no city found (marked)`);
      return {
        name: lic.name,
        license: lic.license_number,
        city: null,
        saved: false,
        marked: true
      };
    }
  } catch (error) {
    console.log(`✗ ${lic.name}: error - ${error instanceof Error ? error.message : String(error)}`);
    return {
      name: lic.name,
      license: lic.license_number,
      city: null,
      saved: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Process licenses in batches with concurrency
async function processWithConcurrency(
  licenses: License[],
  supabase: any,
  concurrency: number
): Promise<Result[]> {
  const results: Result[] = [];
  
  for (let i = 0; i < licenses.length; i += concurrency) {
    const batch = licenses.slice(i, i + concurrency);
    console.log(`\nProcessing batch ${Math.floor(i / concurrency) + 1} (${batch.length} agents)...`);
    
    const batchResults = await Promise.all(
      batch.map(lic => processLicense(lic, supabase))
    );
    
    results.push(...batchResults);
    
    // Small delay between batches to be nice to the API
    if (i + concurrency < licenses.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    initApiKeys();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 50;
    const concurrency = body.concurrency || 10;

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
    console.log(`Concurrency: ${concurrency}, API Keys: ${apiKeys.length}`);
    console.log(`${'='.repeat(50)}`);

    const results = await processWithConcurrency(
      licenses || [],
      supabase,
      concurrency
    );

    const found = results.filter(r => r.city).length;
    const saved = results.filter(r => r.saved).length;
    const errors = results.filter(r => r.error).length;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`COMPLETE: Found ${found}/${results.length} cities, saved ${saved}, errors ${errors}`);
    console.log(`${'='.repeat(50)}`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        processed: results.length,
        citiesFound: found,
        saved: saved,
        errors: errors
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
