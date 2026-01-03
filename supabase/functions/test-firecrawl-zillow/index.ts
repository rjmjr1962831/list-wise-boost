import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgentResult {
  zillowUrl: string | null;
  licenseFound: string | null;
  licenseMatch: boolean;
  rating: number | null;
  reviews: number | null;
  name: string | null;
  exaRating: number | null;
  exaReviews: number | null;
}

// Step 1: Use Exa to find Zillow URL (it's good at finding profiles)
async function findZillowWithExa(
  name: string,
  city: string,
  stateAbbr: string,
  exaApiKey: string
): Promise<{ url: string | null; rating: number | null; reviews: number | null }> {
  const searchQuery = `${name} Zillow real estate agent ${city} ${stateAbbr}`;
  console.log(`[${name}] Exa search: "${searchQuery}"`);

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${exaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        numResults: 5,
        type: 'neural',
        useAutoprompt: true,
        includeDomains: ['zillow.com'],
      }),
    });

    if (!response.ok) {
      console.error(`[${name}] Exa error: ${await response.text()}`);
      return { url: null, rating: null, reviews: null };
    }

    const data = await response.json();
    
    // Find first Zillow profile URL
    const zillowResult = data.results?.find((r: any) => 
      r.url?.includes('zillow.com/profile/')
    );

    if (!zillowResult) {
      console.log(`[${name}] No Zillow profile found in Exa results`);
      return { url: null, rating: null, reviews: null };
    }

    console.log(`[${name}] Exa found: ${zillowResult.url}`);
    
    // Try to extract rating/reviews from Exa title/snippet
    let rating = null;
    let reviews = null;
    const title = zillowResult.title || '';
    const ratingMatch = title.match(/(\d+(?:\.\d+)?)\s*(?:stars?|rating)/i);
    const reviewMatch = title.match(/(\d+)\s*reviews?/i);
    if (ratingMatch) rating = parseFloat(ratingMatch[1]);
    if (reviewMatch) reviews = parseInt(reviewMatch[1], 10);

    return { url: zillowResult.url, rating, reviews };
  } catch (error) {
    console.error(`[${name}] Exa error:`, error);
    return { url: null, rating: null, reviews: null };
  }
}

// Step 2: Use Firecrawl to scrape profile and verify license
async function verifyLicenseWithFirecrawl(
  name: string,
  zillowUrl: string,
  expectedLicense: string,
  firecrawlApiKey: string
): Promise<{ licenseFound: string | null; licenseMatch: boolean; rating: number | null; reviews: number | null; agentName: string | null }> {
  console.log(`[${name}] Scraping ${zillowUrl} with Firecrawl`);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: zillowUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
      }),
    });

    if (!response.ok) {
      console.error(`[${name}] Firecrawl error: ${await response.text()}`);
      return { licenseFound: null, licenseMatch: false, rating: null, reviews: null, agentName: null };
    }

    const data = await response.json();
    const html = data.data?.html || '';
    const markdown = data.data?.markdown || '';

    // Extract license numbers - look for 6-10 digit numbers after license indicators
    const foundLicenses: string[] = [];
    const patterns = [
      /(?:License|DRE|Lic)[\s#.:]*(\d{6,10})/gi,
      /(?:Cal\s*BRE|CA\s*DRE)[\s#.:]*(\d{6,10})/gi,
    ];

    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern), ...markdown.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] && !foundLicenses.includes(match[1])) {
          foundLicenses.push(match[1]);
        }
      }
    }

    console.log(`[${name}] Found licenses: ${foundLicenses.join(', ') || 'none'}`);

    // Check for match
    const normalizedExpected = expectedLicense.replace(/\D/g, '');
    let licenseMatch = false;
    let licenseFound: string | null = null;

    for (const lic of foundLicenses) {
      if (lic === normalizedExpected) {
        licenseMatch = true;
        licenseFound = lic;
        console.log(`[${name}] ✅ LICENSE MATCH: ${lic}`);
        break;
      }
    }

    if (!licenseMatch && foundLicenses.length > 0) {
      licenseFound = foundLicenses[0];
      console.log(`[${name}] ❌ LICENSE MISMATCH: expected ${expectedLicense}, found ${foundLicenses.join(', ')}`);
    }

    // Extract rating and reviews
    let rating = null;
    let reviews = null;
    let agentName = null;

    const ratingMatch = markdown.match(/(\d+(?:\.\d+)?)\s*(?:out of 5|stars?)/i) ||
                        html.match(/"ratingValue"[:\s]*"?(\d+(?:\.\d+)?)/i);
    if (ratingMatch) rating = parseFloat(ratingMatch[1]);

    const reviewMatch = markdown.match(/(\d+(?:,\d+)?)\s*reviews?/i) ||
                        html.match(/"reviewCount"[:\s]*"?(\d+)/i);
    if (reviewMatch) reviews = parseInt(reviewMatch[1].replace(',', ''), 10);

    const nameMatch = markdown.match(/^#\s*(.+?)(?:\n|$)/m);
    if (nameMatch) agentName = nameMatch[1].trim();

    return { licenseFound, licenseMatch, rating, reviews, agentName };
  } catch (error) {
    console.error(`[${name}] Firecrawl error:`, error);
    return { licenseFound: null, licenseMatch: false, rating: null, reviews: null, agentName: null };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!EXA_API_KEY) throw new Error('EXA_API_KEY not configured');
    if (!FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not configured');

    // Test with 3 California agents
    const testAgents = [
      { name: 'Ali Pavahnejad', city: 'Glendale', state: 'CA', license: '1309678' },
      { name: 'Adam Prado', city: 'Venice', state: 'CA', license: '2118848' },
      { name: 'Alejandro Saavedra', city: 'Virginia Beach', state: 'CA', license: '1710253' },
    ];

    const results: any[] = [];

    for (const agent of testAgents) {
      console.log(`\n========== Processing: ${agent.name} ==========`);
      const startTime = Date.now();
      
      const result: AgentResult = {
        zillowUrl: null,
        licenseFound: null,
        licenseMatch: false,
        rating: null,
        reviews: null,
        name: null,
        exaRating: null,
        exaReviews: null,
      };

      // Step 1: Find Zillow URL with Exa
      const exaResult = await findZillowWithExa(agent.name, agent.city, agent.state, EXA_API_KEY);
      result.zillowUrl = exaResult.url;
      result.exaRating = exaResult.rating;
      result.exaReviews = exaResult.reviews;

      // Step 2: Verify license with Firecrawl (only if we found a URL)
      if (exaResult.url) {
        const fcResult = await verifyLicenseWithFirecrawl(
          agent.name,
          exaResult.url,
          agent.license,
          FIRECRAWL_API_KEY
        );
        result.licenseFound = fcResult.licenseFound;
        result.licenseMatch = fcResult.licenseMatch;
        result.rating = fcResult.rating || exaResult.rating;
        result.reviews = fcResult.reviews || exaResult.reviews;
        result.name = fcResult.agentName;
      }

      const elapsed = Date.now() - startTime;
      
      results.push({
        input: agent,
        result,
        elapsedMs: elapsed,
      });

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const summary = {
      total: results.length,
      foundZillow: results.filter(r => r.result.zillowUrl).length,
      licenseMatches: results.filter(r => r.result.licenseMatch).length,
      avgTimeMs: Math.round(results.reduce((sum, r) => sum + r.elapsedMs, 0) / results.length),
    };

    return new Response(
      JSON.stringify({ success: true, summary, results }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
