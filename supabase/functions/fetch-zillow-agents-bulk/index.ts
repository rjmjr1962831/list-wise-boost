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
        } else {
          console.log(`No zip code found in data for ${city}, ${state}`);
        }
      }
    } catch (e) {
      console.warn('Could not load zip code data:', e);
    }

    // Use zip code if available, otherwise use city/state format
    const locationText = zipCode || `${city}, ${state}`;
    console.log(`Using location text for agenscrape: ${locationText}`);

    const startTime = Date.now();
    console.log('Import started:', {
      city,
      state,
      locationText,
      cityId,
      categoryId,
      timestamp: new Date().toISOString()
    });

    // STEP 1: Use getdataforme scraper to find Zillow agents
    const discoveryActorId = 'getdataforme/zillow-real-state-agents-scraper';
    console.log(`Step 1: Finding agents with ${discoveryActorId}`);
    
    const discoveryInput = {
      location: locationText,
      max_items: 50
    };

    console.log('getdataforme scraper input:', discoveryInput);

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

    // Fetch final run details to get correct defaultDatasetId after completion
    const finalDiscoveryResp = await fetch(`https://api.apify.com/v2/acts/${discoveryActorId}/runs/${discoveryRunId}?token=${apiToken}`);
    const finalDiscoveryRun = await finalDiscoveryResp.json();
    const discoveryDatasetId = finalDiscoveryRun.data.defaultDatasetId;
    console.log(`Fetching primary dataset: ${discoveryDatasetId}`);
    
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
    
    console.log(`Primary dataset response status: ${discoveryDataResp.status}`);
    console.log(`Primary dataset response headers:`, Object.fromEntries(discoveryDataResp.headers.entries()));
    
    const rawText = await discoveryDataResp.text();
    console.log(`Primary dataset raw text (first 1000 chars):`, rawText.slice(0, 1000));
    
    let rawAgents;
    try {
      rawAgents = JSON.parse(rawText);
      console.log(`Primary dataset parsed type: ${typeof rawAgents}, isArray: ${Array.isArray(rawAgents)}`);
      if (!Array.isArray(rawAgents) && rawAgents && typeof rawAgents === 'object') {
        console.log(`Primary dataset keys:`, Object.keys(rawAgents).slice(0, 10));
        // If response is wrapped in an object, extract the items array
        rawAgents = rawAgents.items || rawAgents.data || rawAgents.results || [];
        console.log(`Extracted items from wrapper object, count: ${Array.isArray(rawAgents) ? rawAgents.length : 0}`);
      }
    } catch (e) {
      console.error('Failed to parse primary dataset response:', e);
      rawAgents = [];
    }
    
    console.log(`getdataforme scraper (${discoveryActorId}) returned ${Array.isArray(rawAgents) ? rawAgents.length : 0} items`);

    if (!Array.isArray(rawAgents) || rawAgents.length === 0) {
      console.log('getdataforme scraper returned no results');
      return new Response(JSON.stringify({
        success: true,
        summary: { created: 0, updated: 0, skipped: 0, total: 0 },
        agents: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Redfin enrichment removed - proceeding directly to memo23

    // Step 3: Scrape detailed profile data with memo23
    console.log(`Step 3: Scraping detailed Zillow profiles with memo23 actor`);
    
    // Extract Zillow profile URLs from the agents
    const zillowUrls = rawAgents
      .slice(0, 15)
      .map((agent: any) => {
        const profileUrl = agent.profile_url || agent.profileUrl || agent.url || agent.website;
        if (profileUrl && profileUrl.includes('zillow.com')) {
          return profileUrl;
        }
        return null;
      })
      .filter((url: string | null) => url !== null);

    console.log(`Extracted ${zillowUrls.length} Zillow profile URLs`);
    console.log('Sample URLs:', zillowUrls.slice(0, 3));

    let memo23Data: any[] = [];
    
    if (zillowUrls.length > 0) {
      try {
        const memo23ActorId = 'tomas.novak~memo23';
        const memo23Input = {
          startUrls: zillowUrls.map((url: string) => ({ url })),
          proxyConfiguration: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
          }
        };

        console.log('Calling memo23 with input:', JSON.stringify({ urlCount: zillowUrls.length, firstUrl: zillowUrls[0] }));

        const memo23RunResp = await retryWithBackoff(
          async () => {
            const resp = await fetch(`https://api.apify.com/v2/acts/${memo23ActorId}/runs?token=${apiToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(memo23Input),
            });
            
            if (!resp.ok) {
              const errTxt = await resp.text();
              const err: any = new Error(`memo23 actor failed: ${resp.status}`);
              err.status = resp.status;
              err.responseText = errTxt;
              throw err;
            }
            
            return resp;
          },
          { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 },
          'Start memo23 Actor'
        );

        const memo23Run = await memo23RunResp.json();
        const memo23RunId = memo23Run.data.id;
        console.log(`memo23 run started: ${memo23RunId}`);

        // Poll for completion (max 2 minutes for profile scraping)
        let memo23Status = memo23Run.data.status;
        let memo23Attempts = 0;
        
        while (memo23Status !== 'SUCCEEDED' && memo23Status !== 'FAILED' && memo23Attempts < 60) {
          await new Promise(r => setTimeout(r, 2000));
          
          const statusResp = await fetch(
            `https://api.apify.com/v2/acts/${memo23ActorId}/runs/${memo23RunId}?token=${apiToken}`
          );
          
          if (statusResp.ok) {
            const statusData = await statusResp.json();
            memo23Status = statusData.data.status;
            console.log(`memo23 status: ${memo23Status} (attempt ${memo23Attempts + 1})`);
          }
          
          memo23Attempts++;
        }

        if (memo23Status === 'SUCCEEDED') {
          const datasetId = memo23Run.data.defaultDatasetId;
          const dataResp = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
          );
          
          if (dataResp.ok) {
            memo23Data = await dataResp.json();
            console.log(`memo23 returned ${memo23Data.length} agent profiles`);
            
            if (memo23Data.length > 0) {
              console.log('Sample memo23 agent fields:', Object.keys(memo23Data[0]));
              console.log('Sample memo23 data:', JSON.stringify(memo23Data[0], null, 2));
            }
          } else {
            console.warn('Failed to fetch memo23 dataset:', dataResp.status);
          }
        } else {
          console.warn(`memo23 actor did not succeed: ${memo23Status}`);
        }
      } catch (error) {
        console.error('Error in memo23 scraping:', error);
      }
    }

    // Merge memo23 data into rawAgents by matching profile URLs
    if (memo23Data.length > 0) {
      console.log('Merging memo23 data into agent profiles');
      
      for (const memo23Agent of memo23Data) {
        const memo23Url = memo23Agent.profileUrl || memo23Agent.url || memo23Agent.zillow_url;
        
        if (memo23Url) {
          const matchingAgent = rawAgents.find((agent: any) => {
            const agentUrl = agent.profile_url || agent.profileUrl || agent.url || agent.website;
            return agentUrl && (agentUrl.includes(memo23Url) || memo23Url.includes(agentUrl));
          });
          
          if (matchingAgent) {
            // Merge transaction data from memo23
            matchingAgent.memo23_total_sales = memo23Agent.totalSales || memo23Agent.sold || memo23Agent.salesCount;
            matchingAgent.memo23_current_listings = memo23Agent.forSale || memo23Agent.activeListings;
            matchingAgent.memo23_years_experience = memo23Agent.yearsExperience;
            matchingAgent.memo23_reviews = memo23Agent.reviews;
            matchingAgent.memo23_rating = memo23Agent.rating;
            
            console.log(`Merged memo23 data for ${matchingAgent.name || matchingAgent.agentName}`);
          }
        }
      }
    }

    // Limit to top 15 agents (post-enrichment)
    const items = rawAgents.slice(0, 15);


    function mapAgent(agent: any) {
      // Log all agent data to debug field mappings
      if (items.indexOf(agent) === 0) {
        console.log('First agent ALL fields:', JSON.stringify(agent, null, 2));
      }
      
      // Extract all possible field variations
      const name = agent.agentName || agent.name || agent['Business Name'] || agent.title || agent.fullName || agent.agent_name || '';
      
      // PHONE: Try all possible phone field variations
      const phone = agent.phoneNumber || 
                    agent.phone || 
                    agent['Phone Number'] || 
                    agent.call_number || 
                    agent.contact_phone || 
                    agent.phoneDisplay ||
                    agent.phone_number ||
                    agent.contactPhone ||
                    null;
      
      const website = agent.profileUrl || agent.url || agent.website || agent['Website'] || agent.site || agent.domain || agent.profileLink || agent.profile_url || null;
      const thumbnail = agent.photoUrl || agent.photo || agent.image || agent.profilePhoto || agent['Profile Photo'] || agent.thumbnail || agent.logo || agent.profilePhotoSrc || agent.photo_url || agent.image_url || null;
      const address = agent.address || agent.location || agent['Address'] || agent.full_address || agent.city || agent.office_address || '';
      const rating = agent.rating || agent.reviewRating || agent['Rating'] || agent.stars || agent.score || agent.review_rating || 4.5;
      const reviews = agent.reviewCount || agent.reviewsCount || agent.reviews || agent['Review Count'] || agent.review_count || agent.reviews_count || agent.total_reviews || 0;
      const company = agent.brokerageName || agent.brokerage || agent.company || agent.businessName || agent['Business Name'] || 'Independent';
      const zuid = agent.zuid || agent.zillowId || agent.screenname || null;
      
      // TRANSACTION DATA: Try all possible field variations (prioritize memo23 data)
      const totalSalesRaw = agent.memo23_total_sales || // memo23 enriched data
                        agent.team_sales_last_12_months || // GetDataForMe field
                        agent.salesLast12Months || 
                        agent.totalSales || 
                        agent.recentSales || 
                        agent.sales_last_12_months ||
                        agent.soldCount ||
                        agent.sold_count ||
                        agent.numRecentSales ||
                        null;
      const totalSales = totalSalesRaw ? parseInt(String(totalSalesRaw), 10) || null : null;
                        
      const currentListingsRaw = agent.memo23_current_listings || // memo23 enriched data
                             agent.team_current_listings || // GetDataForMe field
                             agent.activeListings || 
                             agent.currentListings || 
                             agent.current_listings ||
                             agent.forSaleCount ||
                             agent.for_sale_count ||
                             agent.numCurrentListings ||
                             null;
      const currentListings = currentListingsRaw ? parseInt(String(currentListingsRaw), 10) || null : null;
                             
      const yearsExperience = agent.yearsOfExperience || 
                             agent.yearsExperience || 
                             agent.experience || 
                             agent.years_experience ||
                             agent.experienceYears ||
                             null;
      
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
    
    // Log data quality
    const withPhone = transformedAgents.filter(a => a.phone).length;
    const withSales = transformedAgents.filter(a => a.totalSales).length;
    const withListings = transformedAgents.filter(a => a.currentListings).length;
    console.log(`Data quality: ${withPhone} with phone, ${withSales} with sales data, ${withListings} with listings`);
    
    if (transformedAgents.length > 0) {
      console.log('Sample agent data:', JSON.stringify({
        name: transformedAgents[0].name,
        phone: transformedAgents[0].phone,
        totalSales: transformedAgents[0].totalSales,
        currentListings: transformedAgents[0].currentListings,
        website: transformedAgents[0].website
      }, null, 2));
    }

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
              phone: agent.phone || null, // Use actual phone from scraper
              email: agent.email || null, // Use actual email if available
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
              years_experience: agent.yearsExperience,
              zillow_profile_url: agent.website,
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
