import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchRequest {
  state: string;
  batch_size?: number;
  dry_run?: boolean;
  city_slug?: string; // Optional: filter by specific city
}

// Helper to parse "$207K" or "$2M" or "$200,000" to integer
function parsePrice(priceStr: string): number {
  const num = parseFloat(priceStr.replace(/[$,]/g, ''));
  if (priceStr.toUpperCase().includes('K')) return num * 1000;
  if (priceStr.toUpperCase().includes('M')) return num * 1000000;
  if (priceStr.toUpperCase().includes('B')) return num * 1000000000;
  return num;
}

function parseZillowProfile(html: string) {
  const ratingMatch = html.match(/(\d\.\d)\s*\[?\d+\s*(?:team\s*)?reviews?\]?/i) 
    || html.match(/<[^>]*>(\d\.\d)<\/[^>]*>\s*\[?\d+/);
  
  const reviewsMatch = html.match(/\[(\d+)\s*(?:team\s*)?reviews?\]/i)
    || html.match(/(\d+)\s*(?:team\s*)?reviews?/i);
  
  const totalSalesMatch = html.match(/\*\*(\d+)\*\*\s*total\s*sales/i)
    || html.match(/(\d{1,4})\s*total\s*sales/i);
  
  const sales12Match = html.match(/\*\*(\d+)\*\*\s*sales?\s*last\s*12/i)
    || html.match(/(\d{1,3})\s*sales?\s*last\s*12/i);
  
  const yearsMatch = html.match(/\*\*(\d+)\*\*\s*years?\s*(?:of\s*)?experience/i)
    || html.match(/(\d+)\s*[Yy]ears?\s*(?:of\s*)?experience/i);
  
  const priceRangeMatch = html.match(/\$(\d+(?:,\d+)?[KMB]?)\s*-\s*\$(\d+(?:,\d+)?[KMB]?)\s*price\s*range/i);
  const avgPriceMatch = html.match(/\$(\d+(?:,\d+)?[KMB]?)\s*average\s*price/i);
  const phoneMatch = html.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const emailMatch = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const photoMatch = html.match(/https:\/\/photos\.zillowstatic\.com\/fp\/[a-f0-9]+-[a-z_]+\.jpg/i);
  const brokerageMatch = html.match(/(?:Lead\s*of|Broker\s*at|Agent\s*at)\s*([^<\n]+?)(?:\s*Brokerage)?(?:<|$)/i);
  const forSaleMatch = html.match(/For\s*Sale\s*\((\d+)\)/i);
  const forRentMatch = html.match(/For\s*Rent\s*\((\d+)\)/i);

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
    listings_for_rent: forRentMatch ? parseInt(forRentMatch[1]) : null
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: BatchRequest = await req.json();
    console.log('Batch scrape request:', input);

    const batchSize = Math.min(input.batch_size || 10, 50); // Max 50 per call
    const dryRun = input.dry_run !== false; // Default to true for safety
    const state = input.state?.toUpperCase();

    if (!state) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'State is required' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get the city_id for the state (need to join with cities table)
    // Query professionals that don't have Zillow data yet
    let query = supabase
      .from('professionals')
      .select(`
        id,
        name,
        city_id,
        cities!inner(name, state)
      `)
      .is('zillow_profile_url', null)
      .eq('active', true)
      .limit(batchSize);

    // Filter by city_slug if provided
    if (input.city_slug) {
      query = query.eq('cities.slug', input.city_slug);
    }

    const { data: professionals, error: queryError } = await query;

    if (queryError) {
      console.error('Query error:', queryError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Query failed: ${queryError.message}` 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Filter by state (since we can't easily filter nested in Supabase)
    const stateAbbrevMap: Record<string, string> = {
      'ARIZONA': 'AZ', 'AZ': 'AZ',
      'CALIFORNIA': 'CA', 'CA': 'CA',
      'TEXAS': 'TX', 'TX': 'TX',
      'FLORIDA': 'FL', 'FL': 'FL',
      'NEW YORK': 'NY', 'NY': 'NY'
    };
    
    const stateAbbr = stateAbbrevMap[state] || state;
    const filteredProfessionals = professionals?.filter((p: any) => {
      const cityState = p.cities?.state?.toUpperCase() || '';
      return cityState === state || cityState === stateAbbr || 
             cityState.includes(state) || stateAbbrevMap[cityState] === stateAbbr;
    }) || [];

    console.log(`Found ${filteredProfessionals.length} professionals needing Zillow data in ${state}`);

    if (dryRun) {
      // Dry run - just return what would be processed
      const preview = filteredProfessionals.slice(0, 10).map((p: any) => ({
        id: p.id,
        name: p.name,
        city: p.cities?.name
      }));

      // Count total needing processing
      const { count } = await supabase
        .from('professionals')
        .select('id', { count: 'exact', head: true })
        .is('zillow_profile_url', null)
        .eq('active', true);

      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        state,
        batch_size: batchSize,
        professionals_in_batch: filteredProfessionals.length,
        total_needing_zillow_data: count,
        estimated_cost: `$${((count || 0) * 0.005).toFixed(2)}`,
        preview,
        message: 'Set dry_run: false to actually process'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Actual processing
    const exaApiKey = Deno.env.get('EXA_API_KEY');
    if (!exaApiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'EXA_API_KEY not configured' 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = {
      processed: 0,
      found: 0,
      not_found: 0,
      errors: 0,
      qualified: 0,
      details: [] as any[]
    };

    for (const prof of filteredProfessionals) {
      try {
        results.processed++;
        const cityName = (prof as any).cities?.name || '';
        
        console.log(`Processing ${results.processed}/${filteredProfessionals.length}: ${prof.name} in ${cityName}`);

        // Search Exa
        const exaResponse = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${exaApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: `"${prof.name}" ${cityName} ${stateAbbr} real estate agent site:zillow.com/profile`,
            num_results: 5,
            type: 'keyword',
            include_domains: ['zillow.com']
          })
        });

        if (!exaResponse.ok) {
          console.error('Exa error for', prof.name);
          results.errors++;
          results.details.push({ id: prof.id, name: prof.name, status: 'exa_error' });
          await delay(1000);
          continue;
        }

        const exaData = await exaResponse.json();
        const zillowResult = exaData.results?.find((r: any) => 
          r.url && r.url.includes('zillow.com/profile/')
        );

        if (!zillowResult) {
          results.not_found++;
          results.details.push({ id: prof.id, name: prof.name, status: 'not_found' });
          await delay(1000);
          continue;
        }

        const zillowUrl = zillowResult.url;
        console.log('Found:', zillowUrl);

        // Fetch Zillow page
        const zillowResponse = await fetch(zillowUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          }
        });

        if (!zillowResponse.ok) {
          console.error('Zillow fetch failed for', prof.name);
          // Still save the URL even if we can't parse it
          await supabase
            .from('professionals')
            .update({ 
              zillow_profile_url: zillowUrl,
              zillow_data_fetched_at: new Date().toISOString()
            })
            .eq('id', prof.id);
          
          results.found++;
          results.details.push({ id: prof.id, name: prof.name, status: 'url_saved_parse_failed', url: zillowUrl });
          await delay(1000);
          continue;
        }

        const html = await zillowResponse.text();
        const parsedData = parseZillowProfile(html);

        const qualified = (parsedData.rating && parsedData.rating >= 4.8) && 
                          (parsedData.reviews && parsedData.reviews >= 20);
        if (qualified) results.qualified++;

        // Update database
        const updateData: any = {
          zillow_profile_url: zillowUrl,
          zillow_data_fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (parsedData.rating !== null) updateData.review_stars_rating = parsedData.rating;
        if (parsedData.reviews !== null) updateData.num_total_reviews = parsedData.reviews;
        if (parsedData.total_sales !== null) updateData.total_sales = parsedData.total_sales;
        if (parsedData.years_experience !== null) updateData.years_experience = parsedData.years_experience;
        if (parsedData.phone !== null) updateData.phone = parsedData.phone;
        if (parsedData.email !== null) updateData.email = parsedData.email;
        if (parsedData.photo_url !== null) updateData.image_url = parsedData.photo_url;
        if (parsedData.brokerage_name !== null) updateData.company = parsedData.brokerage_name;
        if (parsedData.listings_for_sale !== null) updateData.current_listings = parsedData.listings_for_sale;

        if (parsedData.sales_last_12_months !== null || parsedData.price_range_min !== null) {
          updateData.agent_sales_stats = {
            sales_last_12_months: parsedData.sales_last_12_months,
            price_range_min: parsedData.price_range_min,
            price_range_max: parsedData.price_range_max,
            avg_price: parsedData.avg_price,
            listings_for_rent: parsedData.listings_for_rent
          };
        }

        await supabase
          .from('professionals')
          .update(updateData)
          .eq('id', prof.id);

        results.found++;
        results.details.push({ 
          id: prof.id, 
          name: prof.name, 
          status: 'found', 
          url: zillowUrl,
          rating: parsedData.rating,
          reviews: parsedData.reviews,
          qualified
        });

        // Rate limit: 1 second between Exa calls
        await delay(1000);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error processing', prof.name, err);
        results.errors++;
        results.details.push({ id: prof.id, name: prof.name, status: 'error', error: errorMessage });
        await delay(1000);
      }
    }

    console.log('Batch complete:', results);

    return new Response(JSON.stringify({
      success: true,
      dry_run: false,
      state,
      ...results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Batch error:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
