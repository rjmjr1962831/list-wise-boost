import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Zillow Agent Profile Schema for Firecrawl JSON extraction
const ZILLOW_AGENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    profileUrl: { type: "string" },
    photoUrl: { type: "string" },
    videoUrl: { type: "string" },
    zillowRating: { type: "number" },
    reviewCount: { type: "number" },
    totalSales: { type: "number" },
    salesLast12Months: { type: "number" },
    currentListings: { type: "number" },
    yearsExperience: { type: "number" },
    licenseNumber: { type: "string" },
    brokerageName: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    website: { type: "string" },
    serviceAreas: { type: "array", items: { type: "string" } },
    primaryCity: { type: "string" },
    primaryState: { type: "string" },
    specialties: { type: "array", items: { type: "string" } },
    bio: { type: "string" },
    headline: { type: "string" },
  },
  required: ["name"]
};

interface AgentResult {
  name: string;
  licenseNumber: string;
  status: 'qualified' | 'not_qualified' | 'duplicate' | 'error' | 'no_result';
  zillowUrl?: string;
  rating?: number;
  reviewCount?: number;
  error?: string;
}

interface ProcessingStats {
  processed: number;
  qualified: number;
  notQualified: number;
  duplicates: number;
  noResults: number;
  errors: number;
}

// Use EXA to find Zillow URL and get prequalification data
async function searchZillowWithExa(
  name: string,
  city: string | null,
  stateAbbr: string,
  exaApiKey: string
): Promise<{ zillowUrl?: string; rating?: number; reviewCount?: number } | null> {
  const searchQuery = city 
    ? `${name} Zillow real estate agent ${city} ${stateAbbr}`
    : `${name} Zillow real estate agent ${stateAbbr}`;
  
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

    // Find Zillow profile URL from search results
    let zillowUrl: string | undefined;
    let resultText: string = '';
    
    for (const result of exaData.results) {
      const url = result.url;
      if (url && url.includes('zillow.com/profile/')) {
        zillowUrl = url;
        resultText = result.text || '';
        break;
      }
    }

    if (!zillowUrl) {
      console.log(`[${name}] No Zillow profile in Exa results`);
      return null;
    }

    console.log(`[${name}] Found Zillow URL via Exa: ${zillowUrl}`);

    // Extract rating and reviews from Exa text for prequalification
    let rating: number | null = null;
    let reviewCount: number | null = null;

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

    console.log(`[${name}] Exa prequal data: rating=${rating ?? 'NA'}, reviews=${reviewCount ?? 'NA'}`);

    return {
      zillowUrl,
      rating: rating ?? undefined,
      reviewCount: reviewCount ?? undefined,
    };
  } catch (error) {
    console.error(`[${name}] Exa error:`, error);
    return null;
  }
}

// Use FIRECRAWL to enrich qualified agents with full profile data
async function enrichWithFirecrawl(
  name: string,
  zillowUrl: string,
  firecrawlApiKey: string
): Promise<{ rating?: number; reviewCount?: number; fullData?: any } | null> {
  console.log(`[${name}] Firecrawl enrichment: ${zillowUrl}`);

  try {
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: zillowUrl,
        formats: ['extract', 'markdown'],
        extract: { schema: ZILLOW_AGENT_SCHEMA },
        onlyMainContent: true,
        timeout: 30000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error(`[${name}] Firecrawl scrape failed:`, errorText);
      return null;
    }

    const scrapeData = await scrapeResponse.json();
    const extractedData = scrapeData.data?.extract || scrapeData.extract || scrapeData.data?.json || {};
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';

    const rating = extractedData.zillowRating || 0;
    const reviewCount = extractedData.reviewCount || 0;

    console.log(`[${name}] Firecrawl enriched: rating=${rating || 'NA'}, reviews=${reviewCount || 'NA'}`);

    return {
      rating,
      reviewCount,
      fullData: { ...extractedData, markdown: markdown.slice(0, 5000) },
    };
  } catch (error) {
    console.error(`[${name}] Firecrawl error:`, error);
    return null;
  }
}

