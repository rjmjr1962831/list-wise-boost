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
  city_slug?: string;
}

// Helper to parse "$207K" or "$2M" or "$200,000" to integer
function parsePrice(priceStr: string): number {
  const num = parseFloat(priceStr.replace(/[$,]/g, ''));
  if (priceStr.toUpperCase().includes('K')) return num * 1000;
  if (priceStr.toUpperCase().includes('M')) return num * 1000000;
  if (priceStr.toUpperCase().includes('B')) return num * 1000000000;
  return num;
}

function parseZillowProfile(content: string) {
  const ratingMatch = content.match(/(\d\.\d)\s*\[?\d+\s*(?:team\s*)?reviews?\]?/i) 
    || content.match(/<[^>]*>(\d\.\d)<\/[^>]*>\s*\[?\d+/)
    || content.match(/rating["\s:]+(\d\.\d)/i);
  
  const reviewsMatch = content.match(/\[(\d+)\s*(?:team\s*)?reviews?\]/i)
    || content.match(/(\d+)\s*(?:team\s*)?reviews?/i)
    || content.match(/reviews?["\s:]+(\d+)/i);
  
  const totalSalesMatch = content.match(/\*\*(\d+)\*\*\s*total\s*sales/i)
    || content.match(/(\d{1,4})\s*total\s*sales/i)
    || content.match(/total\s*sales["\s:]+(\d+)/i);
  
  const sales12Match = content.match(/\*\*(\d+)\*\*\s*sales?\s*last\s*12/i)
    || content.match(/(\d{1,3})\s*sales?\s*last\s*12/i);
  
  const yearsMatch = content.match(/\*\*(\d+)\*\*\s*years?\s*(?:of\s*)?experience/i)
    || content.match(/(\d+)\s*[Yy]ears?\s*(?:of\s*)?experience/i);
  
  const priceRangeMatch = content.match(/\$(\d+(?:,\d+)?[KMB]?)\s*-\s*\$(\d+(?:,\d+)?[KMB]?)\s*price\s*range/i);
  const avgPriceMatch = content.match(/\$(\d+(?:,\d+)?[KMB]?)\s*average\s*price/i);
  const phoneMatch = content.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const emailMatch = content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const photoMatch = content.match(/https:\/\/photos\.zillowstatic\.com\/fp\/[a-f0-9]+-[a-z_]+\.jpg/i);
  const brokerageMatch = content.match(/(?:Lead\s*of|Broker\s*at|Agent\s*at)\s*([^<\n]+?)(?:\s*Brokerage)?(?:<|$)/i);
  const forSaleMatch = content.match(/For\s*Sale\s*\((\d+)\)/i);
  const forRentMatch = content.match(/For\s*Rent\s*\((\d+)\)/i);

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

    const batchSize = Math.min(input.batch_size || 10, 50);
    const dryRun = input.dry_run !== false;
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

    // Filter by state
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
      const preview = filteredProfessionals.slice(0, 10).map((p: any) => ({
        id: p.id,
        name: p.name,
        city: p.cities?.name
      }));

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
        estimated_exa_cost: `$${((count || 0) * 0.001).toFixed(2)}`,
        estimated_firecrawl_cost: `$${((count || 0) * 0.001).toFixed(2)}`,
        preview,
        message: 'Set dry_run: false to process. Stage 1: Exa finds URL, Stage 2: Firecrawl scrapes content'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Actual processing
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

    const results = {
      processed: 0,
      exa_found: 0,
      exa_not_found: 0,
      firecrawl_success: 0,
      firecrawl_failed: 0,
      qualified: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const prof of filteredProfessionals) {
      try {
        results.processed++;
        const cityName = (prof as any).cities?.name || '';
        
        console.log(`\n[${results.processed}/${filteredProfessionals.length}] ${prof.name} in ${cityName}`);

        // STAGE 1: Exa search for URL only
        console.log('[Exa] Searching...');
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
          console.error('[Exa] API error');
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
          console.log('[Exa] No profile found');
          results.exa_not_found++;
          results.details.push({ id: prof.id, name: prof.name, status: 'exa_not_found' });
          await delay(500);
          continue;
        }

        const zillowUrl = zillowResult.url;
        console.log('[Exa] Found URL:', zillowUrl);
        results.exa_found++;

        // STAGE 2: Firecrawl scrape
        console.log('[Firecrawl] Scraping...');
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: zillowUrl,
            formats: ['markdown'],
            onlyMainContent: false,
            waitFor: 2000
          })
        });

        if (!firecrawlResponse.ok) {
          console.error('[Firecrawl] Failed:', firecrawlResponse.status);
          results.firecrawl_failed++;
          
          // Save URL even if scrape fails
          await supabase
            .from('professionals')
            .update({ 
              zillow_profile_url: zillowUrl,
              zillow_data_fetched_at: new Date().toISOString()
            })
            .eq('id', prof.id);
          
          results.details.push({ 
            id: prof.id, 
            name: prof.name, 
            status: 'firecrawl_failed', 
            url: zillowUrl 
          });
          await delay(1000);
          continue;
        }

        const firecrawlData = await firecrawlResponse.json();
        const markdown = firecrawlData.data?.markdown || firecrawlData.markdown || '';
        console.log('[Firecrawl] Got markdown:', markdown.length, 'chars');
        results.firecrawl_success++;

        // Parse content
        const parsedData = parseZillowProfile(markdown);
        console.log('[Parse] Rating:', parsedData.rating, 'Reviews:', parsedData.reviews);

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

        results.details.push({ 
          id: prof.id, 
          name: prof.name, 
          status: 'success', 
          url: zillowUrl,
          rating: parsedData.rating,
          reviews: parsedData.reviews,
          qualified
        });

        // Rate limit
        await delay(1000);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Error]', prof.name, err);
        results.errors++;
        results.details.push({ id: prof.id, name: prof.name, status: 'error', error: errorMessage });
        await delay(1000);
      }
    }

    console.log('\n=== Batch complete ===');
    console.log(results);

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
