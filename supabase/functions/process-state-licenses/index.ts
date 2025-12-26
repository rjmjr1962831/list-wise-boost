import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const APP_URL = Deno.env.get("APP_URL") || "https://top10lists.us";

// Zillow Agent Profile Schema for Firecrawl JSON extraction - FULL DATA
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
    listingsForSale: { type: "number" },
    yearsExperience: { type: "number" },
    licenseNumber: { type: "string" },
    licenseState: { type: "string" },
    brokerageName: { type: "string" },
    brokerageAddress: { type: "string" },
    brokeragePhone: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    website: { type: "string" },
    serviceAreas: { type: "array", items: { type: "string" } },
    primaryCity: { type: "string" },
    primaryState: { type: "string" },
    specialties: { type: "array", items: { type: "string" } },
    avgListPrice: { type: "string" },
    avgSalePrice: { type: "string" },
    priceRange: { type: "string" },
    bio: { type: "string" },
    headline: { type: "string" },
    recentReviews: { type: "array", items: { type: "object", properties: { text: { type: "string" }, rating: { type: "number" }, date: { type: "string" } } } },
  },
  required: ["name"]
};

// Send failure notification email
async function sendPipelineFailureEmail(
  state: string,
  stateAbbr: string,
  lastIndex: number,
  errorMessage: string,
  stats: ProcessingStats
) {
  try {
    const restartUrl = `${APP_URL}/admin?pipeline_state=${stateAbbr}&pipeline_index=${lastIndex}`;
    
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #dc2626;">🚨 Pipeline Failed: ${state}</h1>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b;"><strong>Error:</strong> ${errorMessage}</p>
        </div>
        
        <h2 style="color: #374151; font-size: 16px;">Progress Before Failure:</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;">Processed</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;"><strong>${stats.processed}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">Qualified</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; color: #16a34a;"><strong>${stats.qualified}</strong></td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;">Not Qualified</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${stats.notQualified}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">Duplicates</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${stats.duplicates}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;">Errors</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; color: #dc2626;">${stats.errors}</td>
          </tr>
        </table>
        
        <p style="color: #6b7280;">The pipeline stopped at index <strong>${lastIndex}</strong>.</p>
        
        <div style="margin: 24px 0;">
          <a href="${restartUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            ▶️ Restart Pipeline from Index ${lastIndex}
          </a>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          This alert was sent by the Top10Lists state pipeline system.
        </p>
      </div>
    `;

    await resend.emails.send({
      from: 'Top10Lists Pipeline <hello@top10lists.us>',
      replyTo: 'robert@top10lists.us',
      to: ['robert@top10lists.us'],
      subject: `🚨 Pipeline Failed: ${state} at index ${lastIndex}`,
      html: emailHtml,
    });

    console.log(`✉️ Failure notification email sent for ${state} at index ${lastIndex}`);
  } catch (emailError) {
    console.error('Failed to send failure notification email:', emailError);
  }
}

interface AgentResult {
  name: string;
  licenseNumber: string;
  city: string;
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

// Step 1: Use EXA to find Zillow URL and get prequalification data (rating/reviews)
async function searchZillowWithExa(
  name: string,
  city: string,
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
        text: true, // Get text content for prequal extraction
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

    // Extract rating (e.g., "5.0", "4.9 out of 5", "Rating: 4.8")
    const ratingPatterns = [
      /(\d+\.?\d*)\s*(?:out of 5|\/5|stars?)/i,
      /rating[:\s]+(\d+\.?\d*)/i,
      /(\d+\.?\d*)\s*\(\d+\s*reviews?\)/i,
      /^\s*(\d+\.?\d*)\s*$/m,
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

    // Extract review count (e.g., "123 reviews", "(45 reviews)", "Reviews: 67")
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

// Step 2: Use FIRECRAWL to enrich qualified agents with full profile data
async function enrichWithFirecrawl(
  name: string,
  zillowUrl: string,
  firecrawlApiKey: string
): Promise<{ rating?: number; reviewCount?: number; agentData?: any; fullData?: any } | null> {
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
        extract: {
          schema: ZILLOW_AGENT_SCHEMA
        },
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
    const extractedData = scrapeData.data?.extract || scrapeData.extract || scrapeData.data?.json || scrapeData.json || scrapeData.data || {};
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';

    const rating = extractedData.zillowRating || 0;
    const reviewCount = extractedData.reviewCount || 0;

    console.log(`[${name}] Firecrawl enriched: rating=${rating || 'NA'}, reviews=${reviewCount || 'NA'}, email=${extractedData.email || 'NA'}, phone=${extractedData.phone || 'NA'}`);

    return {
      rating,
      reviewCount,
      agentData: {
        markdown: markdown.slice(0, 5000),
      },
      fullData: extractedData, // Contains email, phone, website, video, bio, etc.
    };
  } catch (error) {
    console.error(`[${name}] Firecrawl error:`, error);
    return null;
  }
}

// Process a single agent: Exa for prequal, Firecrawl for enrichment of qualified agents
async function processAgent(
  agent: { name: string; license_number: string; city: string },
  state: string,
  stateAbbr: string,
  categoryId: string,
  supabase: any,
  exaApiKey: string,
  firecrawlApiKey: string
): Promise<AgentResult> {
  const { name, license_number, city } = agent;
  
  try {
    // 1. Check for duplicate by license number first
    const { data: existingByLicense } = await supabase
      .from('professionals')
      .select('id, zillow_profile_url')
      .eq('license_number', license_number)
      .maybeSingle();

    if (existingByLicense) {
      console.log(`[${name}] Duplicate by license number`);
      return { name, licenseNumber: license_number, city, status: 'duplicate' };
    }

    // 2. STEP 1: Use EXA to find Zillow URL and get prequalification data
    const exaResult = await searchZillowWithExa(name, city, stateAbbr, exaApiKey);

    if (!exaResult || !exaResult.zillowUrl) {
      console.log(`[${name}] No Zillow profile found via Exa`);
      return { name, licenseNumber: license_number, city, status: 'no_result' };
    }

    const { zillowUrl, rating: exaRating, reviewCount: exaReviewCount } = exaResult;

    console.log(`[${name}] Found: rating=${exaRating ?? 'NA'}, reviews=${exaReviewCount ?? 'NA'}`);

    // 3. Check qualification from Exa data: 4.8+ stars and 20+ reviews
    const isQualified = (exaRating ?? 0) >= 4.8 && (exaReviewCount ?? 0) >= 20;
    
    // 4. Check duplicate by Zillow URL
    const { data: existingByZillow } = await supabase
      .from('professionals')
      .select('id')
      .eq('zillow_profile_url', zillowUrl)
      .maybeSingle();

    if (existingByZillow) {
      console.log(`[${name}] Duplicate by Zillow URL`);
      return { name, licenseNumber: license_number, city, status: 'duplicate', zillowUrl, rating: exaRating, reviewCount: exaReviewCount };
    }

    // 5. STEP 2: If qualified, use FIRECRAWL to enrich with full profile data
    let fullData: any = {};
    let agentData: any = {};
    let rating = exaRating ?? 0;
    let reviewCount = exaReviewCount ?? 0;

    if (isQualified) {
      console.log(`[${name}] QUALIFIED - running Firecrawl enrichment...`);
      const firecrawlResult = await enrichWithFirecrawl(name, zillowUrl, firecrawlApiKey);
      
      if (firecrawlResult) {
        // Use Firecrawl data if available (more accurate)
        rating = firecrawlResult.rating || rating;
        reviewCount = firecrawlResult.reviewCount || reviewCount;
        fullData = firecrawlResult.fullData || {};
        agentData = firecrawlResult.agentData || {};
      }
    } else {
      console.log(`[${name}] Not qualified (${exaRating ?? 'NA'} stars, ${exaReviewCount ?? 'NA'} reviews) - saving to DB but skipping Firecrawl enrichment`);
    }

    // 6. Get or create city record
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
        const { data: newCity, error: cityError } = await supabase
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

        if (cityError) {
          console.error(`[${name}] Failed to create city:`, cityError);
          return { name, licenseNumber: license_number, city: agentCity || 'Unknown', status: 'error', error: `City creation failed` };
        }
        cityRecord = newCity;
      }
    } else {
      // No city available - try to get a default city for the state
      const { data: defaultCity } = await supabase
        .from('cities')
        .select('id')
        .eq('state', state)
        .limit(1)
        .maybeSingle();
      
      if (defaultCity) {
        cityRecord = defaultCity;
      } else {
        // Create a generic city for the state
        const { data: newCity, error: cityError } = await supabase
          .from('cities')
          .insert({
            name: state,
            slug: state.toLowerCase().replace(/\s+/g, '-'),
            state: state,
            state_slug: state.toLowerCase().replace(/\s+/g, '-'),
            active: true
          })
          .select('id')
          .single();

        if (cityError) {
          console.error(`[${name}] Failed to create default city:`, cityError);
          return { name, licenseNumber: license_number, city: 'Unknown', status: 'error', error: `City creation failed` };
        }
        cityRecord = newCity;
      }
    }

    // 6. Insert professional with ALL extracted data from Firecrawl
    // Save ALL agents to DB, but only qualified ones are active
    // Determine type based on qualification and experience
    const agentType = isQualified ? 
      (fullData.yearsExperience && fullData.yearsExperience >= 10 ? 'established' : 'emerging') : 
      'individual';
    
    const insertData: Record<string, any> = {
      name: name,
      license_number: license_number,
      city_id: cityRecord.id,
      category_id: categoryId,
      type: agentType, // Must be: established, emerging, individual, or team
      rank: 999,
      active: isQualified, // Only qualified agents are active
      skip_pipedrive_sync: !isQualified, // Skip Pipedrive sync for unqualified agents
      zillow_profile_url: zillowUrl,
      review_stars_rating: rating,
      num_total_reviews: reviewCount,
      zillow_data_fetched_at: new Date().toISOString(),
    };

    // Map ALL Firecrawl extracted data
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

    // Store sales stats
    insertData.agent_sales_stats = {
      source: 'firecrawl',
      fetchedAt: new Date().toISOString(),
      countAllTime: fullData.totalSales,
      countLast12Months: fullData.salesLast12Months,
      currentListings: fullData.currentListings,
      avgListPrice: fullData.avgListPrice,
      avgSalePrice: fullData.avgSalePrice,
      priceRange: fullData.priceRange,
    };

    // Store brokerage info
    if (fullData.brokerageName || fullData.brokerageAddress) {
      insertData.business_address = {
        name: fullData.brokerageName,
        address: fullData.brokerageAddress,
        phone: fullData.brokeragePhone,
      };
    }

    // Store raw data for reference
    if (agentData?.markdown) {
      insertData.professional_information = {
        source: 'firecrawl',
        markdown: agentData.markdown,
        extractedAt: new Date().toISOString(),
        recentReviews: fullData.recentReviews,
      };
    }

    const { data: professional, error: insertError } = await supabase
      .from('professionals')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      console.error(`[${name}] Insert failed:`, insertError);
      return { name, licenseNumber: license_number, city, status: 'error', error: insertError.message };
    }

    // 7. Queue qualified agents for Exa → DeepSeek → Sonnet enrichment pipeline
    if (isQualified) {
      console.log(`[${name}] Queueing for Exa/DeepSeek/Sonnet enrichment pipeline...`);
      
      // Insert into contact_enrichment_queue for staged processing
      const { error: queueError } = await supabase
        .from('contact_enrichment_queue')
        .upsert({
          professional_id: professional.id,
          status: 'pending',
          stage: 'exa_search',
          reason: 'state_pipeline_qualified',
          attempts: 0,
          max_attempts: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'professional_id',
          ignoreDuplicates: true 
        });
      
      if (queueError) {
        console.error(`[${name}] Queue insert error (non-blocking):`, queueError);
      } else {
        console.log(`[${name}] ✅ Queued for enrichment pipeline`);
      }

      console.log(`[${name}] ✅ Qualified, inserted, and synthesis triggered`);
      return { 
        name, 
        licenseNumber: license_number, 
        city, 
        status: 'qualified',
        zillowUrl,
        rating,
        reviewCount
      };
    } else {
      console.log(`[${name}] ✅ Saved to DB (not qualified, skipped Pipedrive sync)`);
      return { 
        name, 
        licenseNumber: license_number, 
        city, 
        status: 'not_qualified',
        zillowUrl,
        rating,
        reviewCount
      };
    }

  } catch (error) {
    console.error(`[${name}] Error:`, error);
    return { 
      name, 
      licenseNumber: license_number, 
      city, 
      status: 'error', 
      error: error instanceof Error ? error.message : String(error) 
    };
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
      startIndex = 0, 
      batchSize = 50,
      concurrency = 100, // Firecrawl upgraded plan supports 100 concurrent requests
      maxAgents = 10000 // Max agents to process
    } = await req.json();

    console.log(`\n========================================`);
    console.log(`Processing ${state} (${stateAbbr}) agents via EXA→PREQUAL→FIRECRAWL`);
    console.log(`Start: ${startIndex}, Batch: ${batchSize}, Concurrency: ${concurrency}, Max: ${maxAgents}`);
    console.log(`========================================\n`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const exaApiKey = Deno.env.get('EXA_API_KEY');
    if (!exaApiKey) {
      throw new Error('EXA_API_KEY not configured');
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY not configured');
    }

    // Get category ID
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (!category) {
      throw new Error('Real estate agents category not found');
    }

    // Calculate the end index based on maxAgents
    const endIndex = Math.min(startIndex + batchSize, startIndex + maxAgents);
    const actualBatchSize = endIndex - startIndex;

    // Get agents from state_licenses
    const { data: licenses, error: licensesError } = await supabase
      .from('state_licenses')
      .select('name, license_number, city')
      .eq('state', stateAbbr)
      .order('name', { ascending: true })
      .range(startIndex, startIndex + actualBatchSize - 1);

    if (licensesError) {
      throw new Error(`Failed to fetch licenses: ${licensesError.message}`);
    }

    if (!licenses || licenses.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No more licenses to process',
          startIndex,
          processed: 0,
          complete: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched ${licenses.length} licenses to process`);

    const stats: ProcessingStats = {
      processed: 0,
      qualified: 0,
      notQualified: 0,
      duplicates: 0,
      noResults: 0,
      errors: 0
    };

    const results: AgentResult[] = [];
    let currentIndex = startIndex;

    // Process in batches of `concurrency`
    try {
      for (let i = 0; i < licenses.length; i += concurrency) {
        const batch = licenses.slice(i, i + concurrency);
        currentIndex = startIndex + i;
        console.log(`\nProcessing batch ${Math.floor(i/concurrency) + 1}: agents ${i+1}-${Math.min(i+concurrency, licenses.length)} (index ${currentIndex})`);

        const batchResults = await Promise.all(
          batch.map(agent => processAgent(agent, state, stateAbbr, category.id, supabase, exaApiKey, firecrawlApiKey))
        );

        for (const result of batchResults) {
          results.push(result);
          stats.processed++;
          
          switch (result.status) {
            case 'qualified':
              stats.qualified++;
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

        console.log(`Batch complete. Running totals: qualified=${stats.qualified}, not_qualified=${stats.notQualified}, duplicates=${stats.duplicates}, no_results=${stats.noResults}`);

        // Minimal delay between batches (Firecrawl upgraded to 100 concurrency)
        if (i + concurrency < licenses.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (batchError) {
      // Send email on batch processing failure
      const errorMessage = batchError instanceof Error ? batchError.message : String(batchError);
      console.error(`Batch processing failed at index ${currentIndex}:`, errorMessage);
      
      await sendPipelineFailureEmail(state, stateAbbr, currentIndex, errorMessage, stats);
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          state,
          stateAbbr,
          failedAtIndex: currentIndex,
          stats,
          emailSent: true,
          message: `Pipeline failed at index ${currentIndex}. Check your email for restart link.`
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nextIndex = startIndex + licenses.length;
    
    // Check if there are more licenses (up to maxAgents limit)
    const { count } = await supabase
      .from('state_licenses')
      .select('*', { count: 'exact', head: true })
      .eq('state', stateAbbr);

    const totalRemaining = (count || 0) - nextIndex;
    const hasMore = nextIndex < Math.min(count || 0, startIndex + maxAgents);

    console.log(`\n========================================`);
    console.log(`BATCH COMPLETE (Exa→Prequal→Firecrawl)`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Qualified: ${stats.qualified}`);
    console.log(`Not Qualified: ${stats.notQualified}`);
    console.log(`Duplicates: ${stats.duplicates}`);
    console.log(`No Results: ${stats.noResults}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Next Index: ${hasMore ? nextIndex : 'COMPLETE'}`);
    console.log(`Total Remaining in DB: ${totalRemaining}`);
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        state,
        stateAbbr,
        startIndex,
        processed: stats.processed,
        stats,
        nextIndex: hasMore ? nextIndex : null,
        hasMore,
        totalRemaining,
        method: 'firecrawl'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pipeline error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
