/**
 * import-agents-unified
 * 
 * Unified Firecrawl-based agent import - replaces agenscrape + memo23
 * Optimized for state-scale scraping with:
 * - Deduplication against existing database
 * - Parallel processing with concurrency control
 * - Background task execution for long-running imports
 * 
 * Flow:
 * 1. Scrape Zillow agent search page for the city
 * 2. Extract agent profile URLs from search results
 * 3. Dedupe against existing zillow_profile_url in database
 * 4. Scrape profiles in parallel batches
 * 5. Save to database with license verification
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Concurrency settings
const CONCURRENCY_LIMIT = 5; // Parallel Firecrawl requests
const DELAY_BETWEEN_BATCHES_MS = 1000;

// Comprehensive schema for Zillow agent profiles
const ZILLOW_AGENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Agent's full name" },
    screenName: { type: "string", description: "Zillow screen name from URL" },
    profilePhotoUrl: { type: "string", description: "Profile photo URL" },
    rating: { type: "number", description: "Star rating (e.g., 4.9)" },
    reviewCount: { type: "number", description: "Total number of reviews" },
    salesLast12Months: { type: "number", description: "Number of sales in last 12 months" },
    totalSales: { type: "number", description: "Total lifetime sales" },
    currentListings: { type: "number", description: "Current active listings" },
    yearsExperience: { type: "number", description: "Years of experience in real estate" },
    phone: { type: "string", description: "Phone number" },
    email: { type: "string", description: "Email address" },
    website: { type: "string", description: "Personal/team website URL" },
    licenseNumber: { type: "string", description: "Real estate license number" },
    licenseState: { type: "string", description: "State where licensed" },
    brokerageName: { type: "string", description: "Brokerage or company name" },
    brokerageAddress: { type: "string", description: "Brokerage office address" },
    bio: { type: "string", description: "Agent's bio or 'Get to know me' section" },
    specialties: { type: "array", items: { type: "string" }, description: "Agent specialties" },
    serviceAreas: { type: "array", items: { type: "string" }, description: "Cities/areas served" },
    languages: { type: "array", items: { type: "string" }, description: "Languages spoken" },
    facebookUrl: { type: "string" },
    instagramUrl: { type: "string" },
    linkedinUrl: { type: "string" },
    twitterUrl: { type: "string" },
    tiktokUrl: { type: "string" },
    youtubeUrl: { type: "string" },
    isPremierAgent: { type: "boolean", description: "Is a Zillow Premier Agent" },
    isTopAgent: { type: "boolean", description: "Has Top Agent badge" },
    isTeam: { type: "boolean", description: "Is this a team vs individual" },
    teamName: { type: "string", description: "Team name if applicable" },
    teamMemberCount: { type: "number", description: "Number of team members" },
    reviews: { 
      type: "array", 
      items: {
        type: "object",
        properties: {
          reviewerName: { type: "string" },
          rating: { type: "number" },
          reviewText: { type: "string" },
          reviewDate: { type: "string" },
          transactionType: { type: "string" },
          transactionDate: { type: "string" },
          isLocalReview: { type: "boolean" }
        }
      },
      description: "Array of individual reviews" 
    },
  },
  required: ["name"]
};

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

// Parallel execution with concurrency limit
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let currentIndex = 0;
  
  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      try {
        results[index] = await fn(item, index);
      } catch (error) {
        console.error(`[Worker] Error processing item ${index}:`, error);
        results[index] = null as any;
      }
    }
  }
  
  const workers = Array(Math.min(limit, items.length)).fill(null).map(() => worker());
  await Promise.all(workers);
  
  return results;
}

// Extract agent profile links from Zillow search results
function extractAgentLinksFromContent(markdown: string, links: string[]): string[] {
  const profileUrls = new Set<string>();
  
  if (links && Array.isArray(links)) {
    for (const link of links) {
      if (link.includes('zillow.com/profile/') && !link.includes('/reviews')) {
        profileUrls.add(link.split('?')[0]);
      }
    }
  }
  
  const profilePattern = /https:\/\/www\.zillow\.com\/profile\/([a-zA-Z0-9_-]+)/g;
  const matches = markdown.matchAll(profilePattern);
  for (const match of matches) {
    profileUrls.add(match[0].split('?')[0]);
  }
  
  return Array.from(profileUrls);
}

// Scrape Zillow search page to find agents
async function scrapeSearchPage(cityName: string, stateAbbr: string): Promise<string[]> {
  const citySlug = cityName.toLowerCase().replace(/\s+/g, '-');
  const stateSlugLower = stateAbbr.toLowerCase();
  const searchUrl = `https://www.zillow.com/professionals/real-estate-agent-reviews/${citySlug}-${stateSlugLower}/`;
  
  console.log(`[Unified Import] Scraping search page: ${searchUrl}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: searchUrl,
      formats: ['markdown', 'links'],
      onlyMainContent: false,
      waitFor: 5000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl search page error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Firecrawl search failed: ${result.error || 'Unknown error'}`);
  }

  const markdown = result.data?.markdown || '';
  const links = result.data?.links || [];
  
  return extractAgentLinksFromContent(markdown, links);
}

// Scrape individual agent profile
async function scrapeAgentProfile(profileUrl: string): Promise<any> {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: profileUrl,
      formats: ['extract', 'markdown'],
      extract: { schema: ZILLOW_AGENT_SCHEMA },
      onlyMainContent: true,
      waitFor: 3000,
      timeout: 30000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl profile error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Firecrawl profile scrape failed: ${result.error}`);
  }

  const extracted = result.data?.extract || {};
  const markdown = result.data?.markdown || '';
  const metadata = result.data?.metadata || {};
  
  const agentData = {
    ...extracted,
    profileUrl,
    screenName: profileUrl.match(/profile\/([^/?#]+)/)?.[1] || null,
    profilePhotoUrl: extracted.profilePhotoUrl || metadata?.ogImage || null,
    ...parseMarkdownFallback(markdown, extracted)
  };
  
  return agentData;
}

// Fallback markdown parsing
function parseMarkdownFallback(markdown: string, extracted: any): any {
  const fallback: any = {};
  
  if (!extracted.rating) {
    const ratingMatch = markdown.match(/(\d+\.?\d*)\s*[\[(]?([\d,]+)\s*(?:team\s*)?reviews/i);
    if (ratingMatch) {
      fallback.rating = parseFloat(ratingMatch[1]);
      fallback.reviewCount = parseInt(ratingMatch[2].replace(/,/g, ''));
    }
  }
  
  if (!extracted.salesLast12Months) {
    const salesMatch = markdown.match(/\*\*([\d,]+)\*\*\s*sales last 12 months/i);
    if (salesMatch) fallback.salesLast12Months = parseInt(salesMatch[1].replace(/,/g, ''));
  }
  
  if (!extracted.totalSales) {
    const totalMatch = markdown.match(/\*\*([\d,]+)\*\*\s*total sales/i);
    if (totalMatch) fallback.totalSales = parseInt(totalMatch[1].replace(/,/g, ''));
  }
  
  if (!extracted.yearsExperience) {
    const expMatch = markdown.match(/\*\*(\d+)\*\*\s*years? of experience/i) || 
                     markdown.match(/(\d+)\s+Years? of experience/i);
    if (expMatch) fallback.yearsExperience = parseInt(expMatch[1]);
  }
  
  if (!extracted.phone) {
    const telMatch = markdown.match(/\[([^\]]*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}[^\]]*)\]\(tel:/);
    if (telMatch) {
      const digits = telMatch[1].replace(/\D/g, '');
      if (digits.length === 10) {
        fallback.phone = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
      }
    }
  }
  
  if (!extracted.email) {
    const emailMatch = markdown.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) fallback.email = emailMatch[1];
  }
  
  if (!extracted.isPremierAgent) {
    fallback.isPremierAgent = /premier agent/i.test(markdown);
  }
  
  if (!extracted.isTopAgent) {
    fallback.isTopAgent = /top agent/i.test(markdown) || /What is Top Agent\?/i.test(markdown);
  }
  
  return fallback;
}

// Verify Arizona license
async function verifyArizonaLicense(supabase: any, licenseNumber: string): Promise<{ verified: boolean; yearsExperience?: number }> {
  if (!licenseNumber) return { verified: false };
  
  const normalizedLicense = licenseNumber.replace(/\s/g, '').toUpperCase();
  
  const { data: licenseRecord } = await supabase
    .from('arizona_licenses')
    .select('*')
    .eq('license_number', normalizedLicense)
    .maybeSingle();

  if (!licenseRecord) {
    return { verified: false };
  }
  
  if (licenseRecord.original_date) {
    const issueDate = new Date(licenseRecord.original_date);
    const yearsExperience = new Date().getFullYear() - issueDate.getFullYear();
    return { verified: true, yearsExperience };
  }
  
  return { verified: true };
}

// Check for existing agents by Zillow URL
async function getExistingAgentUrls(supabase: any, profileUrls: string[]): Promise<Set<string>> {
  const { data: existing } = await supabase
    .from('professionals')
    .select('zillow_profile_url')
    .in('zillow_profile_url', profileUrls);
  
  const existingUrls = new Set<string>();
  if (existing) {
    for (const agent of existing) {
      if (agent.zillow_profile_url) {
        existingUrls.add(agent.zillow_profile_url);
      }
    }
  }
  
  return existingUrls;
}

// Check for existing agents by name in city
async function getExistingAgentNames(supabase: any, cityId: string): Promise<Set<string>> {
  const { data: existing } = await supabase
    .from('professionals')
    .select('name')
    .eq('city_id', cityId);
  
  const existingNames = new Set<string>();
  if (existing) {
    for (const agent of existing) {
      if (agent.name) {
        existingNames.add(agent.name.toLowerCase().trim());
      }
    }
  }
  
  return existingNames;
}

// Process and save a single agent
async function processAgent(
  supabase: any,
  agentData: any,
  cityId: string,
  categoryId: string,
  cityState: string,
  existingNames: Set<string>,
  nextRank: number,
  triggerEnrichment: boolean
): Promise<{ action: string; name: string; id?: string }> {
  
  const rating = agentData.rating || 0;
  const reviews = agentData.reviewCount || 0;
  
  // Check if name already exists in city (fuzzy dedup)
  const normalizedName = agentData.name?.toLowerCase().trim();
  if (normalizedName && existingNames.has(normalizedName)) {
    console.log(`[Unified Import] ⏭️ Skipping duplicate: ${agentData.name}`);
    return { action: 'duplicate', name: agentData.name };
  }

  // Verify Arizona license if applicable
  let licenseVerified = false;
  let verifiedYears = agentData.yearsExperience;
  
  if (cityState === 'Arizona' && agentData.licenseNumber) {
    const verification = await verifyArizonaLicense(supabase, agentData.licenseNumber);
    licenseVerified = verification.verified;
    if (verification.yearsExperience) {
      verifiedYears = verification.yearsExperience;
    }
  }

  // Determine agent type
  let agentType = 'individual';
  if (agentData.isTeam || agentData.teamName || (agentData.teamMemberCount && agentData.teamMemberCount > 1)) {
    agentType = 'team';
  } else if (verifiedYears && verifiedYears >= 10) {
    agentType = 'established';
  }

  const insertData: any = {
    name: agentData.name,
    screen_name: agentData.screenName,
    image_url: agentData.profilePhotoUrl,
    review_stars_rating: rating,
    num_total_reviews: reviews,
    total_sales: agentData.totalSales || agentData.salesLast12Months,
    current_listings: agentData.currentListings,
    years_experience: verifiedYears,
    phone: agentData.phone,
    email: agentData.email,
    website: agentData.website,
    company: agentData.brokerageName,
    address: agentData.brokerageAddress,
    license_number: agentData.licenseNumber,
    description: agentData.bio,
    get_to_know_me: agentData.bio,
    specialty: agentData.specialties,
    service_areas: agentData.serviceAreas,
    languages: agentData.languages ? { languages: agentData.languages } : null,
    is_top_agent: agentData.isTopAgent,
    is_premier_agent: agentData.isPremierAgent,
    social_facebook: agentData.facebookUrl,
    social_instagram: agentData.instagramUrl,
    social_linkedin: agentData.linkedinUrl,
    social_twitter: agentData.twitterUrl,
    social_tiktok: agentData.tiktokUrl,
    type: agentType,
    zillow_profile_url: agentData.profileUrl,
    zillow_data_fetched_at: new Date().toISOString(),
    reviews_data: agentData.reviews ? { 
      zillow_reviews: agentData.reviews,
      fetched_at: new Date().toISOString()
    } : null,
    raw_scraper_data: agentData,
    city_id: cityId,
    category_id: categoryId,
    rank: nextRank,
    active: true,
    updated_at: new Date().toISOString()
  };

  if (licenseVerified) {
    insertData.license_verified_at = new Date().toISOString();
    insertData.badges = ['License Verified'];
  }

  const { data: newAgent, error: insertError } = await supabase
    .from('professionals')
    .insert(insertData)
    .select('id, name')
    .single();

  if (insertError) {
    console.error(`[Unified Import] Insert error for ${agentData.name}:`, insertError.message);
    return { action: 'failed', name: agentData.name };
  }

  // Link to city via junction table
  await supabase
    .from('professional_cities')
    .insert({
      professional_id: newAgent.id,
      city_id: cityId,
      rank: nextRank,
      active: true
    });

  // Add to existingNames to prevent dups in same batch
  if (normalizedName) {
    existingNames.add(normalizedName);
  }

  console.log(`[Unified Import] ✅ Imported: ${newAgent.name} (${rating}★, ${reviews} reviews)`);

  // Trigger enrichment for new qualified agents (non-blocking)
  if (triggerEnrichment) {
    supabase.functions.invoke('search-agent-press-claude', {
      body: { professionalId: newAgent.id, skipSynthesis: false, skipIfNoPress: false }
    }).catch(() => {});
  }

  return { action: 'created', name: newAgent.name, id: newAgent.id };
}

// Background task handler
async function runImportBackground(
  supabase: any,
  cityId: string,
  categoryId: string,
  city: any,
  stateAbbr: string,
  maxAgents: number,
  minRating: number,
  minReviews: number,
  triggerEnrichment: boolean
) {
  console.log(`[Background Import] Starting for ${city.name}, ${stateAbbr}`);
  
  try {
    // Step 1: Find agent profile URLs
    const profileUrls = await scrapeSearchPage(city.name, stateAbbr);
    console.log(`[Background Import] Found ${profileUrls.length} profile URLs`);
    
    if (profileUrls.length === 0) {
      console.log(`[Background Import] No agents found for ${city.name}`);
      return;
    }

    // Step 2: Deduplicate against existing database
    const existingUrls = await getExistingAgentUrls(supabase, profileUrls);
    const existingNames = await getExistingAgentNames(supabase, cityId);
    
    const newUrls = profileUrls.filter(url => !existingUrls.has(url));
    console.log(`[Background Import] ${existingUrls.size} already exist, ${newUrls.length} new to process`);
    
    if (newUrls.length === 0) {
      console.log(`[Background Import] All agents already imported for ${city.name}`);
      return;
    }

    // Step 3: Get next rank
    const { data: maxRankData } = await supabase
      .from('professional_cities')
      .select('rank')
      .eq('city_id', cityId)
      .order('rank', { ascending: false })
      .limit(1)
      .single();

    let nextRank = (maxRankData?.rank || 0) + 1;

    // Step 4: Scrape profiles in parallel
    const urlsToProcess = newUrls.slice(0, maxAgents);
    console.log(`[Background Import] Scraping ${urlsToProcess.length} profiles in parallel (concurrency: ${CONCURRENCY_LIMIT})`);
    
    const agentDataResults = await parallelLimit(
      urlsToProcess,
      CONCURRENCY_LIMIT,
      async (url, idx) => {
        console.log(`[Background Import] [${idx + 1}/${urlsToProcess.length}] Scraping ${url}`);
        try {
          const data = await scrapeAgentProfile(url);
          // Filter by rating/reviews
          if ((data.rating || 0) < minRating || (data.reviewCount || 0) < minReviews) {
            console.log(`[Background Import] ⏭️ ${data.name}: ${data.rating}★, ${data.reviewCount} reviews - below threshold`);
            return null;
          }
          return data;
        } catch (err: any) {
          console.error(`[Background Import] Failed to scrape ${url}:`, err.message);
          return null;
        }
      }
    );

    // Filter out nulls (failed or below threshold)
    const qualifiedAgents = agentDataResults.filter(a => a !== null);
    console.log(`[Background Import] ${qualifiedAgents.length} agents qualify for import`);

    // Step 5: Save to database
    let imported = 0, duplicates = 0, failed = 0;
    
    for (const agentData of qualifiedAgents) {
      const result = await processAgent(
        supabase,
        agentData,
        cityId,
        categoryId,
        city.state,
        existingNames,
        nextRank++,
        triggerEnrichment
      );
      
      if (result.action === 'created') imported++;
      else if (result.action === 'duplicate') duplicates++;
      else if (result.action === 'failed') failed++;
    }

    console.log(`[Background Import] Complete for ${city.name}: ${imported} imported, ${duplicates} duplicates, ${failed} failed`);
    
  } catch (error: any) {
    console.error(`[Background Import] Error for ${city.name}:`, error.message);
  }
}

// Process a single city - returns stats
async function processSingleCity(
  supabase: any,
  city: any,
  stateAbbr: string,
  categoryId: string,
  maxAgentsPerCity: number,
  minRating: number,
  minReviews: number,
  triggerEnrichment: boolean
): Promise<{ imported: number; duplicates: number; skipped: number }> {
  const stats = { imported: 0, duplicates: 0, skipped: 0 };
  
  try {
    // Step 1: Find agent profile URLs
    const profileUrls = await scrapeSearchPage(city.name, stateAbbr);
    
    if (profileUrls.length === 0) {
      console.log(`[State Import] No agents found for ${city.name}`);
      return stats;
    }
    
    // Step 2: Deduplicate
    const existingUrls = await getExistingAgentUrls(supabase, profileUrls);
    const existingNames = await getExistingAgentNames(supabase, city.id);
    const newUrls = profileUrls.filter(url => !existingUrls.has(url));
    
    console.log(`[State Import] ${city.name}: ${profileUrls.length} found, ${existingUrls.size} exist, ${newUrls.length} new`);
    stats.duplicates = existingUrls.size;
    
    if (newUrls.length === 0) {
      return stats;
    }
    
    // Step 3: Get next rank
    const { data: maxRankData } = await supabase
      .from('professional_cities')
      .select('rank')
      .eq('city_id', city.id)
      .order('rank', { ascending: false })
      .limit(1)
      .single();
    
    let nextRank = (maxRankData?.rank || 0) + 1;
    
    // Step 4: Scrape profiles in parallel
    const urlsToProcess = newUrls.slice(0, maxAgentsPerCity);
    
    const agentDataResults = await parallelLimit(
      urlsToProcess,
      CONCURRENCY_LIMIT,
      async (url, idx) => {
        try {
          const data = await scrapeAgentProfile(url);
          if ((data.rating || 0) < minRating || (data.reviewCount || 0) < minReviews) {
            console.log(`[State Import] ⏭️ ${data.name}: ${data.rating}★, ${data.reviewCount} reviews - below threshold`);
            return null;
          }
          return data;
        } catch (err: any) {
          console.error(`[State Import] Failed: ${url}`, err.message);
          return null;
        }
      }
    );
    
    const qualifiedAgents = agentDataResults.filter(a => a !== null);
    stats.skipped = urlsToProcess.length - qualifiedAgents.length;
    
    // Step 5: Save to database
    for (const agentData of qualifiedAgents) {
      const result = await processAgent(
        supabase,
        agentData,
        city.id,
        categoryId,
        city.state,
        existingNames,
        nextRank++,
        triggerEnrichment
      );
      
      if (result.action === 'created') stats.imported++;
      else if (result.action === 'duplicate') stats.duplicates++;
    }
    
    console.log(`[State Import] ✅ ${city.name}: ${stats.imported} imported, ${stats.skipped} below threshold`);
    
  } catch (error: any) {
    console.error(`[State Import] Error processing ${city.name}:`, error.message);
  }
  
  return stats;
}

// Queue-based state import - processes CITIES_PER_BATCH cities then chains to next batch
const CITIES_PER_BATCH = 3;

async function processStateBatch(
  supabase: any,
  state: string,
  categoryId: string,
  startIndex: number,
  maxAgentsPerCity: number,
  minRating: number,
  minReviews: number,
  triggerEnrichment: boolean
): Promise<{ processed: number; imported: number; remaining: number; nextIndex: number }> {
  
  console.log(`[State Import] Batch starting at index ${startIndex} for ${state}`);
  
  // Get all active cities in the state
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('id, name, slug, state, state_slug')
    .eq('state', state)
    .eq('active', true)
    .order('name');
  
  if (citiesError || !cities || cities.length === 0) {
    console.error(`[State Import] No cities found for state ${state}`);
    return { processed: 0, imported: 0, remaining: 0, nextIndex: -1 };
  }
  
  const totalCities = cities.length;
  const stateAbbr = state.length === 2 ? state : stateAbbreviations[state];
  
  // Get batch of cities to process
  const batchCities = cities.slice(startIndex, startIndex + CITIES_PER_BATCH);
  
  if (batchCities.length === 0) {
    console.log(`[State Import] ✅ ALL COMPLETE: No more cities to process`);
    return { processed: 0, imported: 0, remaining: 0, nextIndex: -1 };
  }
  
  console.log(`[State Import] Processing cities ${startIndex + 1}-${startIndex + batchCities.length} of ${totalCities}`);
  
  let totalImported = 0;
  
  for (let i = 0; i < batchCities.length; i++) {
    const city = batchCities[i];
    const cityIndex = startIndex + i + 1;
    console.log(`[State Import] [${cityIndex}/${totalCities}] Processing ${city.name}...`);
    
    const stats = await processSingleCity(
      supabase,
      city,
      stateAbbr,
      categoryId,
      maxAgentsPerCity,
      minRating,
      minReviews,
      triggerEnrichment
    );
    
    totalImported += stats.imported;
    
    // Small delay between cities
    if (i < batchCities.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }
  
  const nextIndex = startIndex + batchCities.length;
  const remaining = totalCities - nextIndex;
  
  console.log(`[State Import] Batch complete: ${batchCities.length} cities, ${totalImported} imported, ${remaining} remaining`);
  
  return { 
    processed: batchCities.length, 
    imported: totalImported, 
    remaining,
    nextIndex: remaining > 0 ? nextIndex : -1
  };
}

// Chain to next batch by invoking self
async function chainNextBatch(
  state: string,
  categoryId: string,
  nextIndex: number,
  maxAgents: number,
  minRating: number,
  minReviews: number,
  triggerEnrichment: boolean
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  console.log(`[State Import] 🔗 Chaining to next batch at index ${nextIndex}...`);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/import-agents-unified`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state,
        categoryId,
        startIndex: nextIndex,
        maxAgents,
        minRating,
        minReviews,
        triggerEnrichment,
        async: true
      })
    });
    
    if (!response.ok) {
      console.error(`[State Import] Chain failed: ${response.status}`);
    } else {
      console.log(`[State Import] ✅ Next batch triggered`);
    }
  } catch (err: any) {
    console.error(`[State Import] Chain error:`, err.message);
  }
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      cityId,
      categoryId,
      state,
      startIndex = 0, // For queue-based state import
      maxAgents = 50,
      minRating = 4.5,
      minReviews = 50,
      triggerEnrichment = true,
      dryRun = false,
      async: runAsync = true
    } = await req.json();

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // STATE-WIDE IMPORT MODE (queue-based)
    if (state) {
      // Get the category ID if not provided
      let finalCategoryId = categoryId;
      if (!finalCategoryId) {
        const { data: category } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', 'real-estate-agent')
          .single();
        finalCategoryId = category?.id;
      }
      
      if (!finalCategoryId) {
        return new Response(
          JSON.stringify({ success: false, error: 'categoryId required for state import' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Map state abbreviations to full names
      const stateAbbrToFull: Record<string, string> = {};
      for (const [full, abbr] of Object.entries(stateAbbreviations)) {
        stateAbbrToFull[abbr] = full;
      }
      const fullStateName = state.length === 2 ? (stateAbbrToFull[state.toUpperCase()] || state) : state;
      
      // Get city count for the state
      const { data: cities, error: citiesErr } = await supabase
        .from('cities')
        .select('id, name')
        .eq('state', fullStateName)
        .eq('active', true)
        .order('name');
      
      if (citiesErr || !cities || cities.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: `No cities found for state: ${state}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // DRY RUN for state
      if (dryRun) {
        return new Response(
          JSON.stringify({
            success: true,
            dryRun: true,
            state: fullStateName,
            cityCount: cities.length,
            cities: cities.map(c => c.name),
            maxAgentsPerCity: maxAgents,
            estimatedCredits: cities.length * (maxAgents + 1)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Process this batch
      const batchResult = await processStateBatch(
        supabase,
        fullStateName,
        finalCategoryId,
        startIndex,
        maxAgents,
        minRating,
        minReviews,
        triggerEnrichment
      );
      
      // If more cities remain, chain to next batch
      if (batchResult.nextIndex > 0) {
        // Use EdgeRuntime.waitUntil if available, otherwise fire-and-forget
        const chainPromise = chainNextBatch(
          fullStateName,
          finalCategoryId,
          batchResult.nextIndex,
          maxAgents,
          minRating,
          minReviews,
          triggerEnrichment
        );
        
        // @ts-ignore - EdgeRuntime may not be defined
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(chainPromise);
        } else {
          chainPromise.catch((e: Error) => console.error('[Chain] Error:', e.message));
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: startIndex === 0 
            ? `State-wide import started for ${fullStateName}`
            : `Batch ${Math.floor(startIndex / CITIES_PER_BATCH) + 1} complete`,
          state: fullStateName,
          batch: {
            startIndex,
            processed: batchResult.processed,
            imported: batchResult.imported,
            remaining: batchResult.remaining,
            nextIndex: batchResult.nextIndex
          },
          totalCities: cities.length,
          mode: 'queue-based'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SINGLE CITY IMPORT MODE (existing logic)
    if (!cityId || !categoryId) {
      return new Response(
        JSON.stringify({ success: false, error: 'cityId and categoryId are required (or use state for state-wide)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get city info
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('name, state, slug, state_slug')
      .eq('id', cityId)
      .single();

    if (cityError || !city) {
      throw new Error(`City not found: ${cityId}`);
    }

    const stateAbbr = city.state.length === 2 ? city.state : stateAbbreviations[city.state];
    if (!stateAbbr) {
      throw new Error(`Unknown state: ${city.state}`);
    }

    console.log(`[Unified Import] Starting for ${city.name}, ${stateAbbr}`);
    console.log(`[Unified Import] Criteria: ${minRating}+ stars, ${minReviews}+ reviews, max ${maxAgents}`);

    // DRY RUN MODE
    if (dryRun) {
      const profileUrls = await scrapeSearchPage(city.name, stateAbbr);
      const existingUrls = await getExistingAgentUrls(supabase, profileUrls);
      const newUrls = profileUrls.filter(url => !existingUrls.has(url));
      
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          city: city.name,
          state: stateAbbr,
          totalAgentsFound: profileUrls.length,
          alreadyImported: existingUrls.size,
          newAgents: newUrls.length,
          wouldProcess: Math.min(newUrls.length, maxAgents),
          estimatedFirecrawlCredits: Math.min(newUrls.length, maxAgents) + 1,
          sampleNewUrls: newUrls.slice(0, 5)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ASYNC MODE
    if (runAsync) {
      const backgroundTask = runImportBackground(
        supabase,
        cityId,
        categoryId,
        city,
        stateAbbr,
        maxAgents,
        minRating,
        minReviews,
        triggerEnrichment
      );
      
      backgroundTask.catch(err => console.error('[Background Import] Error:', err));
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Import started in background',
          city: city.name,
          state: stateAbbr,
          mode: 'async',
          checkLogsFor: 'progress updates'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SYNC MODE
    await runImportBackground(
      supabase,
      cityId,
      categoryId,
      city,
      stateAbbr,
      maxAgents,
      minRating,
      minReviews,
      triggerEnrichment
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        city: city.name,
        state: stateAbbr,
        mode: 'sync',
        message: 'Import complete - check logs for details'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Unified Import] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Shutdown handler for logging
addEventListener('beforeunload', (ev: any) => {
  console.log(`[Unified Import] Shutdown: ${ev.detail?.reason || 'unknown'}`);
});
