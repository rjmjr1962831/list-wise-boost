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
    let count = 30;

    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText);
        city = parsed.city;
        state = parsed.state;
        categoryId = parsed.categoryId;
        cityId = parsed.cityId;
        if (parsed.count !== undefined) count = Math.min(parsed.count, 50);
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
    
    const apiToken = Deno.env.get('APIFY_API_KEY')?.trim() || Deno.env.get('APIFY_API_TOKEN')?.trim();
    if (!apiToken) {
      const error = 'Apify API key not configured';
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state });
      throw new Error(error);
    }

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

    // STEP 3: Use rigelbytes/zillow-agents scraper
    const scraperActorId = 'rigelbytes/zillow-agents';
    console.log(`Starting ${scraperActorId} for ${city}, ${state}`);
    
    const scraperInput = {
      search_keywords: zipCodes.length > 0 ? zipCodes[0] : `${city}, ${state}`,
      detailed_profiles: true,
      max_items: count
    };

    console.log('Scraper input:', scraperInput);

    const scraperResp = await retryWithBackoff(
      async () => {
        const resp = await fetch(`https://api.apify.com/v2/acts/${scraperActorId}/runs?token=${apiToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scraperInput),
        });
        
        if (!resp.ok) {
          const error: any = new Error(`Scraper failed: ${resp.status}`);
          error.status = resp.status;
          throw error;
        }
        return resp;
      },
      { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 },
      'Start Scraper'
    );

    const scraperRun = await scraperResp.json();
    const scraperRunId = scraperRun.data.id;
    console.log(`Scraper run started: ${scraperRunId}`);

    // Poll for completion
    let scraperStatus = scraperRun.data.status;
    let scraperAttempts = 0;
    
    while (scraperStatus !== 'SUCCEEDED' && scraperStatus !== 'FAILED' && scraperAttempts < 150) {
      await new Promise(r => setTimeout(r, 2000));
      
      const statusResp = await fetch(
        `https://api.apify.com/v2/acts/${scraperActorId}/runs/${scraperRunId}?token=${apiToken}`
      );
      
      if (statusResp.ok) {
        const statusData = await statusResp.json();
        scraperStatus = statusData.data.status;
        console.log(`Status: ${scraperStatus} (attempt ${scraperAttempts + 1})`);
      }
      scraperAttempts++;
    }

    if (scraperStatus !== 'SUCCEEDED') {
      const error = `Scraper did not complete: ${scraperStatus}`;
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state });
      return new Response(
        JSON.stringify({ error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch results
    const datasetId = scraperRun.data.defaultDatasetId;
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
        
        // Get data from rigelbytes scraper
        const email = agent.email || null;
        const website = agent.website || null; // Agent's actual website, not zillow
        const address = agent.address || null;
        const company = agent.company || 'Independent';
        const imageUrl = agent.image || agent.profile_picture || null;
        const description = agent.description || agent.bio || null;
        const specialty = agent.specialties || agent.specialty_tags || [];
        const totalSales = agent.total_sales || agent.total_transactions || 0;
        const currentListings = agent.current_listings || agent.active_listings || 0;
        const zillowProfileUrl = agent.zillow_profile_url || agent.profile_url || null;
        const zuid = agent.zuid || agent.zillow_id || null;
        const rating = agent.rating || 0;
        const reviewCount = agent.review_count || 0;
        
        // Store reviews and sales_last_12_months in badges field temporarily
        const badges = JSON.stringify({
          reviews: agent.reviews || [],
          sales_last_12_months: agent.sales_last_12_months || agent.recent_sales || 0
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
          zip_code: zipCodes[0] || null,
          zillow_profile_url: zillowProfileUrl,
          zuid,
          zillow_data_fetched_at: new Date().toISOString(),
          type: (yearsExperience && yearsExperience >= 5) ? 'Established' : 'Emerging',
          rank: created + updated + 1,
          active: true,
          badges,
          rating,
          reviews: reviewCount
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
