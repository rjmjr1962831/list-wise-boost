import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExaResult {
  zillowUrl?: string;
  rating?: number;
  reviewCount?: number;
  resultText?: string;
}

async function searchZillowWithExa(
  name: string,
  city: string,
  stateAbbr: string,
  licenseNumber: string,
  exaApiKey: string
): Promise<ExaResult | null> {
  // Include license number in search query for better matching
  const searchQuery = city 
    ? `"${name}" "${licenseNumber}" real estate agent site:zillow.com/profile`
    : `"${name}" "${licenseNumber}" real estate agent site:zillow.com/profile`;
  
  console.log(`[${name}] Exa search: "${searchQuery}"`);

  try {
    const exaResponse = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${exaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        numResults: 5,
        includeDomains: ['zillow.com'],
        text: true,
      }),
    });

    if (!exaResponse.ok) {
      const errorText = await exaResponse.text();
      console.error(`[${name}] Exa search failed:`, errorText);
      return null;
    }

    const exaData = await exaResponse.json();
    
    if (!exaData.results || exaData.results.length === 0) {
      console.log(`[${name}] No Exa results`);
      return null;
    }

    console.log(`[${name}] Raw Exa results:`, JSON.stringify(exaData.results.slice(0, 2), null, 2));

    // Find Zillow profile URL from search results
    let zillowUrl: string | undefined;
    let resultText: string = '';
    
    for (const result of exaData.results) {
      const url = result.url;
      console.log(`[${name}] Checking URL: ${url}`);
      if (url && url.includes('zillow.com/profile/')) {
        zillowUrl = url;
        resultText = result.text || '';
        break;
      }
    }

    if (!zillowUrl) {
      console.log(`[${name}] No Zillow profile in Exa results. URLs found:`, exaData.results.map((r: any) => r.url));
      return { resultText: exaData.results[0]?.text?.substring(0, 500) };
    }

    console.log(`[${name}] Found Zillow URL via Exa: ${zillowUrl}`);

    // Extract rating and reviews from Exa text
    let rating: number | undefined;
    let reviewCount: number | undefined;

    const ratingPatterns = [
      /(\d+\.?\d*)\s*(?:out of 5|\/5|stars?)/i,
      /rating[:\s]+(\d+\.?\d*)/i,
      /(\d+\.?\d*)\s*\(\d+\s*reviews?\)/i,
    ];
    
    for (const pattern of ratingPatterns) {
      const match = resultText.match(pattern);
      if (match) {
        const parsedRating = parseFloat(match[1]);
        if (parsedRating >= 1 && parsedRating <= 5) {
          rating = parsedRating;
          break;
        }
      }
    }

    const reviewPatterns = [
      /(\d+)\s*reviews?/i,
      /reviews?[:\s]+(\d+)/i,
      /\((\d+)\s*reviews?\)/i,
    ];
    
    for (const pattern of reviewPatterns) {
      const match = resultText.match(pattern);
      if (match) {
        reviewCount = parseInt(match[1], 10);
        break;
      }
    }

    return {
      zillowUrl,
      rating,
      reviewCount,
      resultText: resultText.substring(0, 500),
    };
  } catch (error) {
    console.error(`[${name}] Exa error:`, error);
    return null;
  }
}

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
    const state = body.state || 'CA';
    const limit = body.limit || 10;

    console.log(`Testing Exa Zillow search for ${limit} agents in ${state}`);

    // Get agents needing scraping
    const { data: licenses, error: dbError } = await supabase
      .from('state_licenses')
      .select('id, name, city, state, license_number')
      .eq('state', state)
      .is('zillow_scraped_at', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (dbError) throw dbError;

    console.log(`Found ${licenses?.length || 0} licenses to test`);

    const results = [];

    for (const license of licenses || []) {
      console.log(`\n========== Testing: ${license.name} ==========`);
      
      const startTime = Date.now();
      const exaResult = await searchZillowWithExa(
        license.name,
        license.city || '',
        license.state,
        license.license_number || '',
        EXA_API_KEY
      );
      const elapsed = Date.now() - startTime;

      results.push({
        license_id: license.id,
        name: license.name,
        city: license.city,
        state: license.state,
        license_number: license.license_number,
        elapsed_ms: elapsed,
        zillow_url: exaResult?.zillowUrl || null,
        rating: exaResult?.rating || null,
        review_count: exaResult?.reviewCount || null,
        qualified: (exaResult?.rating || 0) >= 4.8 && (exaResult?.reviewCount || 0) >= 20,
        sample_text: exaResult?.resultText || null,
      });

      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }

    // Summary
    const found = results.filter(r => r.zillow_url).length;
    const qualified = results.filter(r => r.qualified).length;
    const avgTime = Math.round(results.reduce((sum, r) => sum + r.elapsed_ms, 0) / results.length);

    console.log(`\n=== SUMMARY ===`);
    console.log(`Tested: ${results.length}`);
    console.log(`Found Zillow profiles: ${found}`);
    console.log(`Qualified (4.8+/20+): ${qualified}`);
    console.log(`Avg response time: ${avgTime}ms`);

    return new Response(JSON.stringify({
      summary: {
        tested: results.length,
        found_zillow: found,
        qualified: qualified,
        avg_response_ms: avgTime,
      },
      results,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-exa-zillow-search:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
