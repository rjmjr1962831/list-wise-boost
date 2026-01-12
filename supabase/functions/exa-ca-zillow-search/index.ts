import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExaSearchResult {
  title: string;
  url: string;
  score: number;
  text?: string; // Content from the page
  highlights?: string[]; // Highlighted excerpts
}

interface ExaResponse {
  results: ExaSearchResult[];
}

/**
 * Extract rating and review count from Zillow page text/highlights
 * Looks for patterns like "5.0 (123 reviews)" or "4.9 stars" etc.
 */
function extractRatingAndReviews(text: string | undefined, highlights: string[] | undefined): { rating: number | null; reviews: number | null } {
  const content = [text || '', ...(highlights || [])].join(' ');
  
  let rating: number | null = null;
  let reviews: number | null = null;
  
  // Pattern 1: "X.X (NNN reviews)" or "X.X stars (NNN reviews)"
  const ratingReviewPattern = /(\d+\.?\d*)\s*(?:stars?)?\s*\((\d+)\s*reviews?\)/gi;
  let match = ratingReviewPattern.exec(content);
  if (match) {
    rating = parseFloat(match[1]);
    reviews = parseInt(match[2], 10);
  }
  
  // Pattern 2: "X.X out of 5" or "X.X/5"
  if (rating === null) {
    const ratingOnlyPattern = /(\d+\.?\d*)\s*(?:out of|\/)\s*5/gi;
    match = ratingOnlyPattern.exec(content);
    if (match) {
      rating = parseFloat(match[1]);
    }
  }
  
  // Pattern 3: Just "X.X stars" or "rated X.X"
  if (rating === null) {
    const starsPattern = /(?:rated|rating|stars?)\s*:?\s*(\d+\.?\d*)/gi;
    match = starsPattern.exec(content);
    if (match) {
      rating = parseFloat(match[1]);
    }
  }
  
  // Pattern 4: "NNN reviews" standalone
  if (reviews === null) {
    const reviewsPattern = /(\d+)\s*reviews?/gi;
    match = reviewsPattern.exec(content);
    if (match) {
      reviews = parseInt(match[1], 10);
    }
  }
  
  // Pattern 5: "NNN sales" as proxy if no reviews found
  if (reviews === null) {
    const salesPattern = /(\d+)\s*(?:recent\s+)?sales?/gi;
    match = salesPattern.exec(content);
    // Only use if it seems reasonable (not a price)
    if (match && parseInt(match[1], 10) < 10000) {
      // Don't set reviews from sales - just note it
    }
  }
  
  return { rating, reviews };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batch_size = 50, offset = 0, dry_run = false } = await req.json().catch(() => ({}));
    
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!EXA_API_KEY) {
      throw new Error('EXA_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get CA agents from state_licenses that haven't been processed yet
    const { data: agents, error: fetchError } = await supabase
      .from('state_licenses')
      .select('id, name, license_number, city, brokerage_name')
      .eq('state', 'CA')
      .is('zillow_url', null) // Only unprocessed
      .is('exa_searched_at', null) // Not yet searched
      .order('name')
      .range(offset, offset + batch_size - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No more CA agents to process',
        processed: 0,
        offset 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${agents.length} CA agents starting at offset ${offset}`);

    const results: Array<{
      id: string;
      name: string;
      license_number: string;
      zillow_url: string | null;
      exa_score: number | null;
      exa_rating: number | null;
      exa_reviews: number | null;
      prequalified: boolean;
      status: string;
    }> = [];

    // Process each agent with Exa search
    for (const agent of agents) {
      try {
        // Build search query for Zillow profile
        const searchQuery = `${agent.name} real estate agent California Zillow profile`;
        
        console.log(`Searching Exa for: ${agent.name}`);

        // Use contents to get text/highlights for rating extraction
        const exaResponse = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${EXA_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            numResults: 3,
            type: 'neural',
            useAutoprompt: true,
            includeDomains: ['zillow.com'],
            contents: {
              text: { maxCharacters: 2000 }, // Get page text for rating extraction
              highlights: { numSentences: 5, highlightsPerUrl: 3 } // Get relevant highlights
            }
          }),
        });

        if (!exaResponse.ok) {
          const errorText = await exaResponse.text();
          console.error(`Exa API error for ${agent.name}: ${exaResponse.status} - ${errorText}`);
          
          // Mark as searched with error
          if (!dry_run) {
            await supabase.from('state_licenses').update({
              exa_searched_at: new Date().toISOString(),
              exa_search_notes: `exa_error_${exaResponse.status}`,
            }).eq('id', agent.id);
          }
          
          results.push({
            id: agent.id,
            name: agent.name,
            license_number: agent.license_number,
            zillow_url: null,
            exa_score: null,
            exa_rating: null,
            exa_reviews: null,
            prequalified: false,
            status: `exa_error: ${exaResponse.status}`,
          });
          continue;
        }

        const exaData: ExaResponse = await exaResponse.json();
        
        // Find Zillow profile URL from results
        const zillowProfile = exaData.results?.find(r => 
          r.url.includes('zillow.com/profile/') || 
          r.url.includes('zillow.com/agent/')
        );

        if (zillowProfile) {
          // Extract rating and reviews from page content
          const { rating, reviews } = extractRatingAndReviews(zillowProfile.text, zillowProfile.highlights);
          
          // Prequalification: 4.8+ rating AND 20+ reviews
          const prequalified = (rating !== null && rating >= 4.8) && (reviews !== null && reviews >= 20);
          
          console.log(`   ${agent.name}: ${rating ?? '?'}⭐ (${reviews ?? '?'} reviews) - ${prequalified ? 'QUALIFIED' : 'not qualified'}`);
          
          results.push({
            id: agent.id,
            name: agent.name,
            license_number: agent.license_number,
            zillow_url: zillowProfile.url,
            exa_score: zillowProfile.score,
            exa_rating: rating,
            exa_reviews: reviews,
            prequalified,
            status: prequalified ? 'qualified' : 'not_qualified',
          });

          // Update state_licenses with Zillow URL and prequalification data
          if (!dry_run) {
            const { error: updateError } = await supabase
              .from('state_licenses')
              .update({
                zillow_url: zillowProfile.url,
                exa_searched_at: new Date().toISOString(),
                exa_score: zillowProfile.score,
                exa_rating: rating,
                exa_reviews: reviews,
                exa_prequalified: prequalified,
                exa_search_notes: prequalified ? 'prequalified_for_memo23' : 'found_but_not_qualified',
              })
              .eq('id', agent.id);

            if (updateError) {
              console.error(`Failed to update ${agent.name}: ${updateError.message}`);
            }
          }
        } else {
          results.push({
            id: agent.id,
            name: agent.name,
            license_number: agent.license_number,
            zillow_url: null,
            exa_score: null,
            exa_rating: null,
            exa_reviews: null,
            prequalified: false,
            status: 'no_zillow_profile_found',
          });

          // Mark as searched but not found
          if (!dry_run) {
            const { error: updateError } = await supabase
              .from('state_licenses')
              .update({
                exa_searched_at: new Date().toISOString(),
                exa_prequalified: false,
                exa_search_notes: 'no_zillow_profile_found',
              })
              .eq('id', agent.id);

            if (updateError) {
              console.error(`Failed to update ${agent.name}: ${updateError.message}`);
            }
          }
        }

        // Rate limit: 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (agentError) {
        console.error(`Error processing ${agent.name}:`, agentError);
        results.push({
          id: agent.id,
          name: agent.name,
          license_number: agent.license_number,
          zillow_url: null,
          exa_score: null,
          exa_rating: null,
          exa_reviews: null,
          prequalified: false,
          status: `error: ${agentError instanceof Error ? agentError.message : 'unknown'}`,
        });
      }
    }

    const qualified = results.filter(r => r.prequalified).length;
    const notQualified = results.filter(r => r.status === 'not_qualified').length;
    const notFound = results.filter(r => r.status === 'no_zillow_profile_found').length;
    const errors = results.filter(r => r.status.startsWith('error') || r.status.startsWith('exa_error')).length;

    console.log(`Batch complete: ${qualified} qualified, ${notQualified} not qualified, ${notFound} not found, ${errors} errors`);

    return new Response(JSON.stringify({
      message: `Processed ${results.length} CA agents`,
      dry_run,
      offset,
      next_offset: offset + batch_size,
      summary: { qualified, notQualified, notFound, errors, total: results.length },
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
