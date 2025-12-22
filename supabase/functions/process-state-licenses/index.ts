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

// Search for Zillow agent using Firecrawl search + extract full profile data
async function searchAndScrapeZillowAgent(
  name: string,
  city: string,
  stateAbbr: string,
  firecrawlApiKey: string
): Promise<{ zillowUrl?: string; rating?: number; reviewCount?: number; agentData?: any; fullData?: any } | null> {
  const searchQuery = city 
    ? `${name} Zillow real estate agent ${city} ${stateAbbr}`
    : `${name} Zillow real estate agent ${stateAbbr}`;
  
  console.log(`[${name}] Firecrawl search: "${searchQuery}"`);

  try {
    // Step 1: Search for Zillow profile
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`[${name}] Firecrawl search failed:`, errorText);
      return null;
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.success || !searchData.data || searchData.data.length === 0) {
      console.log(`[${name}] No search results`);
      return null;
    }

    // Find Zillow profile URL from search results
    let zillowUrl: string | undefined;
    for (const result of searchData.data) {
      const url = result.url || result.sourceUrl;
      if (url && url.includes('zillow.com/profile/')) {
        zillowUrl = url;
        break;
      }
    }

    if (!zillowUrl) {
      console.log(`[${name}] No Zillow profile in search results`);
      return null;
    }

    console.log(`[${name}] Found Zillow URL: ${zillowUrl}`);

    // Step 2: Scrape Zillow profile with full schema extraction
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
      return { zillowUrl };
    }

    const scrapeData = await scrapeResponse.json();
    const extractedData = scrapeData.data?.extract || scrapeData.extract || scrapeData.data?.json || scrapeData.json || scrapeData.data || {};
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';

    const rating = extractedData.zillowRating || 0;
    const reviewCount = extractedData.reviewCount || 0;

    console.log(`[${name}] Scraped: rating=${rating || 'NA'}, reviews=${reviewCount || 'NA'}, email=${extractedData.email || 'NA'}, phone=${extractedData.phone || 'NA'}`);

    return {
      zillowUrl,
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

// Process a single agent: search Firecrawl, save ALL agents with data, only synthesize qualified
async function processAgent(
  agent: { name: string; license_number: string; city: string },
  state: string,
  stateAbbr: string,
  categoryId: string,
  supabase: any,
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

    // 2. Search and scrape Zillow profile using Firecrawl with full schema
    const searchResult = await searchAndScrapeZillowAgent(name, city, stateAbbr, firecrawlApiKey);

    if (!searchResult || !searchResult.zillowUrl) {
      console.log(`[${name}] No Zillow profile found`);
      return { name, licenseNumber: license_number, city, status: 'no_result' };
    }

    const { zillowUrl, rating = 0, reviewCount = 0, agentData, fullData = {} } = searchResult;

    console.log(`[${name}] Found: rating=${rating}, reviews=${reviewCount}`);

    // 3. Check qualification: 4.5+ stars and 50+ reviews
    const isQualified = rating >= 4.5 && reviewCount >= 50;
    
    if (!isQualified) {
      console.log(`[${name}] Not qualified (${rating} stars, ${reviewCount} reviews) - will still save`);
    }

    // 4. Check duplicate by Zillow URL (for ALL agents, not just qualified)
    if (zillowUrl) {
      const { data: existingByZillow } = await supabase
        .from('professionals')
        .select('id')
        .eq('zillow_profile_url', zillowUrl)
        .maybeSingle();

      if (existingByZillow) {
        console.log(`[${name}] Duplicate by Zillow URL`);
        return { name, licenseNumber: license_number, city, status: 'duplicate', zillowUrl, rating, reviewCount };
      }
    }

    // 5. Get or create city record
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
    // Save ALL agents (qualified + unqualified), set active based on qualification
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

    // 7. Sync ALL agents to Pipedrive (will happen via DB trigger)
    // The enqueue_professional_for_pipedrive_sync trigger handles this automatically

    // 8. Only trigger websearch and synthesis for QUALIFIED agents
    if (isQualified) {
      console.log(`[${name}] Triggering web search and synthesis for qualified agent...`);
      
      supabase.functions.invoke('search-agent-press-claude', {
        body: { 
          professionalId: professional.id, 
          skipSynthesis: false, 
          skipIfNoPress: false 
        }
      }).catch((err: any) => {
        console.error(`[${name}] Synthesis trigger error (non-blocking):`, err);
      });

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
      console.log(`[${name}] ✅ Saved to DB (not qualified, no synthesis)`);
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
      concurrency = 3, // Lower concurrency for Firecrawl rate limits
      maxAgents = 10000 // Max agents to process
    } = await req.json();

    console.log(`\n========================================`);
    console.log(`Processing ${state} (${stateAbbr}) agents via FIRECRAWL`);
    console.log(`Start: ${startIndex}, Batch: ${batchSize}, Concurrency: ${concurrency}, Max: ${maxAgents}`);
    console.log(`========================================\n`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
          batch.map(agent => processAgent(agent, state, stateAbbr, category.id, supabase, firecrawlApiKey))
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

        // Add a small delay between batches to avoid rate limits
        if (i + concurrency < licenses.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
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
    console.log(`BATCH COMPLETE (Firecrawl)`);
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
