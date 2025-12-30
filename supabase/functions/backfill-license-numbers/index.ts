/**
 * backfill-license-numbers
 * 
 * Re-scrapes agents missing license numbers using Firecrawl.
 * Priority order:
 * 1. Arizona DRE (arizona_licenses table) - source of truth
 * 2. Zillow profile data - fallback only if not in DRE
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/scrape';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract license number from Zillow markdown/HTML
 * Patterns: "License #: SA123456789", "License #:SA123456789", "License: BR123456"
 */
function extractLicenseFromContent(markdown: string, html: string): string | null {
  // Try markdown first
  const patterns = [
    /(?:License|DRE|BRE)\s*(?:#|Number)\s*:?\s*\n*\s*([A-Z]{0,3}[\d-]+)/i,
    /License\s*#?\s*:?\s*([A-Z]{2}\d{6,})/i,
    /(?:SA|BR|LC|PC)-?\d{6,}/i  // Arizona license format
  ];

  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) {
      const license = match[1] || match[0];
      if (license && license.length >= 6) {
        console.log(`[License] Found in markdown: ${license}`);
        return license.trim();
      }
    }
  }

  // Try HTML if markdown didn't work
  if (html) {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const license = match[1] || match[0];
        if (license && license.length >= 6) {
          console.log(`[License] Found in HTML: ${license}`);
          return license.trim();
        }
      }
    }
  }

  return null;
}

/**
 * Try to find license in Arizona DRE first (source of truth)
 */
async function findLicenseInDRE(
  supabase: any,
  agentName: string
): Promise<string | null> {
  // Parse first and last name
  const nameParts = agentName.trim().split(/\s+/);
  if (nameParts.length < 2) return null;

  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];

  console.log(`[DRE] Searching for: ${firstName} ${lastName}`);

  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('arizona_licenses')
    .select('license_number, first_name, last_name')
    .ilike('first_name', firstName)
    .ilike('last_name', lastName)
    .limit(1)
    .maybeSingle();

  if (exactMatch?.license_number) {
    console.log(`[DRE] Found exact match: ${exactMatch.license_number}`);
    return exactMatch.license_number;
  }

  // Try partial match (first 3 chars of first name)
  if (firstName.length >= 3) {
    const { data: partialMatch } = await supabase
      .from('arizona_licenses')
      .select('license_number, first_name, last_name')
      .ilike('first_name', `${firstName.substring(0, 3)}%`)
      .ilike('last_name', lastName)
      .limit(1)
      .maybeSingle();

    if (partialMatch?.license_number) {
      console.log(`[DRE] Found partial match: ${partialMatch.license_number} (${partialMatch.first_name} ${partialMatch.last_name})`);
      return partialMatch.license_number;
    }
  }

  console.log(`[DRE] No match found for: ${agentName}`);
  return null;
}

/**
 * Scrape Zillow profile for license number using Firecrawl
 */
async function scrapeLicenseFromZillow(zillowUrl: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  console.log(`[Firecrawl] Scraping: ${zillowUrl}`);

  const response = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: zillowUrl,
      formats: ['markdown', 'html'],
      onlyMainContent: false,
      waitFor: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Firecrawl] Error: ${errorText}`);
    return null;
  }

  const result = await response.json();
  if (!result.success) {
    console.log(`[Firecrawl] Scrape failed`);
    return null;
  }

  const markdown = result.data?.markdown || '';
  const html = result.data?.html || '';

  return extractLicenseFromContent(markdown, html);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10, dryRun = false } = await req.json().catch(() => ({}));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find active agents missing license numbers with Zillow URLs
    const { data: agents, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, license_number, zillow_profile_url')
      .eq('active', true)
      .not('zillow_profile_url', 'is', null)
      .or('license_number.is.null,license_number.eq.')
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    console.log(`[Backfill] Found ${agents?.length || 0} agents missing license numbers`);

    const results = {
      total: agents?.length || 0,
      foundInDRE: 0,
      foundInZillow: 0,
      notFound: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const agent of agents || []) {
      try {
        console.log(`\n[Processing] ${agent.name}`);
        
        let licenseNumber: string | null = null;
        let source: string = 'none';

        // Step 1: Try Arizona DRE first (source of truth)
        licenseNumber = await findLicenseInDRE(supabase, agent.name);
        if (licenseNumber) {
          source = 'arizona_dre';
          results.foundInDRE++;
        }

        // Step 2: If not in DRE, try Zillow profile
        if (!licenseNumber && agent.zillow_profile_url) {
          licenseNumber = await scrapeLicenseFromZillow(agent.zillow_profile_url);
          if (licenseNumber) {
            source = 'zillow';
            results.foundInZillow++;
          }
        }

        if (!licenseNumber) {
          results.notFound++;
          results.details.push({
            name: agent.name,
            id: agent.id,
            status: 'not_found',
            source: 'none'
          });
          continue;
        }

        // Update the professional record
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({ 
              license_number: licenseNumber,
              updated_at: new Date().toISOString()
            })
            .eq('id', agent.id);

          if (updateError) {
            console.error(`[Update] Error for ${agent.name}: ${updateError.message}`);
            results.errors++;
            results.details.push({
              name: agent.name,
              id: agent.id,
              status: 'error',
              error: updateError.message
            });
            continue;
          }
        }

        console.log(`[Success] ${agent.name}: ${licenseNumber} (${source})`);
        results.details.push({
          name: agent.name,
          id: agent.id,
          status: 'updated',
          licenseNumber,
          source
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Error] ${agent.name}: ${errorMsg}`);
        results.errors++;
        results.details.push({
          name: agent.name,
          id: agent.id,
          status: 'error',
          error: errorMsg
        });
      }
    }

    console.log(`\n[Complete] DRE: ${results.foundInDRE}, Zillow: ${results.foundInZillow}, Not Found: ${results.notFound}, Errors: ${results.errors}`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Fatal Error]', error);
    return new Response(JSON.stringify({ 
      error: errorMsg,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
