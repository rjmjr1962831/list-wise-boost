import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONCURRENCY = 3; // Reduced from 10 to avoid rate limits
const MIN_REVIEWS = 20;
const MIN_RATING = 4.8;
const DEFAULT_DELAY_MS = 2000; // 2 second delay between agents
const MAX_RETRIES = 3; // Max retry attempts for 429 errors

// State name to abbreviation mapper
const stateAbbreviations: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
};

interface AgentData {
  profile_url: string;
  name: string;
  screenName?: string;
  image_url?: string;
  phoneNumber?: string;
  phoneNumbers?: { business?: string; cell?: string };
  email?: string;
  businessName?: string;
  company?: string;
  rating?: string;
  numTotalReviews?: number;
  reviews_count?: number;
  currentListings?: number;
  for_sale_count?: number;
  team_sales_last_12_months?: string;
  totalSales?: number;
  sales_count?: number;
  sold_in_last_year?: number;
  category?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      cityId, 
      categoryId, 
      maxResults = 200, 
      forceReEnrich = false,
      concurrency = CONCURRENCY,
      delayMs = DEFAULT_DELAY_MS,
      // Cost control flags
      dryRun = false,
      skipRecentlyEnriched = true,
      skipGenericBios = true,
      skipIfNoPress = true
    } = await req.json();

    if (!cityId || !categoryId) {
      throw new Error('cityId and categoryId are required');
    }

    console.log(`🔄 Force re-enrich mode: ${forceReEnrich ? 'ENABLED' : 'DISABLED'}`);
    console.log(`⚙️ Concurrency: ${concurrency} workers, Delay: ${delayMs}ms between agents`);
    console.log(`💰 Cost controls: dryRun=${dryRun}, skipRecent=${skipRecentlyEnriched}, skipGeneric=${skipGenericBios}, skipNoPress=${skipIfNoPress}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const PROXY_USERNAME = Deno.env.get('ROTATING_PROXY_USERNAME');
    const PROXY_PASSWORD = Deno.env.get('ROTATING_PROXY_PASSWORD');

    if (!APIFY_API_TOKEN || !PROXY_USERNAME || !PROXY_PASSWORD) {
      throw new Error('Required API credentials not configured');
    }

    // Get city info
    const { data: city } = await supabase
      .from('cities')
      .select('name, state')
      .eq('id', cityId)
      .single();

    if (!city) {
      throw new Error('City not found');
    }

    console.log(`🚀 Starting streaming enrichment for ${city.name}, ${city.state}`);

    // Build search location
    const stateAbbrev = city.state.length === 2 ? city.state : stateAbbreviations[city.state];
    const searchLocation = `${city.name} ${stateAbbrev}`;
    console.log(`Search location: ${searchLocation}`);

    // Start Apify actor
    const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@rp.scrapegw.com:6060`;
    const actorInput = {
      search_query: searchLocation,
      category: "real-estate-agents",
      locationText: searchLocation,
      name: "",
      language: "English",
      specialty: "",
      maxResults: maxResults,
      startPage: 1,
      proxy: {
        useApifyProxy: false,
        proxyUrls: [proxyUrl]
      }
    };

    console.log('Starting Apify actor...');
    const startResponse = await fetch(
      'https://api.apify.com/v2/acts/getdataforme~zillow-real-state-agents-scraper/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
        body: JSON.stringify(actorInput),
      }
    );

    if (!startResponse.ok) {
      throw new Error(`Failed to start Apify actor: ${startResponse.status}`);
    }

    const { data: runData } = await startResponse.json();
    const runId = runData.id;
    console.log(`✅ Apify actor started: ${runId}`);

    // Get starting rank for this city
    const { data: cityRanks } = await supabase
      .from('professional_cities')
      .select('rank')
      .eq('city_id', cityId)
      .order('rank', { ascending: false })
      .limit(1);

    let nextRank = cityRanks && cityRanks.length > 0 ? cityRanks[0].rank + 1 : 1;

    // Worker pool setup
    const workerQueue: AgentData[] = [];
    const activeWorkers = new Set<Promise<void>>();
    const processedUrls = new Set<string>();
    let offset = 0;
    let apifyRunning = true;
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;

    // Retry helper with exponential backoff
    const retryWithBackoff = async <T>(
      fn: () => Promise<T>,
      operation: string,
      maxRetries = MAX_RETRIES
    ): Promise<T> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error: any) {
          const is429 = error.message?.includes('429') || error.message?.includes('Rate limit');
          
          if (is429 && attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            console.log(`⏱️ [Retry] ${operation} hit rate limit, waiting ${backoffMs}ms before retry ${attempt}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }
          
          throw error;
        }
      }
      throw new Error(`${operation} failed after ${maxRetries} retries`);
    };

    // Process a single agent through the full pipeline
    const processAgentPipeline = async (agent: AgentData) => {
      try {
        const agentName = agent.name || agent.screenName || 'Unknown';
        console.log(`🔄 [Worker] Processing ${agentName}...`);
        
        // Add delay before processing to avoid overwhelming APIs
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // DRY RUN MODE: Only log what would happen
        if (dryRun) {
          console.log(`🔧 [DRY RUN] Would process ${agentName}`);
          console.log(`🔧 [DRY RUN] Would check if agent exists in database`);
          console.log(`🔧 [DRY RUN] Would run memo23 enrichment`);
          console.log(`🔧 [DRY RUN] Would check qualification (${MIN_REVIEWS}+ reviews, ${MIN_RATING}+ rating)`);
          console.log(`🔧 [DRY RUN] Would run press research via Claude`);
          totalSucceeded++;
          return;
        }

        // Check if agent exists globally
        const { data: existing } = await supabase
          .from('professionals')
          .select('id, name')
          .eq('zillow_profile_url', agent.profile_url)
          .single();

        let professionalId: string;

        if (existing) {
          // Check if already linked to this city
          const { data: cityLink } = await supabase
            .from('professional_cities')
            .select('id')
            .eq('professional_id', existing.id)
            .eq('city_id', cityId)
            .single();

          if (cityLink && !forceReEnrich) {
            console.log(`⏭️ [Worker] ${agentName} already in this city, skipping`);
            return;
          }

          if (cityLink) {
            console.log(`🔄 [Worker] ${agentName} already in city, but force re-enrich enabled`);
          } else {
            // Link to city
            await supabase
              .from('professional_cities')
              .insert({
                professional_id: existing.id,
                city_id: cityId,
                rank: nextRank++,
                active: true
              });
            console.log(`🔗 [Worker] ${agentName} linked to city`);
          }

          professionalId = existing.id;
        } else {
          // Create new professional
          const rating = parseFloat(agent.rating || '0');
          const email = agent.email || null;
          let website = null;
          if (email) {
            const domain = email.split('@')[1];
            if (domain) website = `https://${domain}`;
          }

          const salesCount = agent.team_sales_last_12_months 
            ? parseInt(agent.team_sales_last_12_months) 
            : (agent.totalSales || agent.sales_count || agent.sold_in_last_year || 0);

          const { data: inserted, error: insertError } = await supabase
            .from('professionals')
            .insert({
              name: agentName,
              zillow_profile_url: agent.profile_url,
              image_url: agent.image_url || null,
              phone: agent.phoneNumber || agent.phoneNumbers?.business || agent.phoneNumbers?.cell || null,
              email: email,
              website: website,
              company: agent.businessName || agent.company || null,
              num_total_reviews: agent.numTotalReviews || agent.reviews_count || 0,
              review_stars_rating: rating || null,
              current_listings: agent.currentListings || agent.for_sale_count || 0,
              total_sales: salesCount,
              city_id: cityId,
              category_id: categoryId,
              rank: nextRank,
              type: 'individual',
              active: true,
            })
            .select()
            .single();

          if (insertError || !inserted) {
            throw new Error(`Failed to insert professional: ${insertError?.message}`);
          }

          // Link to city
          await supabase
            .from('professional_cities')
            .insert({
              professional_id: inserted.id,
              city_id: cityId,
              rank: nextRank++,
              active: true
            });

          professionalId = inserted.id;
          console.log(`✅ [Worker] ${agentName} created and linked`);
        }

        // Step 2: memo23 enrichment with retry
        console.log(`📊 [Worker] Running memo23 enrichment for ${agentName}...`);
        await retryWithBackoff(async () => {
          const { error: memo23Error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
            body: { 
              professionalId,
              dryRun,
              skipRecentlyEnriched,
              skipGenericBios
            }
          });

          if (memo23Error) {
            throw new Error(`memo23 enrichment failed: ${memo23Error.message}`);
          }
        }, `memo23 for ${agentName}`);

        // Step 3: Check qualification
        const { data: enriched } = await supabase
          .from('professionals')
          .select('num_total_reviews, review_stars_rating')
          .eq('id', professionalId)
          .single();

        if (!enriched || enriched.num_total_reviews < MIN_REVIEWS || enriched.review_stars_rating < MIN_RATING) {
          console.log(`❌ [Worker] ${agentName} disqualified: ${enriched?.num_total_reviews || 0} reviews, ${enriched?.review_stars_rating || 0}★`);
          await supabase
            .from('professionals')
            .update({ active: false })
            .eq('id', professionalId);
          throw new Error('Agent disqualified');
        }

        console.log(`✅ [Worker] ${agentName} qualified: ${enriched.num_total_reviews} reviews, ${enriched.review_stars_rating}★`);

        // Step 4: Press research with retry
        console.log(`📰 [Worker] Running press research for ${agentName}...`);
        try {
          await retryWithBackoff(async () => {
            const { error: pressError } = await supabase.functions.invoke('search-agent-press-claude', {
              body: {
                agentName: agentName,
                company: agent.company || agent.businessName,
                businessName: agent.businessName,
                city: city.name,
                state: city.state,
                professionalId,
                dryRun,
                skipIfNoPress
              }
            });

            if (pressError) {
              throw new Error(`Press research failed: ${pressError.message}`);
            }
          }, `press research for ${agentName}`);
        } catch (pressError: any) {
          console.error(`⚠️ [Worker] Press research failed for ${agentName} after retries:`, pressError);
          // Don't throw - press research is optional
        }

        console.log(`✅ [Worker] ${agentName} fully enriched!`);
        totalSucceeded++;

      } catch (error: any) {
        console.error(`❌ [Worker] Pipeline failed:`, error.message);
        totalFailed++;
      } finally {
        totalProcessed++;
      }
    };

    // Main streaming loop
    console.log(`🔄 Starting streaming pipeline with ${concurrency} concurrent workers...`);

    while (apifyRunning || workerQueue.length > 0 || activeWorkers.size > 0) {
      // Poll Apify for new items
      if (apifyRunning) {
        try {
          const itemsResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?offset=${offset}&limit=50`,
            {
              headers: { 'Authorization': `Bearer ${APIFY_API_TOKEN}` }
            }
          );

          if (itemsResponse.ok) {
            const items: AgentData[] = await itemsResponse.json();
            
            if (items.length > 0) {
              console.log(`📥 Fetched ${items.length} new agents from Apify (offset ${offset})`);
              
              // Add qualifying agents to queue
              for (const agent of items) {
                if (agent.category && agent.category !== 'real-estate-agents') continue;
                
                const rating = parseFloat(agent.rating || '0');
                if (rating < 4.5) continue;
                
                if (!processedUrls.has(agent.profile_url)) {
                  processedUrls.add(agent.profile_url);
                  workerQueue.push(agent);
                }
              }
              
              offset += items.length;
              
              // Stop Apify early if we have enough agents queued
              if (processedUrls.size >= maxResults * 2) {
                apifyRunning = false;
                console.log(`⏹️ Queued enough agents (${processedUrls.size}), stopping Apify polling`);
              }
            }
          }
        } catch (error) {
          console.error('Error polling Apify dataset:', error);
        }

        // Check run status
        try {
          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}`,
            { headers: { 'Authorization': `Bearer ${APIFY_API_TOKEN}` } }
          );

          if (statusResponse.ok) {
            const { data: statusData } = await statusResponse.json();
            if (statusData.status !== 'RUNNING') {
              apifyRunning = false;
              console.log(`✅ Apify run completed with status: ${statusData.status}`);
            }
          }
        } catch (error) {
          console.error('Error checking Apify status:', error);
        }
      }

      // Spawn workers up to concurrency limit
      while (workerQueue.length > 0 && activeWorkers.size < concurrency) {
        // CHECK: Stop if we've reached maxResults limit
        if (totalProcessed + activeWorkers.size >= maxResults) {
          console.log(`⏹️ Reached maxResults limit (${maxResults}), stopping worker spawn...`);
          workerQueue.length = 0; // Clear remaining queue
          break;
        }
        
        const agent = workerQueue.shift()!;
        const workerPromise = processAgentPipeline(agent);
        activeWorkers.add(workerPromise);
        workerPromise.finally(() => activeWorkers.delete(workerPromise));
      }

      // Early exit if we've reached maxResults and all workers are done
      if (totalProcessed >= maxResults && activeWorkers.size === 0) {
        console.log(`✅ Reached maxResults (${maxResults}), exiting early`);
        break;
      }

      // Log progress
      console.log(`📊 Progress: ${totalProcessed} processed (${totalSucceeded} succeeded, ${totalFailed} failed), ${workerQueue.length} queued, ${activeWorkers.size} active workers`);

      // Small delay before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`✅ Streaming enrichment complete!`);
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Succeeded: ${totalSucceeded}`);
    console.log(`   Failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        succeeded: totalSucceeded,
        failed: totalFailed,
        message: `Streaming enrichment complete: ${totalSucceeded}/${totalProcessed} agents fully enriched`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in streaming-city-enrichment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