// Process a single agent
async function processAgent(
  agent: { name: string; license_number: string; city: string | null; id: string },
  state: string,
  stateAbbr: string,
  categoryId: string,
  supabase: any,
  exaApiKey: string,
  firecrawlApiKey: string
): Promise<AgentResult> {
  const { name, license_number, city, id } = agent;
  
  try {
    // Check for duplicate by license number first
    const { data: existingByLicense } = await supabase
      .from('professionals')
      .select('id, zillow_profile_url')
      .eq('license_number', license_number)
      .maybeSingle();

    if (existingByLicense) {
      // Update state_licenses to mark as duplicate
      await supabase
        .from('state_licenses')
        .update({ 
          zillow_status: 'duplicate',
          zillow_scraped_at: new Date().toISOString()
        })
        .eq('id', id);
      
      console.log(`[${name}] Duplicate by license number`);
      return { name, licenseNumber: license_number, status: 'duplicate' };
    }

    // Use EXA to find Zillow URL
    const exaResult = await searchZillowWithExa(name, city, stateAbbr, exaApiKey);

    if (!exaResult || !exaResult.zillowUrl) {
      // Update state_licenses to mark as not found
      await supabase
        .from('state_licenses')
        .update({ 
          zillow_status: 'not_found',
          zillow_scraped_at: new Date().toISOString()
        })
        .eq('id', id);
      
      console.log(`[${name}] No Zillow profile found via Exa`);
      return { name, licenseNumber: license_number, status: 'no_result' };
    }

    const { zillowUrl, rating: exaRating, reviewCount: exaReviewCount } = exaResult;

    // Check duplicate by Zillow URL
    const { data: existingByZillow } = await supabase
      .from('professionals')
      .select('id')
      .eq('zillow_profile_url', zillowUrl)
      .maybeSingle();

    if (existingByZillow) {
      await supabase
        .from('state_licenses')
        .update({ 
          zillow_status: 'duplicate',
          zillow_url: zillowUrl,
          zillow_scraped_at: new Date().toISOString()
        })
        .eq('id', id);
      
      console.log(`[${name}] Duplicate by Zillow URL`);
      return { name, licenseNumber: license_number, status: 'duplicate', zillowUrl };
    }

    // Check qualification: 4.8+ stars and 20+ reviews
    const isQualified = (exaRating ?? 0) >= 4.8 && (exaReviewCount ?? 0) >= 20;
    
    let fullData: any = {};
    let rating = exaRating ?? 0;
    let reviewCount = exaReviewCount ?? 0;

    if (isQualified) {
      console.log(`[${name}] QUALIFIED - running Firecrawl enrichment...`);
      const firecrawlResult = await enrichWithFirecrawl(name, zillowUrl, firecrawlApiKey);
      
      if (firecrawlResult) {
        rating = firecrawlResult.rating || rating;
        reviewCount = firecrawlResult.reviewCount || reviewCount;
        fullData = firecrawlResult.fullData || {};
      }
    }

    // Get or create city record
    const agentCity = fullData.primaryCity || city || null;
    
    let cityRecord = null;
    if (agentCity) {
      const { data: existingCity } = await supabase
        .from('cities')
        .select('id')
        .eq('name', agentCity)
        .eq('state', state)
        .maybeSingle();

      if (existingCity) {
        cityRecord = existingCity;
      } else {
        const citySlug = agentCity.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const { data: newCity } = await supabase
          .from('cities')
          .insert({
            name: agentCity,
            slug: citySlug,
            state: state,
            state_slug: state.toLowerCase().replace(/\s+/g, '-'),
            active: true
          })
          .select('id')
          .single();
        cityRecord = newCity;
      }
    }
    
    if (!cityRecord) {
      const { data: defaultCity } = await supabase
        .from('cities')
        .select('id')
        .eq('state', state)
        .limit(1)
        .maybeSingle();
      cityRecord = defaultCity;
    }

    if (!cityRecord) {
      return { name, licenseNumber: license_number, status: 'error', error: 'No city found' };
    }

    // Insert professional
    const agentType = isQualified ? 
      (fullData.yearsExperience && fullData.yearsExperience >= 10 ? 'established' : 'emerging') : 
      'individual';
    
    const insertData: Record<string, any> = {
      name,
      license_number,
      city_id: cityRecord.id,
      category_id: categoryId,
      type: agentType,
      rank: 999,
      active: isQualified,
      skip_pipedrive_sync: !isQualified,
      zillow_profile_url: zillowUrl,
      review_stars_rating: rating,
      num_total_reviews: reviewCount,
      zillow_data_fetched_at: new Date().toISOString(),
    };

    if (fullData.phone) insertData.phone = fullData.phone;
    if (fullData.email) insertData.email = fullData.email;
    if (fullData.website) insertData.website = fullData.website;
    if (fullData.photoUrl) insertData.image_url = fullData.photoUrl;
    if (fullData.videoUrl) insertData.sidebar_video_url = fullData.videoUrl;
    if (fullData.bio) insertData.description = fullData.bio;
    if (fullData.headline) insertData.headline = fullData.headline;
    if (fullData.yearsExperience) insertData.years_experience = fullData.yearsExperience;
    if (fullData.totalSales) insertData.total_sales = fullData.totalSales;
    if (fullData.currentListings) insertData.current_listings = fullData.currentListings;
    if (fullData.brokerageName) insertData.company = fullData.brokerageName;
    if (fullData.specialties) insertData.specialty = fullData.specialties;
    if (fullData.serviceAreas) insertData.service_areas = fullData.serviceAreas;

    const { data: professional, error: insertError } = await supabase
      .from('professionals')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      console.error(`[${name}] Insert failed:`, insertError);
      return { name, licenseNumber: license_number, status: 'error', error: insertError.message };
    }

    // Update state_licenses with results
    await supabase
      .from('state_licenses')
      .update({ 
        zillow_status: isQualified ? 'qualified' : 'not_qualified',
        zillow_url: zillowUrl,
        zillow_rating: rating,
        zillow_reviews: reviewCount,
        zillow_scraped_at: new Date().toISOString()
      })
      .eq('id', id);

    // Queue for enrichment if qualified
    if (isQualified) {
      await supabase
        .from('contact_enrichment_queue')
        .upsert({
          professional_id: professional.id,
          status: 'pending',
          stage: 'exa_search',
          reason: 'reprocess_not_found',
          attempts: 0,
          max_attempts: 3,
        }, { onConflict: 'professional_id', ignoreDuplicates: true });

      console.log(`[${name}] ✅ Qualified, inserted, and queued`);
      return { name, licenseNumber: license_number, status: 'qualified', zillowUrl, rating, reviewCount };
    } else {
      console.log(`[${name}] ✅ Saved to DB (not qualified)`);
      return { name, licenseNumber: license_number, status: 'not_qualified', zillowUrl, rating, reviewCount };
    }

  } catch (error) {
    console.error(`[${name}] Error:`, error);
    return { name, licenseNumber: license_number, status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      state = 'California', 
      stateAbbr = 'CA', 
      limit = 100, // Reduced default for rate limits
      concurrency = 4, // Exa allows 5 req/sec, use 4 to be safe
    } = await req.json();

    console.log(`\n========================================`);
    console.log(`Re-processing NOT FOUND agents for ${state} (${stateAbbr})`);
    console.log(`Limit: ${limit}, Concurrency: ${concurrency} (Exa rate limit: 5/sec)`);
    console.log(`========================================\n`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const exaApiKey = Deno.env.get('EXA_API_KEY');
    if (!exaApiKey) throw new Error('EXA_API_KEY not configured');

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) throw new Error('FIRECRAWL_API_KEY not configured');

    // Get category ID
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (!category) throw new Error('Real estate agents category not found');

    console.log(`Finding agents without professionals records...`);
    
    // Get agents that don't have a professional record yet
    const { data: licenses, error: licensesError } = await supabase
      .from('state_licenses')
      .select('id, name, license_number, city')
      .eq('state', stateAbbr)
      .is('zillow_scraped_at', null)
      .limit(limit);

    if (licensesError) {
      throw new Error(`Failed to fetch licenses: ${licensesError.message}`);
    }

    if (!licenses || licenses.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No unprocessed licenses found',
          processed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${licenses.length} agents to re-process`);

    const stats: ProcessingStats = {
      processed: 0,
      qualified: 0,
      notQualified: 0,
      duplicates: 0,
      noResults: 0,
      errors: 0
    };

    const qualifiedAgents: AgentResult[] = [];

    // Process in batches
    for (let i = 0; i < licenses.length; i += concurrency) {
      const batch = licenses.slice(i, i + concurrency);
      console.log(`\nProcessing batch ${Math.floor(i/concurrency) + 1}: agents ${i+1}-${Math.min(i+concurrency, licenses.length)}`);

      const batchResults = await Promise.all(
        batch.map(agent => processAgent(agent, state, stateAbbr, category.id, supabase, exaApiKey, firecrawlApiKey))
      );

      for (const result of batchResults) {
        stats.processed++;
        
        switch (result.status) {
          case 'qualified':
            stats.qualified++;
            qualifiedAgents.push(result);
            break;
          case 'not_qualified':
            stats.notQualified++;
            break;
          case 'duplicate':
            stats.duplicates++;
            break;
          case 'no_result':
            stats.noResults++;
            break;
          case 'error':
            stats.errors++;
            break;
        }
      }

      console.log(`Batch complete. Running totals: qualified=${stats.qualified}, not_qualified=${stats.notQualified}, no_results=${stats.noResults}`);

      // Delay to respect Exa 5 req/sec rate limit
      if (i + concurrency < licenses.length) {
        await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2 seconds between batches
      }
    }

    console.log(`\n========================================`);
    console.log(`REPROCESS COMPLETE`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Qualified: ${stats.qualified}`);
    console.log(`Not Qualified: ${stats.notQualified}`);
    console.log(`Duplicates: ${stats.duplicates}`);
    console.log(`No Results: ${stats.noResults}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        state,
        stateAbbr,
        stats,
        qualifiedAgents: qualifiedAgents.slice(0, 50), // Return first 50 qualified for review
        message: `Reprocessed ${stats.processed} agents. Found ${stats.qualified} qualified.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pipeline error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
