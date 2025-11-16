import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

function isRetryableError(error: any): boolean {
  // Check for network errors
  if (error.name === 'TypeError' && error.message?.includes('fetch')) {
    return true;
  }
  
  // Check for HTTP status codes
  if (error.status) {
    // Retry on rate limits (429) and server errors (5xx)
    if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
      return true;
    }
    // Don't retry on client errors (4xx) except 429
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }
  
  // Check for specific Apify errors that are retryable
  if (error.message) {
    const retryablePatterns = [
      'timeout',
      'network',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'rate limit'
    ];
    
    const message = error.message.toLowerCase();
    return retryablePatterns.some(pattern => message.includes(pattern));
  }
  
  return false;
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  operationName: string
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = options;
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable || attempt === maxRetries) {
        console.error(`${operationName} failed after ${attempt + 1} attempts:`, lastError);
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      
      console.log(`${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms...`, {
        error: lastError.message,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

async function sendFailureAlert(functionName: string, error: string, context?: any, retriesExhausted: boolean = true) {
  if (!retriesExhausted) {
    console.log('Skipping alert - will retry operation');
    return;
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Cannot send alert: Supabase credentials missing');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.functions.invoke('send-api-failure-alert', {
      body: {
        functionName,
        error,
        context,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error('Failed to send alert email:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text().catch(() => '');
    let city = '' as string;
    let state = '' as string;
    let categoryId: string | undefined;
    let cityId: string | undefined;

    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText);
        city = parsed.city;
        state = parsed.state;
        categoryId = parsed.categoryId;
        cityId = parsed.cityId;
      } catch (_e) {
        console.warn('Invalid JSON body; falling back to empty payload. Body preview:', bodyText.slice(0, 200));
      }
    }

    if (!city || !state) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing city or state in request body',
          hint: 'Send JSON: { "city": "Anchorage", "state": "Alaska", "cityId": "...", "categoryId": "..." }'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const apiToken = Deno.env.get('APIFY_API_KEY')?.trim() || Deno.env.get('APIFY_API_TOKEN')?.trim();

    if (!apiToken) {
      const error = 'Apify API key/token not configured';
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state });
      throw new Error(error);
    }

    // Load zip code data and find one for this city
    let zipCode: string | null = null;
    try {
      const zipDataResp = await fetch('https://raw.githubusercontent.com/lovable-dev/lovable-agent-importer/main/src/data/zipCodeData.json');
      if (zipDataResp.ok) {
        const zipData = await zipDataResp.json();
        const cityZips = zipData.filter((z: any) => 
          z.city.toLowerCase() === city.toLowerCase() && 
          (z.state.toLowerCase() === state.toLowerCase() || z.stateAbbreviation.toLowerCase() === state.toLowerCase())
        );
        if (cityZips.length > 0) {
          // Pick the zip with highest agent value
          const bestZip = cityZips.sort((a: any, b: any) => b.agentValue - a.agentValue)[0];
          zipCode = bestZip.zipCode;
          console.log(`Found zip code ${zipCode} for ${city}, ${state}`);
        }
      }
    } catch (e) {
      console.warn('Could not load zip code data, using city/state format:', e);
    }

    const startTime = Date.now();
    console.log('Import started:', {
      city,
      state,
      cityId,
      categoryId,
      timestamp: new Date().toISOString()
    });

    const query = zipCode || `real estate agent in ${city}, ${state}`;
    console.log(`Agent discovery query: ${query}`);

    // STEP 1: Use memo23 Zillow scraper
    const discoveryActorId = 'memo23/apify-zillow-agents-cheerio';
    console.log(`Step 1: Finding agents with ${discoveryActorId}`);

    // Convert state to 2-letter abbreviation if needed
    const stateAbbrev = state.length > 2 ? state.slice(0, 2).toUpperCase() : state.toUpperCase();
    
    // Build Zillow agent search URL
    const searchUrl = `https://www.zillow.com/professionals/real-estate-agent-reviews/${city.toLowerCase().replace(/\s+/g, '-')}-${stateAbbrev.toLowerCase()}/`;
    
    const discoveryInput = {
      startUrls: [{ url: searchUrl }],
      maxItems: 50,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      }
    };

    // Start discovery actor run with retry logic
    const discoveryResp = await retryWithBackoff(
      async () => {
        const resp = await fetch(`https://api.apify.com/v2/acts/${discoveryActorId}/runs?token=${apiToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discoveryInput),
        });
        
        if (!resp.ok) {
          const errorText = await resp.text();
          console.error(`Discovery actor start error: ${resp.status}`, errorText);
          const error: any = new Error(`Discovery actor failed: ${resp.status}`);
          error.status = resp.status;
          error.responseText = errorText;
          throw error;
        }
        
        return resp;
      },
      {
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2
      },
      'Start Discovery Actor'
    );

    const discoveryRun = await discoveryResp.json();
    const discoveryRunId = discoveryRun.data.id;
    console.log('Discovery run started:', discoveryRunId);

    // Poll for discovery completion with retry logic
    let discoveryStatus = discoveryRun.data.status;
    let discoveryAttempts = 0;
    while (discoveryStatus !== 'SUCCEEDED' && discoveryStatus !== 'FAILED' && discoveryAttempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const statusResp = await retryWithBackoff(
          async () => {
            const resp = await fetch(`https://api.apify.com/v2/acts/${discoveryActorId}/runs/${discoveryRunId}?token=${apiToken}`);
            
            if (!resp.ok) {
              const error: any = new Error(`Status check failed: ${resp.status}`);
              error.status = resp.status;
              throw error;
            }
            
            return resp;
          },
          {
            maxRetries: 3,
            initialDelayMs: 500,
            maxDelayMs: 5000,
            backoffMultiplier: 2
          },
          'Poll Actor Status'
        );
        
        const statusData = await statusResp.json();
        discoveryStatus = statusData.data.status;
        console.log(`Discovery status: ${discoveryStatus} (attempt ${discoveryAttempts + 1})`);
      } catch (error) {
        console.error('Status polling error (will retry):', error);
        // Continue polling even if status check fails
      }
      
      discoveryAttempts++;
    }

    if (discoveryStatus !== 'SUCCEEDED') {
      const error = `Discovery run did not complete: ${discoveryStatus}`;
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state, discoveryRunId }, true);
      throw new Error(error);
    }

    // Get discovered agent profiles with comprehensive data from scrapestorm
    const discoveryDatasetId = discoveryRun.data.defaultDatasetId;
    const discoveryDataResp = await retryWithBackoff(
      async () => {
        const resp = await fetch(`https://api.apify.com/v2/datasets/${discoveryDatasetId}/items?token=${apiToken}`);
        
        if (!resp.ok) {
          const error: any = new Error(`Dataset fetch failed: ${resp.status}`);
          error.status = resp.status;
          throw error;
        }
        
        return resp;
      },
      {
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2
      },
      'Fetch Discovery Dataset'
    );
    
    let rawAgents = await discoveryDataResp.json();
    console.log(`Primary actor (${discoveryActorId}) returned ${rawAgents.length} items`);

    // Detect property-listing dataset (wrong actor output) OR empty results and fallback to a dedicated agents actor
    const needsFallback = !Array.isArray(rawAgents) || rawAgents.length === 0 || 
      (rawAgents.length > 0 && ('zpid' in rawAgents[0] || 'statusType' in rawAgents[0] || 'addressCity' in rawAgents[0]));
    
    if (needsFallback) {
      if (rawAgents.length === 0) {
        console.log('Primary actor returned 0 items; falling back to hello.datawizards~real-estate-agents-scraper');
      } else {
        console.log('Primary actor returned property listings; falling back to hello.datawizards~real-estate-agents-scraper');
      }
      const fallbackActorId = 'hello.datawizards~real-estate-agents-scraper';
      const fallbackInput = {
        search_query: `${city}, ${stateAbbrev}`,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };

        // Start fallback actor
        const fbStart = await retryWithBackoff(
          async () => {
            const resp = await fetch(`https://api.apify.com/v2/acts/${fallbackActorId}/runs?token=${apiToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fallbackInput),
            });
            if (!resp.ok) {
              const errTxt = await resp.text();
              const err: any = new Error(`Fallback actor failed: ${resp.status}`);
              err.status = resp.status; err.responseText = errTxt; throw err;
            }
            return resp;
          },
          { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 },
          'Start Fallback Actor'
        );
        const fbRun = await fbStart.json();
        const fbRunId = fbRun.data.id;

        // Poll fallback
        let fbStatus = fbRun.data.status; let fbAttempts = 0;
        while (fbStatus !== 'SUCCEEDED' && fbStatus !== 'FAILED' && fbAttempts < 60) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const st = await fetch(`https://api.apify.com/v2/acts/${fallbackActorId}/runs/${fbRunId}?token=${apiToken}`);
            if (!st.ok) break;
            const js = await st.json();
            fbStatus = js.data.status;
            console.log(`Fallback status: ${fbStatus} (attempt ${fbAttempts + 1})`);
          } catch (_) {}
          fbAttempts++;
        }

        if (fbStatus === 'SUCCEEDED') {
          const fbDatasetId = fbRun.data.defaultDatasetId;
          const fbDataResp = await fetch(`https://api.apify.com/v2/datasets/${fbDatasetId}/items?token=${apiToken}`);
          if (fbDataResp.ok) {
            rawAgents = await fbDataResp.json();
            console.log(`Fallback actor (${fallbackActorId}) returned ${rawAgents.length} items`);
          } else {
            console.warn('Fallback dataset fetch failed');
          }
      } else {
        console.warn(`Fallback actor did not succeed: ${fbStatus}`);
      }
    }


    if (!Array.isArray(rawAgents) || rawAgents.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        summary: { created: 0, updated: 0, skipped: 0, total: 0 },
        agents: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Enrich agents with Redfin data (nested API calls)
    console.log(`Step 2: Enriching ${rawAgents.length} agents with Redfin profiles and reviews`);
    
    for (let i = 0; i < Math.min(rawAgents.length, 15); i++) {
      const agent = rawAgents[i];
      const agentName = agent.name || agent.agentName || agent.fullName;
      
      if (!agentName) {
        console.log(`No name for agent #${i+1}, skipping Redfin enrichment`);
        continue;
      }

      try {
        console.log(`Finding Redfin profile for agent #${i+1}: ${agentName}`);
        
        // Step 2a: Search for agent on Redfin to get their Redfin URL
        const searchQuery = `${agentName} ${city} ${state} real estate agent`;
        const redfinSearchUrl = `https://www.redfin.com/real-estate-agents/${city.toLowerCase().replace(/\s+/g, '-')}-${stateAbbrev.toLowerCase()}`;
        
        // Use a Redfin agent search/scraper to find the agent's Redfin profile
        // For now, we'll construct a likely Redfin URL pattern and try the review scraper
        // Redfin URLs are typically: https://www.redfin.com/real-estate-agents/[agent-name-slug]
        const nameslug = agentName.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        
        const possibleRedfinUrl = `https://www.redfin.com/real-estate-agents/${nameslug}`;
        
        console.log(`Attempting Redfin URL: ${possibleRedfinUrl}`);
        
        // Step 2b: Fetch Redfin reviews using the constructed URL
        const reviewActorId = 'scrapingxpert/redfin-agent-reviews-scraper';
        const reviewInput = {
          zillowUrl: possibleRedfinUrl, // Despite the param name, this should be a Redfin URL
          proxyConfiguration: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
          }
        };

        const reviewRunResp = await fetch(
          `https://api.apify.com/v2/acts/${reviewActorId}/runs?token=${apiToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewInput),
          }
        );

        if (reviewRunResp.ok) {
          const reviewRun = await reviewRunResp.json();
          const reviewRunId = reviewRun.data.id;
          
          // Poll for completion (max 20 seconds for Redfin)
          let reviewStatus = reviewRun.data.status;
          let attempts = 0;
          while (reviewStatus !== 'SUCCEEDED' && reviewStatus !== 'FAILED' && attempts < 10) {
            await new Promise(r => setTimeout(r, 2000));
            const statusResp = await fetch(
              `https://api.apify.com/v2/acts/${reviewActorId}/runs/${reviewRunId}?token=${apiToken}`
            );
            if (statusResp.ok) {
              const statusData = await statusResp.json();
              reviewStatus = statusData.data.status;
            }
            attempts++;
          }

          if (reviewStatus === 'SUCCEEDED') {
            const datasetId = reviewRun.data.defaultDatasetId;
            const dataResp = await fetch(
              `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
            );
            if (dataResp.ok) {
              const reviews = await dataResp.json();
              if (reviews && reviews.length > 0) {
                rawAgents[i].redfinReviews = reviews;
                rawAgents[i].redfinReviewCount = reviews.length;
                rawAgents[i].redfinUrl = possibleRedfinUrl;
                console.log(`✓ Fetched ${reviews.length} Redfin reviews for agent #${i+1}`);
              } else {
                console.log(`No Redfin reviews found for agent #${i+1}`);
              }
            }
          } else {
            console.log(`Redfin review fetch did not complete for agent #${i+1}: ${reviewStatus}`);
          }
        }
      } catch (reviewError) {
        console.error(`Error fetching Redfin data for agent #${i+1}:`, reviewError);
      }
      
      // Delay between enrichment calls to avoid rate limits
      if (i < Math.min(rawAgents.length, 15) - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`Completed Redfin enrichment phase`);

    // Limit to top 15 agents (post-enrichment)
    const items = rawAgents.slice(0, 15);


    function mapAgent(agent: any) {
      // Log first agent to help debug field mappings
      if (items.indexOf(agent) === 0) {
        console.log('First agent fields:', Object.keys(agent));
        console.log('First agent sample:', JSON.stringify(agent).substring(0, 500));
      }
      
      // Handle hello.datawizards/Real-Estate-Agents-Scraper format (prioritized)
      const name = agent.agentName || agent.name || agent['Business Name'] || agent.title || agent.fullName || agent.agent_name || '';
      const phone = agent.phoneNumber || agent.phone || agent['Phone Number'] || agent.call_number || agent.contact_phone || null;
      const website = agent.profileUrl || agent.url || agent.website || agent['Website'] || agent.site || agent.domain || agent.profileLink || agent.profile_url || null;
      const thumbnail = agent.photoUrl || agent.photo || agent.image || agent.profilePhoto || agent['Profile Photo'] || agent.thumbnail || agent.logo || agent.profilePhotoSrc || agent.photo_url || agent.image_url || null;
      const address = agent.address || agent.location || agent['Address'] || agent.full_address || agent.city || agent.office_address || '';
      const rating = agent.rating || agent.reviewRating || agent['Rating'] || agent.stars || agent.score || agent.review_rating || 4.5;
      const reviews = agent.reviewCount || agent.reviewsCount || agent.reviews || agent['Review Count'] || agent.review_count || agent.reviews_count || agent.total_reviews || 0;
      const company = agent.brokerageName || agent.brokerage || agent.company || agent.businessName || agent['Business Name'] || 'Independent';
      const zuid = agent.zuid || agent.zillowId || null;
      const totalSales = agent.salesLast12Months || agent.totalSales || agent.recentSales || null;
      const currentListings = agent.activeListings || agent.currentListings || null;
      const yearsExperience = agent.yearsOfExperience || agent.yearsExperience || agent.experience || null;
      
      let categories: string[] = [];
      if (Array.isArray(agent.specialties)) {
        categories = agent.specialties;
      } else if (Array.isArray(agent.categories)) {
        categories = agent.categories;
      } else if (agent.subtypes) {
        categories = String(agent.subtypes).split(',');
      } else if (agent.category) {
        categories = [agent.category];
      }

      const categoryText = categories.join(' ').toLowerCase();
      const isRealEstateAgent = categoryText.includes('real estate') || 
                                 categoryText.includes('realtor') ||
                                 true; // Zillow scraper only returns agents

      return {
        isRealEstateAgent,
        fullName: name,
        name,
        email: website ? `info@${String(website).replace(/https?:\/\/(www\.)?/, '').split('/')[0]}` : null,
        phoneNumber: phone,
        phone,
        businessName: company,
        profileLink: website,
        website,
        reviewStarsRating: Number(rating) || 4.5,
        rating,
        numTotalReviews: Number(reviews) || 0,
        reviews,
        reviewCount: Number(reviews) || 0,
        specialties: extractSpecialtiesFromCategories(categories),
        thumbnail,
        profilePhotoSrc: thumbnail,
        location: address,
        address,
        full_address: address,
        zuid,
        totalSales: totalSales ? Number(totalSales) : null,
        currentListings: currentListings ? Number(currentListings) : null,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
      };
    }

    console.log(`Using Apify source, raw count: ${items.length}`);

    const transformedAgents = (items || [])
      .map((a: any) => mapAgent(a))
      .filter((a: any) => a && a.isRealEstateAgent && a.name)
      .slice(0, 10);

    console.log(`Transformed ${transformedAgents.length} agents with complete data`);

    if (!categoryId || !cityId) {
      console.warn('Missing categoryId or cityId - returning agents without saving');
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing categoryId or cityId',
        agents: transformedAgents
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save agents to database
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < transformedAgents.length; i++) {
      const agent = transformedAgents[i];
      
      try {
        await retryWithBackoff(
          async () => {
            // Check if agent already exists
            const { data: existing, error: checkError } = await supabase
              .from('professionals')
              .select('id')
              .eq('name', agent.name)
              .eq('city_id', cityId)
              .eq('category_id', categoryId)
              .maybeSingle();

            if (checkError) throw checkError;

            const professionalData = {
              name: agent.name,
              company: agent.businessName,
              phone: agent.phone,
              email: 'info@zillow.com',
              website: agent.website,
              image_url: agent.profilePhotoSrc,
              specialty: agent.specialties || ["Buyer's Agent", "Listing Agent"],
              city_id: cityId,
              category_id: categoryId,
              type: i < 5 ? 'established' : 'emerging',
              rank: i + 1,
              active: true,
              zuid: agent.zuid,
              total_sales: agent.totalSales,
              current_listings: agent.currentListings,
            };

            if (existing) {
              // Update existing agent
              const { error: updateError } = await supabase
                .from('professionals')
                .update(professionalData)
                .eq('id', existing.id);

              if (updateError) throw updateError;
              updated++;
              console.log(`Updated ${agent.name}`);
            } else {
              // Insert new agent
              const { error: insertError } = await supabase
                .from('professionals')
                .insert([professionalData]);

              if (insertError) throw insertError;
              created++;
              console.log(`Created ${agent.name}`);
            }
          },
          {
            maxRetries: 3,
            initialDelayMs: 500,
            maxDelayMs: 5000,
            backoffMultiplier: 2
          },
          `Save Agent: ${agent.name}`
        );
      } catch (err) {
        console.error(`Error processing ${agent.name}:`, err);
        skipped++;
      }
    }

    console.log('Import completed:', {
      city,
      state,
      totalAgents: transformedAgents.length,
      created,
      updated,
      skipped,
      duration: `${Date.now() - startTime}ms`
    });

    const summary = {
      total: transformedAgents.length,
      created,
      updated,
      skipped
    };

    console.log('Import summary:', summary);

    return new Response(JSON.stringify({
      success: true,
      summary,
      agents: transformedAgents
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-zillow-agents-bulk function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractSpecialtiesFromCategories(categories: string[]): string[] {
  const specialtyMap: { [key: string]: string } = {
    'buyer': "Buyer's Agent",
    'seller': "Listing Agent",
    'listing': "Listing Agent",
    'consultant': 'Real Estate Consultant',
    'relocation': 'Relocation Specialist',
    'investment': 'Investment Properties',
    'commercial': 'Commercial Real Estate',
    'residential': 'Residential Real Estate',
  };

  const specialties: string[] = [];
  const lowercaseCategories = categories.join(' ').toLowerCase();

  for (const [key, value] of Object.entries(specialtyMap)) {
    if (lowercaseCategories.includes(key)) {
      specialties.push(value);
    }
  }

  return specialties.length > 0 ? specialties : ["Buyer's Agent", "Listing Agent"];
}
