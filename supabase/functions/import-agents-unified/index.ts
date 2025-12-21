/**
 * import-agents-unified
 * 
 * Unified Firecrawl-based agent import - replaces agenscrape + memo23
 * Single scraper that discovers agents AND extracts full profile data
 * 
 * Flow:
 * 1. Scrape Zillow agent search page for the city
 * 2. Extract agent profile URLs from search results
 * 3. Scrape each agent profile with Firecrawl JSON extraction
 * 4. Save complete data to database (same fields as memo23)
 * 5. Trigger press research and synthesis for qualified agents
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comprehensive schema for Zillow agent profiles - captures all memo23 fields
const ZILLOW_AGENT_SCHEMA = {
  type: "object",
  properties: {
    // Basic identity
    name: { type: "string", description: "Agent's full name" },
    screenName: { type: "string", description: "Zillow screen name from URL" },
    profilePhotoUrl: { type: "string", description: "Profile photo URL" },
    
    // Ratings and reviews
    rating: { type: "number", description: "Star rating (e.g., 4.9)" },
    reviewCount: { type: "number", description: "Total number of reviews" },
    
    // Sales performance
    salesLast12Months: { type: "number", description: "Number of sales in last 12 months" },
    totalSales: { type: "number", description: "Total lifetime sales" },
    currentListings: { type: "number", description: "Current active listings" },
    
    // Experience
    yearsExperience: { type: "number", description: "Years of experience in real estate" },
    
    // Contact info
    phone: { type: "string", description: "Phone number" },
    email: { type: "string", description: "Email address" },
    website: { type: "string", description: "Personal/team website URL" },
    
    // License info
    licenseNumber: { type: "string", description: "Real estate license number" },
    licenseState: { type: "string", description: "State where licensed" },
    
    // Brokerage
    brokerageName: { type: "string", description: "Brokerage or company name" },
    brokerageAddress: { type: "string", description: "Brokerage office address" },
    
    // Bio and description
    bio: { type: "string", description: "Agent's bio or 'Get to know me' section" },
    
    // Specialties and service areas
    specialties: { type: "array", items: { type: "string" }, description: "Agent specialties" },
    serviceAreas: { type: "array", items: { type: "string" }, description: "Cities/areas served" },
    languages: { type: "array", items: { type: "string" }, description: "Languages spoken" },
    
    // Social media
    facebookUrl: { type: "string" },
    instagramUrl: { type: "string" },
    linkedinUrl: { type: "string" },
    twitterUrl: { type: "string" },
    tiktokUrl: { type: "string" },
    youtubeUrl: { type: "string" },
    
    // Agent status
    isPremierAgent: { type: "boolean", description: "Is a Zillow Premier Agent" },
    isTopAgent: { type: "boolean", description: "Has Top Agent badge" },
    
    // Team info
    isTeam: { type: "boolean", description: "Is this a team vs individual" },
    teamName: { type: "string", description: "Team name if applicable" },
    teamMemberCount: { type: "number", description: "Number of team members" },
  },
  required: ["name"]
};

// State abbreviation mapper
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

// Extract agent profile links from Zillow search results
function extractAgentLinksFromContent(markdown: string, links: string[]): string[] {
  const profileUrls = new Set<string>();
  
  // Extract from explicit links array
  if (links && Array.isArray(links)) {
    for (const link of links) {
      if (link.includes('zillow.com/profile/') && !link.includes('/reviews')) {
        profileUrls.add(link.split('?')[0]); // Remove query params
      }
    }
  }
  
  // Extract from markdown content
  const profilePattern = /https:\/\/www\.zillow\.com\/profile\/([a-zA-Z0-9_-]+)/g;
  const matches = markdown.matchAll(profilePattern);
  for (const match of matches) {
    profileUrls.add(match[0].split('?')[0]);
  }
  
  console.log(`[Unified Import] Found ${profileUrls.size} unique agent profile URLs`);
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

// Scrape individual agent profile with JSON extraction
async function scrapeAgentProfile(profileUrl: string): Promise<any> {
  console.log(`[Unified Import] Scraping profile: ${profileUrl}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: profileUrl,
      formats: ['extract', 'markdown'],
      extract: {
        schema: ZILLOW_AGENT_SCHEMA
      },
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

  // Get structured data from extract, fall back to parsing markdown
  const extracted = result.data?.extract || {};
  const markdown = result.data?.markdown || '';
  const metadata = result.data?.metadata || {};
  
  // Merge extracted data with any additional parsing
  const agentData = {
    ...extracted,
    profileUrl,
    screenName: profileUrl.match(/profile\/([^/?#]+)/)?.[1] || null,
    profilePhotoUrl: extracted.profilePhotoUrl || metadata?.ogImage || null,
    // Parse additional data from markdown if not in extract
    ...parseMarkdownFallback(markdown, extracted)
  };
  
  return agentData;
}

// Fallback markdown parsing for fields not captured by extract
function parseMarkdownFallback(markdown: string, extracted: any): any {
  const fallback: any = {};
  
  // Only parse if extracted is missing the field
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
  
  const { data: licenseRecord, error } = await supabase
    .from('arizona_licenses')
    .select('*')
    .eq('license_number', normalizedLicense)
    .maybeSingle();

  if (error || !licenseRecord) {
    console.log(`License ${normalizedLicense} not found in Arizona database`);
    return { verified: false };
  }

  console.log(`✅ License verified: ${normalizedLicense}`);
  
  // Calculate years from original_date
  if (licenseRecord.original_date) {
    const issueDate = new Date(licenseRecord.original_date);
    const yearsExperience = new Date().getFullYear() - issueDate.getFullYear();
    return { verified: true, yearsExperience };
  }
  
  return { verified: true };
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
      maxAgents = 50,
      minRating = 4.5,
      minReviews = 50,
      triggerEnrichment = true,
      dryRun = false
    } = await req.json();

    if (!cityId || !categoryId) {
      return new Response(
        JSON.stringify({ success: false, error: 'cityId and categoryId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get city info
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('name, state, slug, state_slug')
      .eq('id', cityId)
      .single();

    if (cityError || !city) {
      throw new Error(`City not found: ${cityId}`);
    }

    // Get state abbreviation
    const stateAbbr = city.state.length === 2 ? city.state : stateAbbreviations[city.state];
    if (!stateAbbr) {
      throw new Error(`Unknown state: ${city.state}`);
    }

    console.log(`[Unified Import] Starting import for ${city.name}, ${stateAbbr}`);
    console.log(`[Unified Import] Criteria: ${minRating}+ stars, ${minReviews}+ reviews, max ${maxAgents} agents`);

    // DRY RUN MODE
    if (dryRun) {
      const profileUrls = await scrapeSearchPage(city.name, stateAbbr);
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          city: city.name,
          state: stateAbbr,
          agentUrlsFound: profileUrls.length,
          wouldProcess: Math.min(profileUrls.length, maxAgents),
          estimatedFirecrawlCredits: Math.min(profileUrls.length, maxAgents) + 1, // +1 for search page
          sampleUrls: profileUrls.slice(0, 5)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Find agent profile URLs
    const profileUrls = await scrapeSearchPage(city.name, stateAbbr);
    
    if (profileUrls.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No agents found on search page',
          city: city.name,
          imported: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get next rank for this city
    const { data: maxRankData } = await supabase
      .from('professional_cities')
      .select('rank')
      .eq('city_id', cityId)
      .order('rank', { ascending: false })
      .limit(1)
      .single();

    let nextRank = (maxRankData?.rank || 0) + 1;

    // Step 2: Process each agent
    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      agents: [] as any[]
    };

    const agentsToProcess = profileUrls.slice(0, maxAgents);

    for (let i = 0; i < agentsToProcess.length; i++) {
      const profileUrl = agentsToProcess[i];
      
      try {
        // Rate limiting delay
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`[Unified Import] [${i + 1}/${agentsToProcess.length}] Processing ${profileUrl}`);
        
        const agentData = await scrapeAgentProfile(profileUrl);

        // Check minimum rating
        const rating = agentData.rating || 0;
        if (rating < minRating) {
          console.log(`[Unified Import] Skipping ${agentData.name}: rating ${rating} < ${minRating}`);
          results.skipped++;
          continue;
        }

        // Check minimum reviews
        const reviews = agentData.reviewCount || 0;
        if (reviews < minReviews) {
          console.log(`[Unified Import] Skipping ${agentData.name}: reviews ${reviews} < ${minReviews}`);
          results.skipped++;
          continue;
        }

        console.log(`[Unified Import] ✅ ${agentData.name} qualifies: ${rating}★, ${reviews} reviews`);

        // Verify Arizona license if applicable
        let licenseVerified = false;
        let verifiedYears = agentData.yearsExperience;
        
        if (city.state === 'Arizona' && agentData.licenseNumber) {
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

        // Check if agent already exists
        const { data: existing } = await supabase
          .from('professionals')
          .select('id, badges')
          .eq('zillow_profile_url', profileUrl)
          .single();

        const updateData: any = {
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
          zillow_profile_url: profileUrl,
          zillow_data_fetched_at: new Date().toISOString(),
          raw_scraper_data: agentData,
          updated_at: new Date().toISOString()
        };

        // Add license verified badge
        if (licenseVerified) {
          updateData.license_verified_at = new Date().toISOString();
          const currentBadges = existing?.badges || [];
          if (!currentBadges.includes('License Verified')) {
            updateData.badges = [...currentBadges, 'License Verified'];
          }
        }

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('professionals')
            .update(updateData)
            .eq('id', existing.id);

          if (updateError) {
            console.error(`[Unified Import] Update error:`, updateError);
            results.failed++;
          } else {
            results.updated++;
            results.agents.push({ id: existing.id, name: agentData.name, action: 'updated' });
          }
        } else {
          // Insert new
          const { data: newAgent, error: insertError } = await supabase
            .from('professionals')
            .insert({
              ...updateData,
              city_id: cityId,
              category_id: categoryId,
              rank: nextRank,
              active: true
            })
            .select('id, name')
            .single();

          if (insertError) {
            console.error(`[Unified Import] Insert error:`, insertError);
            results.failed++;
          } else {
            // Link to city via junction table
            await supabase
              .from('professional_cities')
              .insert({
                professional_id: newAgent.id,
                city_id: cityId,
                rank: nextRank++,
                active: true
              });

            results.imported++;
            results.agents.push({ id: newAgent.id, name: newAgent.name, action: 'created' });

            // Trigger enrichment for new qualified agents
            if (triggerEnrichment) {
              supabase.functions.invoke('search-agent-press-claude', {
                body: {
                  professionalId: newAgent.id,
                  skipSynthesis: false,
                  skipIfNoPress: false
                }
              }).catch(err => console.log(`Enrichment triggered for ${newAgent.name}`));
            }
          }
        }

      } catch (error) {
        console.error(`[Unified Import] Failed to process ${profileUrl}:`, error);
        results.failed++;
      }
    }

    console.log(`[Unified Import] Complete: ${results.imported} new, ${results.updated} updated, ${results.skipped} skipped, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        city: city.name,
        state: stateAbbr,
        results,
        firecrawlCreditsUsed: agentsToProcess.length + 1
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
