import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  professional_id: string;
  agent_name: string;
  city: string;
  state: string;
}

// Prequalification minimums per custom knowledge
const MIN_RATING = 4.8;
const MIN_REVIEWS = 20;

// Helper to parse "$207K" or "$2M" or "$200,000" to integer
function parsePrice(priceStr: string): number {
  const num = parseFloat(priceStr.replace(/[$,]/g, ''));
  if (priceStr.toUpperCase().includes('K')) return num * 1000;
  if (priceStr.toUpperCase().includes('M')) return num * 1000000;
  if (priceStr.toUpperCase().includes('B')) return num * 1000000000;
  return num;
}

// Extract rating, reviews, and address from Exa text content for prequalification
function extractPrequalData(text: string): { rating: number | null; reviews: number | null; address: string | null } {
  // Rating patterns - look for "5.0" or "4.9" near reviews
  const ratingMatch = text.match(/(\d\.\d)\s*(?:\(|\[)?\s*\d+\s*(?:team\s*)?reviews?/i)
    || text.match(/rating[:\s]+(\d\.\d)/i)
    || text.match(/(\d\.\d)\s*stars?/i)
    || text.match(/(\d\.\d)\s*out\s*of\s*5/i);

  // Review count patterns
  const reviewsMatch = text.match(/(\d+)\s*(?:team\s*)?reviews?/i)
    || text.match(/\((\d+)\s*reviews?\)/i)
    || text.match(/reviews?[:\s]+(\d+)/i);

  // Address patterns - look for typical address formats
  const addressMatch = text.match(/(\d+\s+[A-Za-z0-9\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway)[.,]?\s*(?:Suite|Ste|#)?\s*\d*[,.\s]+[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i)
    || text.match(/(\d+\s+\w+[^,]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})/i);

  return {
    rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
    reviews: reviewsMatch ? parseInt(reviewsMatch[1]) : null,
    address: addressMatch ? addressMatch[1].trim() : null
  };
}

function parseZillowProfile(html: string) {
  // Rating - look for pattern like "5.0" near reviews
  const ratingMatch = html.match(/(\d\.\d)\s*\[?\d+\s*(?:team\s*)?reviews?\]?/i) 
    || html.match(/<[^>]*>(\d\.\d)<\/[^>]*>\s*\[?\d+/)
    || html.match(/rating["\s:]+(\d\.\d)/i);
  
  // Review count - look for "80 team reviews" or "80 reviews"
  const reviewsMatch = html.match(/\[(\d+)\s*(?:team\s*)?reviews?\]/i)
    || html.match(/(\d+)\s*(?:team\s*)?reviews?/i)
    || html.match(/reviews?["\s:]+(\d+)/i);
  
  // Total sales
  const totalSalesMatch = html.match(/\*\*(\d+)\*\*\s*total\s*sales/i)
    || html.match(/(\d{1,4})\s*total\s*sales/i)
    || html.match(/total\s*sales["\s:]+(\d+)/i);
  
  // Sales last 12 months
  const sales12Match = html.match(/\*\*(\d+)\*\*\s*sales?\s*last\s*12/i)
    || html.match(/(\d{1,3})\s*sales?\s*last\s*12/i);
  
  // Years experience
  const yearsMatch = html.match(/\*\*(\d+)\*\*\s*years?\s*(?:of\s*)?experience/i)
    || html.match(/(\d+)\s*[Yy]ears?\s*(?:of\s*)?experience/i);
  
  // Price range - "$207K-$2M" or "$200,000-$2,000,000"
  const priceRangeMatch = html.match(/\$(\d+(?:,\d+)?[KMB]?)\s*-\s*\$(\d+(?:,\d+)?[KMB]?)\s*price\s*range/i);
  
  // Average price
  const avgPriceMatch = html.match(/\$(\d+(?:,\d+)?[KMB]?)\s*average\s*price/i);
  
  // Phone - (480) 980-0811 or 480-980-0811
  const phoneMatch = html.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  
  // Email
  const emailMatch = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  
  // Photo URL
  const photoMatch = html.match(/https:\/\/photos\.zillowstatic\.com\/fp\/[a-f0-9]+-[a-z_]+\.jpg/i);
  
  // Brokerage name
  const brokerageMatch = html.match(/(?:Lead\s*of|Broker\s*at|Agent\s*at)\s*([^<\n]+?)(?:\s*Brokerage)?(?:<|$)/i);
  
  // For sale count
  const forSaleMatch = html.match(/For\s*Sale\s*\((\d+)\)/i);
  
  // For rent count  
  const forRentMatch = html.match(/For\s*Rent\s*\((\d+)\)/i);

  // Address - look for office/business address patterns
  const addressMatch = html.match(/(?:Office|Located at|Address)[:\s]*(\d+\s+[A-Za-z0-9\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway)[.,]?\s*(?:Suite|Ste|#)?\s*\d*[,.\s]+[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i)
    || html.match(/(\d+\s+[A-Za-z0-9\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway)[.,]?\s*(?:Suite|Ste|#)?\s*\d*[,.\s]+[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i);

  return {
    rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
    reviews: reviewsMatch ? parseInt(reviewsMatch[1]) : null,
    total_sales: totalSalesMatch ? parseInt(totalSalesMatch[1].replace(/,/g, '')) : null,
    sales_last_12_months: sales12Match ? parseInt(sales12Match[1]) : null,
    years_experience: yearsMatch ? parseInt(yearsMatch[1]) : null,
    price_range_min: priceRangeMatch ? parsePrice(priceRangeMatch[1]) : null,
    price_range_max: priceRangeMatch ? parsePrice(priceRangeMatch[2]) : null,
    avg_price: avgPriceMatch ? parsePrice(avgPriceMatch[1]) : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    email: emailMatch ? emailMatch[1] : null,
    photo_url: photoMatch ? photoMatch[0] : null,
    brokerage_name: brokerageMatch ? brokerageMatch[1].trim() : null,
    listings_for_sale: forSaleMatch ? parseInt(forSaleMatch[1]) : null,
    listings_for_rent: forRentMatch ? parseInt(forRentMatch[1]) : null,
    address: addressMatch ? addressMatch[1].trim() : null
  };
}

function extractReviews(html: string): Array<{date: string, rating: number, text: string, reviewer: string | null}> {
  const reviews: any[] = [];
  
  // Look for review blocks
  const reviewBlocks = html.split(/5\.0\s*Report a problem/i).slice(1, 11);
  
  for (const block of reviewBlocks) {
    const dateMatch = block.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const reviewerMatch = block.match(/•\s*([^\n]+)/);
    const textMatch = block.match(/Review for:.*?\]\s*([\s\S]*?)(?:Show more|5\.0|$)/i);
    
    if (dateMatch) {
      reviews.push({
        date: dateMatch[1],
        rating: 5.0,
        reviewer: reviewerMatch ? reviewerMatch[1].trim() : null,
        text: textMatch ? textMatch[1].trim().substring(0, 500) : null
      });
    }
  }
  
  return reviews;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: ScrapeRequest = await req.json();
    console.log('Scrape request:', input);

    if (!input.professional_id || !input.agent_name || !input.city || !input.state) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: professional_id, agent_name, city, state' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const exaApiKey = Deno.env.get('EXA_API_KEY');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!exaApiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'EXA_API_KEY not configured' 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!firecrawlApiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'FIRECRAWL_API_KEY not configured' 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // =========================================================================
    // STEP 1: Exa search WITH text content for PREQUALIFICATION
    // Only get minimum data needed: URL + rating/reviews from text snippets
    // =========================================================================
    console.log(`[Exa] Prequalification search for: "${input.agent_name}" ${input.city} ${input.state}`);
    
    const exaResponse = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${exaApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `"${input.agent_name}" ${input.city} ${input.state} real estate agent site:zillow.com/profile`,
        num_results: 5,
        type: 'keyword',
        include_domains: ['zillow.com'],
        text: true  // Include text content for prequalification extraction
      })
    });

    if (!exaResponse.ok) {
      const errorText = await exaResponse.text();
      console.error('Exa API error:', errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        status: 'error',
        error: `Exa API error: ${exaResponse.status}` 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const exaData = await exaResponse.json();
    console.log('[Exa] Results:', exaData.results?.length || 0);

    // Find first URL matching zillow.com/profile/
    const zillowResult = exaData.results?.find((r: any) => 
      r.url && r.url.includes('zillow.com/profile/')
    );

    if (!zillowResult) {
      console.log('[Exa] No Zillow profile found for:', input.agent_name);
      return new Response(JSON.stringify({ 
        success: true, 
        status: 'not_found',
        message: 'No Zillow profile found',
        professional_id: input.professional_id
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const zillowUrl = zillowResult.url;
    const exaText = zillowResult.text || '';
    console.log('[Exa] Found Zillow URL:', zillowUrl);
    console.log('[Exa] Text snippet length:', exaText.length);

    // =========================================================================
    // STEP 2: Extract prequalification data from Exa text
    // =========================================================================
    const prequalData = extractPrequalData(exaText);
    console.log('[Prequal] Extracted from Exa:', prequalData);

    // Check if agent meets minimum qualifications
    const meetsRating = prequalData.rating !== null && prequalData.rating >= MIN_RATING;
    const meetsReviews = prequalData.reviews !== null && prequalData.reviews >= MIN_REVIEWS;
    const isPrequalified = meetsRating && meetsReviews;

    console.log(`[Prequal] Rating: ${prequalData.rating} (min ${MIN_RATING}): ${meetsRating ? 'PASS' : 'FAIL'}`);
    console.log(`[Prequal] Reviews: ${prequalData.reviews} (min ${MIN_REVIEWS}): ${meetsReviews ? 'PASS' : 'FAIL'}`);
    console.log(`[Prequal] Result: ${isPrequalified ? 'QUALIFIED - proceeding to Firecrawl' : 'NOT QUALIFIED - skipping Firecrawl'}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =========================================================================
    // STEP 3: If NOT qualified, save basic info and skip Firecrawl
    // =========================================================================
    if (!isPrequalified) {
      // Save what we know from Exa but mark as not qualified
      const updateData: any = {
        zillow_profile_url: zillowUrl,
        zillow_data_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (prequalData.rating !== null) updateData.review_stars_rating = prequalData.rating;
      if (prequalData.reviews !== null) updateData.num_total_reviews = prequalData.reviews;
      if (prequalData.address !== null) updateData.address = prequalData.address;

      await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', input.professional_id);

      return new Response(JSON.stringify({
        success: true,
        status: 'not_qualified',
        zillow_url: zillowUrl,
        rating: prequalData.rating,
        reviews: prequalData.reviews,
        min_rating: MIN_RATING,
        min_reviews: MIN_REVIEWS,
        message: `Agent does not meet prequalification minimums (${MIN_RATING}+ rating, ${MIN_REVIEWS}+ reviews)`,
        professional_id: input.professional_id
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // =========================================================================
    // STEP 4: Agent is QUALIFIED - use Firecrawl for full data scrape
    // =========================================================================
    console.log('[Firecrawl] Agent qualified! Scraping full profile:', zillowUrl);
    
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: zillowUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 2000
      })
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error('[Firecrawl] Error:', firecrawlResponse.status, errorText);
      
      // Save URL and prequal data even if Firecrawl fails
      const updateData: any = {
        zillow_profile_url: zillowUrl,
        zillow_data_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (prequalData.rating !== null) updateData.review_stars_rating = prequalData.rating;
      if (prequalData.reviews !== null) updateData.num_total_reviews = prequalData.reviews;

      await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', input.professional_id);

      return new Response(JSON.stringify({ 
        success: true, 
        status: 'url_saved_scrape_failed',
        zillow_url: zillowUrl,
        rating: prequalData.rating,
        reviews: prequalData.reviews,
        error: `Firecrawl error: ${firecrawlResponse.status}`,
        professional_id: input.professional_id
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const firecrawlData = await firecrawlResponse.json();
    const markdown = firecrawlData.data?.markdown || firecrawlData.markdown || '';
    const html = firecrawlData.data?.html || firecrawlData.html || '';
    
    console.log('[Firecrawl] Got markdown length:', markdown.length, 'html length:', html.length);

    // =========================================================================
    // STEP 5: Parse full content from Firecrawl
    // =========================================================================
    const content = markdown || html;
    const parsedData = parseZillowProfile(content);
    const reviews = extractReviews(content);
    
    console.log('[Parse] Data:', parsedData);
    console.log('[Parse] Reviews found:', reviews.length);

    // Use Firecrawl data if available, fall back to Exa prequal data
    const finalRating = parsedData.rating ?? prequalData.rating;
    const finalReviews = parsedData.reviews ?? prequalData.reviews;

    // =========================================================================
    // STEP 6: Save full data to database
    // =========================================================================
    const updateData: any = {
      zillow_profile_url: zillowUrl,
      zillow_data_fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Only update fields that we actually found
    if (finalRating !== null) updateData.review_stars_rating = finalRating;
    if (finalReviews !== null) updateData.num_total_reviews = finalReviews;
    if (parsedData.total_sales !== null) updateData.total_sales = parsedData.total_sales;
    if (parsedData.years_experience !== null) updateData.years_experience = parsedData.years_experience;
    if (parsedData.phone !== null) updateData.phone = parsedData.phone;
    if (parsedData.email !== null) updateData.email = parsedData.email;
    if (parsedData.photo_url !== null) updateData.image_url = parsedData.photo_url;
    if (parsedData.brokerage_name !== null) updateData.company = parsedData.brokerage_name;
    if (parsedData.listings_for_sale !== null) updateData.current_listings = parsedData.listings_for_sale;

    // Save address - prefer Firecrawl data, fall back to Exa
    const finalAddress = parsedData.address ?? prequalData.address;
    if (finalAddress !== null) updateData.address = finalAddress;

    // Store additional stats in agent_sales_stats JSON
    if (parsedData.sales_last_12_months !== null || parsedData.price_range_min !== null) {
      updateData.agent_sales_stats = {
        sales_last_12_months: parsedData.sales_last_12_months,
        price_range_min: parsedData.price_range_min,
        price_range_max: parsedData.price_range_max,
        avg_price: parsedData.avg_price,
        listings_for_rent: parsedData.listings_for_rent
      };
    }

    // Store reviews if found
    if (reviews.length > 0) {
      updateData.reviews_data = { zillow_reviews: reviews };
    }

    const { error } = await supabase
      .from('professionals')
      .update(updateData)
      .eq('id', input.professional_id);

    if (error) {
      console.error('Database update error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        status: 'error',
        error: `Database update failed: ${error.message}`,
        zillow_url: zillowUrl
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[DB] Updated professional:', input.professional_id);

    return new Response(JSON.stringify({
      success: true,
      status: 'qualified',
      zillow_url: zillowUrl,
      rating: finalRating,
      reviews: finalReviews,
      total_sales: parsedData.total_sales,
      years_experience: parsedData.years_experience,
      qualified: true,
      professional_id: input.professional_id
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Scrape error:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      status: 'error',
      error: errorMessage
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
