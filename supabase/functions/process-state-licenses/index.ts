import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const APP_URL = Deno.env.get("APP_URL") || "https://top10lists.us";

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

// Search for Zillow agent using Firecrawl search
async function searchZillowAgent(
  name: string,
  city: string,
  stateAbbr: string,
  firecrawlApiKey: string
): Promise<{ zillowUrl?: string; rating?: number; reviewCount?: number; agentData?: any } | null> {
  const searchQuery = city 
    ? `${name} Zillow real estate agent ${city} ${stateAbbr}`
    : `${name} Zillow real estate agent ${stateAbbr}`;
  
  console.log(`[${name}] Firecrawl search: "${searchQuery}"`);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${name}] Firecrawl search failed:`, errorText);
      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.data || data.data.length === 0) {
      console.log(`[${name}] No search results`);
      return null;
    }

    // Find Zillow profile URL from search results
    let zillowUrl: string | undefined;
    let zillowResult: any = null;

    for (const result of data.data) {
      const url = result.url || result.sourceUrl;
      if (url && url.includes('zillow.com/profile/')) {
        zillowUrl = url;
        zillowResult = result;
        break;
      }
    }

    if (!zillowUrl) {
      console.log(`[${name}] No Zillow profile in search results`);
      return null;
    }

    console.log(`[${name}] Found Zillow URL: ${zillowUrl}`);

    // Now scrape the Zillow profile page to get rating and review count
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: zillowUrl,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!scrapeResponse.ok) {
      console.error(`[${name}] Firecrawl scrape failed`);
      // Return what we have even if scrape fails
      return { zillowUrl };
    }

    const scrapeData = await scrapeResponse.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';

    // Extract rating and review count from markdown
    // Look for patterns like "4.9 (523 reviews)" or "4.9 stars" and "523 reviews"
    let rating: number | undefined;
    let reviewCount: number | undefined;

    // Pattern 1: "X.X (NNN reviews)"
    const ratingReviewMatch = markdown.match(/(\d+\.?\d*)\s*\((\d+)\s*reviews?\)/i);
    if (ratingReviewMatch) {
      rating = parseFloat(ratingReviewMatch[1]);
      reviewCount = parseInt(ratingReviewMatch[2]);
    }

    // Pattern 2: "X.X stars" or "X.X rating"
    if (!rating) {
      const ratingMatch = markdown.match(/(\d+\.?\d*)\s*(?:stars?|rating)/i);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
      }
    }

    // Pattern 3: "NNN reviews" or "NNN total reviews"
    if (!reviewCount) {
      const reviewMatch = markdown.match(/(\d+)\s*(?:total\s+)?reviews?/i);
      if (reviewMatch) {
        reviewCount = parseInt(reviewMatch[1]);
      }
    }

    // Pattern 4: Look for star rating like "★★★★★" or "4.9/5"
    if (!rating) {
      const starMatch = markdown.match(/(\d+\.?\d*)\/5/);
      if (starMatch) {
        rating = parseFloat(starMatch[1]);
      }
    }

    console.log(`[${name}] Scraped: rating=${rating || 'NA'}, reviews=${reviewCount || 'NA'}`);

    return {
      zillowUrl,
      rating,
      reviewCount,
      agentData: {
        markdown: markdown.slice(0, 2000), // Store first 2000 chars for reference
        scrapeData: scrapeData.data || scrapeData,
      },
    };
  } catch (error) {
    console.error(`[${name}] Firecrawl error:`, error);
    return null;
  }
}

// Process a single agent: search Firecrawl, qualify, insert if good
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

    // 2. Search for Zillow profile using Firecrawl
    const searchResult = await searchZillowAgent(name, city, stateAbbr, firecrawlApiKey);

    if (!searchResult || !searchResult.zillowUrl) {
      console.log(`[${name}] No Zillow profile found`);
      return { name, licenseNumber: license_number, city, status: 'no_result' };
    }

    const { zillowUrl, rating = 0, reviewCount = 0, agentData } = searchResult;

    console.log(`[${name}] Found: rating=${rating}, reviews=${reviewCount}`);

    // 3. Check qualification: 4.5+ stars and 50+ reviews
    if (rating < 4.5 || reviewCount < 50) {
      console.log(`[${name}] Not qualified (${rating} stars, ${reviewCount} reviews)`);
      return { 
        name, 
        licenseNumber: license_number, 
        city, 
        status: 'not_qualified',
        rating,
        reviewCount,
        zillowUrl
      };
    }

    // 4. Check duplicate by Zillow URL
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
    const agentCity = city || null;
    
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

    // 6. Insert professional
    const { data: professional, error: insertError } = await supabase
      .from('professionals')
      .insert({
        name: name,
        license_number: license_number,
        city_id: cityRecord.id,
        category_id: categoryId,
        type: 'scraped',
        rank: 999, // Will be updated later
        active: true,
        zillow_profile_url: zillowUrl,
        review_stars_rating: rating,
        num_total_reviews: reviewCount,
        raw_scraper_data: agentData,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error(`[${name}] Insert failed:`, insertError);
      return { name, licenseNumber: license_number, city, status: 'error', error: insertError.message };
    }

    // 7. Queue for enrichment
    await supabase
      .from('contact_enrichment_queue')
      .insert({
        professional_id: professional.id,
        status: 'pending',
        reason: 'New qualified agent from state pipeline (Firecrawl)',
        stage: 'queued'
      });

    console.log(`[${name}] ✅ Qualified and queued for enrichment`);
    return { 
      name, 
      licenseNumber: license_number, 
      city, 
      status: 'qualified',
      zillowUrl,
      rating,
      reviewCount
    };

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
