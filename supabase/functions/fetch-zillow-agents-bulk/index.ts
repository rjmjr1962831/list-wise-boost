import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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
  if (error.name === 'TypeError' && error.message?.includes('fetch')) return true;
  if (error.status) {
    if (error.status === 429 || (error.status >= 500 && error.status < 600)) return true;
    if (error.status >= 400 && error.status < 500) return false;
  }
  if (error.message) {
    const retryablePatterns = ['timeout', 'network', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'rate limit'];
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
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable || attempt === maxRetries) {
        console.error(`${operationName} failed after ${attempt + 1} attempts:`, lastError);
        throw lastError;
      }
      
      const delay = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attempt), maxDelayMs);
      console.log(`${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError!;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z\s]/g, '');
}

function calculateYearsExperience(issueDate: string): number {
  const date = new Date(issueDate);
  const today = new Date();
  const years = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(years);
}

async function sendFailureAlert(functionName: string, error: string, context?: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) return;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.functions.invoke('send-api-failure-alert', {
      body: { functionName, error, context, timestamp: new Date().toISOString() }
    });
  } catch (e) {
    console.error('Failed to send alert:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text().catch(() => '');
    let city = '';
    let state = '';
    let categoryId: string | undefined;
    let cityId: string | undefined;
    let count = 12;
    let runId: string | undefined;

    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText);
        city = parsed.city;
        state = parsed.state;
        categoryId = parsed.categoryId;
        cityId = parsed.cityId;
        if (parsed.count !== undefined) count = Math.min(parsed.count, 100);
        if (parsed.runId) runId = parsed.runId;
      } catch (_e) {
        console.warn('Invalid JSON body');
      }
    }

    if (!city || !state) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing city or state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const tokenFrom = Deno.env.get('APIFY_API_TOKEN')?.trim() ? 'APIFY_API_TOKEN' : (Deno.env.get('APIFY_API_KEY')?.trim() ? 'APIFY_API_KEY' : null);
    const apiToken = tokenFrom === 'APIFY_API_TOKEN'
      ? Deno.env.get('APIFY_API_TOKEN')!.trim()
      : tokenFrom === 'APIFY_API_KEY'
      ? Deno.env.get('APIFY_API_KEY')!.trim()
      : null;

    if (!apiToken) {
      const error = 'Apify API token not configured';
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state });
      throw new Error(error);
    }

    console.log(`Using Apify token from ${tokenFrom}`);

    const startTime = Date.now();
    console.log('Import started:', { city, state, cityId, categoryId });

    // STEP 1: Load license data
    console.log('Loading license data from CSV');
    const licenseMap = new Map();
    try {
      const csvResp = await fetch('https://raw.githubusercontent.com/lovable-dev/lovable-agent-importer/main/public/arizona-licenses.csv');
      if (csvResp.ok) {
        const csvText = await csvResp.text();
        const lines = csvText.split('\n');
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(',');
          if (values.length < 13) continue;
          
          const lastName = values[0]?.replace(/"/g, '').trim();
          const firstName = values[1]?.replace(/"/g, '').trim();
          const middleName = values[2]?.replace(/"/g, '').trim();
          const fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
          const normalizedName = normalizeName(fullName);
          
          const issueDate = values[3]?.replace(/"/g, '').trim();
          const licNumber = values[4]?.replace(/"/g, '').trim();
          const phone = values[7]?.replace(/"/g, '').trim();
          const companyName = values[8]?.replace(/"/g, '').trim();
          const address = values[9]?.replace(/"/g, '').trim();
          
          licenseMap.set(normalizedName, {
            licenseNumber: licNumber,
            phone,
            company: companyName,
            address,
            yearsExperience: calculateYearsExperience(issueDate),
            licenseVerifiedAt: new Date().toISOString()
          });
        }
        console.log(`✅ Loaded ${licenseMap.size} licenses`);
      }
    } catch (error) {
      console.error('Error loading license CSV:', error);
    }

    // STEP 2: Load zip codes for the city
    console.log('Loading zip code data');
    let zipCodes: string[] = [];
    
    try {
      const zipResp = await fetch('https://raw.githubusercontent.com/lovable-dev/lovable-agent-importer/main/src/data/zipCodeData.json');
      if (zipResp.ok) {
        const zipData = await zipResp.json();
        const cityKey = city.toLowerCase().replace(/\s+/g, '-');
        
        for (const [key, cityData] of Object.entries(zipData)) {
          if (key.toLowerCase().includes(cityKey)) {
            const suburbs = (cityData as any).suburbs || {};
            for (const suburb of Object.values(suburbs)) {
              const suburbData = suburb as any;
              if (suburbData.zip_codes) {
                zipCodes.push(...suburbData.zip_codes.map((zc: any) => zc.zip));
              }
            }
          }
        }
        
        zipCodes = [...new Set(zipCodes)].slice(0, 5);
        console.log(`✅ Found ${zipCodes.length} zip codes for ${city}`);
      }
    } catch (error) {
      console.error('Error loading zip codes:', error);
    }

    // STEP 3: Use RigelBytes Zillow Agents scraper which supports array format
    const scraperActorId = 'rigelbytes/zillow-agents';
    console.log(`Fetching agents using ${scraperActorId} for ${city}, ${state}`);
    
    const scraperInput = {
      // RigelBytes accepts an array: ["City, State", "zip1", "zip2", ...]
      search_query: [`${city}, ${state}`, ...zipCodes],
      detailed_profiles: false, // Set to true if you need detailed agent profiles
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
      },
    };

    // Start the actor run (do not wait here) and then poll until it finishes
    const startResp = await retryWithBackoff(
      async () => {
        const resp = await fetch(`https://api.apify.com/v2/acts/${scraperActorId}/runs?token=${apiToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scraperInput),
        });
        if (!resp.ok) {
          const body = await resp.text().catch(() => '');
          throw new Error(`Scraper failed to start: ${resp.status} - ${body.slice(0, 400)}`);
        }
        return resp;
      },
      { maxRetries: 2, initialDelayMs: 1000, maxDelayMs: 5000, backoffMultiplier: 2 },
      'Agent Scraping Start'
    );

    const startRun = await startResp.json();
    let scraperRunId = startRun.data.id;
    let scraperStatus = startRun.data.status as string;

    // Poll for completion up to 8 minutes
    const pollStart = Date.now();
    const maxWaitMs = 8 * 60 * 1000;
    const pollIntervalMs = 5000;

    async function fetchRunStatus(runId: string) {
      const resp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`);
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`Failed to get run status: ${resp.status} - ${body.slice(0, 400)}`);
      }
      return await resp.json();
    }

    while (scraperStatus === 'READY' || scraperStatus === 'RUNNING') {
      if (Date.now() - pollStart > maxWaitMs) {
        const error = `Scraper timed out after ${(maxWaitMs / 60000).toFixed(1)} minutes (last status: ${scraperStatus})`;
        await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state, scraperRunId });
        return new Response(
          JSON.stringify({ success: false, error }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
      const statusJson = await fetchRunStatus(scraperRunId);
      scraperStatus = statusJson.data.status;
    }

    if (scraperStatus !== 'SUCCEEDED') {
      // Try to fetch logs for better diagnostics
      let runLogs = '';
      try {
        const logResp = await fetch(`https://api.apify.com/v2/actor-runs/${scraperRunId}/log?token=${apiToken}`);
        if (logResp.ok) runLogs = await logResp.text();
      } catch (_e) {}

      const error = `Scraper failed with status: ${scraperStatus}`;
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state, scraperRunId, runLogs: runLogs?.slice(0, 2000) });
      return new Response(
        JSON.stringify({ success: false, error, details: runLogs?.slice(0, 1000) || undefined }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch results
    const datasetId = startRun.data.defaultDatasetId;
    const dataResp = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!dataResp.ok) throw new Error('Failed to fetch results');
    const agents = await dataResp.json();
    console.log(`✅ Found ${agents.length} agents`);

    // STEP 3: Insert/update in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!categoryId) {
      const { data: catData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'top10realestateagents')
        .single();
      categoryId = catData?.id;
    }

    if (!cityId) {
      const { data: cityData } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', city)
        .ilike('state', state)
        .single();
      cityId = cityData?.id;
    }

    if (!categoryId || !cityId) {
      throw new Error('Could not find category or city ID');
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const agent of agents) {
      try {
        const name = agent.name || '';
        if (!name) {
          skipped++;
          continue;
        }

        const normalizedName = normalizeName(name);
        const licenseData = licenseMap.get(normalizedName);

        // Prioritize license file data for phone, license, years
        const phone = licenseData?.phone || agent.phone || null;
        const yearsExperience = licenseData?.yearsExperience || null;
        const licenseNumber = licenseData?.licenseNumber || null;
        const licenseVerifiedAt = licenseData?.licenseVerifiedAt || null;
        
        // Get data from getdataforme scraper
        const email = agent.email || null;
        const website = agent.website || agent.website_url || null;
        const address = licenseData?.address || agent.address || null;
        const company = licenseData?.company || agent.brokerage || agent.company || 'Independent';
        const imageUrl = agent.profile_picture || agent.image_url || agent.photo || null;
        const description = agent.bio || agent.description || agent.about || null;
        const specialty = agent.specialties || [];
        const totalSales = agent.total_sales || agent.sales_last_year || 0;
        const currentListings = agent.active_listings || agent.current_listings || 0;
        const zillowProfileUrl = agent.profile_url || agent.zillow_url || null;
        const zuid = agent.zuid || (zillowProfileUrl ? zillowProfileUrl.split('/').pop() : null);
        const rating = agent.rating || agent.zillow_rating || 0;
        const reviewCount = agent.review_count || agent.reviews_count || 0;
        
        // Extract zip code from agent data or use first city zip
        const zipCode = agent.zip || agent.zip_code || (zipCodes.length > 0 ? zipCodes[0] : null);
        
        // Store minimal reviews data in badges field
        const badges = JSON.stringify({
          rating,
          review_count: reviewCount,
          sales_last_12_months: agent.sales_last_12_months || 0
        });

        const { data: existing } = await supabase
          .from('professionals')
          .select('id')
          .eq('name', name)
          .eq('city_id', cityId)
          .eq('category_id', categoryId)
          .maybeSingle();

        const agentData = {
          name,
          city_id: cityId,
          category_id: categoryId,
          email,
          phone,
          website,
          address,
          company,
          description,
          image_url: imageUrl,
          specialty,
          total_sales: totalSales,
          current_listings: currentListings,
          years_experience: yearsExperience,
          license_number: licenseNumber,
          license_verified_at: licenseVerifiedAt,
          zip_code: zipCode,
          zillow_profile_url: zillowProfileUrl,
          zuid,
          zillow_data_fetched_at: new Date().toISOString(),
          type: (yearsExperience && yearsExperience >= 5) ? 'Established' : 'Emerging',
          rank: created + updated + 1,
          active: true,
          badges
        };

        if (existing) {
          await supabase.from('professionals').update(agentData).eq('id', existing.id);
          updated++;
        } else {
          await supabase.from('professionals').insert(agentData);
          created++;
        }
      } catch (error) {
        console.error('Error processing agent:', error);
        skipped++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Complete in ${duration}s: ${created} created, ${updated} updated, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: { total: agents.length, created, updated, skipped },
        agents: agents.slice(0, 10)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Fatal error:', error);
    await sendFailureAlert('fetch-zillow-agents-bulk', error.message, { error: error.stack });
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
