/**
 * import-agents-firecrawl
 * 
 * Uses Firecrawl to scrape Zillow agent search results
 * and import agents for a given city
 * 
 * Flow:
 * 1. Scrape Zillow agent search page for the city
 * 2. Extract agent profile URLs from search results
 * 3. Scrape each agent profile with Firecrawl
 * 4. Save to database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgentResult {
  name: string;
  profileUrl: string;
  rating?: number;
  reviewCount?: number;
  salesCount?: number;
  photoUrl?: string;
}

// Extract agent profile links from Zillow search results markdown
function extractAgentLinksFromMarkdown(markdown: string): AgentResult[] {
  const agents: AgentResult[] = [];
  
  // Pattern: Look for agent profile links like [Agent Name](https://www.zillow.com/profile/screenname)
  const profileLinkPattern = /\[([^\]]+)\]\((https:\/\/www\.zillow\.com\/profile\/[^)]+)\)/gi;
  const matches = [...markdown.matchAll(profileLinkPattern)];
  
  for (const match of matches) {
    const name = match[1].trim();
    const profileUrl = match[2];
    
    // Skip if it's not a person name (e.g., "Team", "Contact", etc.)
    if (name.length < 3 || /^(Contact|Team|About|Reviews|More)$/i.test(name)) {
      continue;
    }
    
    // Skip duplicates
    if (agents.find(a => a.profileUrl === profileUrl)) {
      continue;
    }
    
    agents.push({ name, profileUrl });
  }

  // Also try to extract from simpler patterns like agent cards
  // Pattern: Screen name based URLs
  const simplePattern = /https:\/\/www\.zillow\.com\/profile\/([a-zA-Z0-9_-]+)/g;
  const simpleMatches = [...markdown.matchAll(simplePattern)];
  
  for (const match of simpleMatches) {
    const profileUrl = match[0];
    const screenName = match[1];
    
    if (!agents.find(a => a.profileUrl === profileUrl)) {
      agents.push({ 
        name: screenName, // Will be updated when we scrape the profile
        profileUrl 
      });
    }
  }

  console.log(`[Firecrawl Import] Extracted ${agents.length} unique agent URLs`);
  return agents;
}

// Extract rating from nearby text
function extractRatingFromContext(markdown: string, profileUrl: string): { rating?: number; reviewCount?: number } {
  const screenName = profileUrl.match(/profile\/([^/?#]+)/)?.[1];
  if (!screenName) return {};
  
  // Look for rating pattern near this agent
  const ratingPattern = new RegExp(`${screenName}[^]*?(\\d+\\.\\d+)\\s*[\\[(](\\d+)\\s*reviews?`, 'i');
  const match = markdown.match(ratingPattern);
  
  if (match) {
    return {
      rating: parseFloat(match[1]),
      reviewCount: parseInt(match[2])
    };
  }
  
  return {};
}

async function scrapeZillowSearchPage(searchUrl: string): Promise<string> {
  console.log(`[Firecrawl Import] Scraping search page: ${searchUrl}`);
  
  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: searchUrl,
      formats: ['markdown', 'links'],
      onlyMainContent: false, // Get all content including agent cards
      waitFor: 5000 // Wait for JS to load agent list
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Firecrawl scrape failed: ${result.error || 'Unknown error'}`);
  }

  // Combine markdown and links for better extraction
  let combined = result.data?.markdown || '';
  
  // Also add raw links if available
  if (result.data?.links && Array.isArray(result.data.links)) {
    for (const link of result.data.links) {
      if (link.includes('zillow.com/profile/')) {
        combined += `\n[Profile](${link})`;
      }
    }
  }

  console.log(`[Firecrawl Import] Got ${combined.length} chars of content`);
  return combined;
}

async function scrapeAgentProfile(profileUrl: string): Promise<any> {
  console.log(`[Firecrawl Import] Scraping profile: ${profileUrl}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: profileUrl,
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 3000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Firecrawl scrape failed: ${result.error || 'Unknown error'}`);
  }

  const markdown = result.data?.markdown || '';
  const metadata = result.data?.metadata || {};
  
  return parseAgentMarkdown(markdown, metadata, profileUrl);
}

function parseAgentMarkdown(markdown: string, metadata: any, profileUrl: string): any {
  const data: any = {
    zillowProfileUrl: profileUrl,
    screenName: profileUrl.match(/profile\/([^/?#]+)/)?.[1] || null
  };

  // Name from heading
  const nameMatch = markdown.match(/^#\s+([A-Za-z\s]+?)$/m);
  if (nameMatch) data.name = nameMatch[1].trim();

  // Rating and reviews
  const ratingMatch = markdown.match(/(\d+\.?\d*)\s*[\[(]?([\d,]+)\s*(?:team\s*)?reviews/i);
  if (ratingMatch) {
    data.ratingsAverage = parseFloat(ratingMatch[1]);
    data.ratingsCount = parseInt(ratingMatch[2].replace(/,/g, ''));
  }

  // Sales
  const salesMatch = markdown.match(/\*\*([\d,]+)\*\*\s*sales last 12 months/i);
  if (salesMatch) data.salesLast12Months = parseInt(salesMatch[1].replace(/,/g, ''));

  const totalSalesMatch = markdown.match(/\*\*([\d,]+)\*\*\s*total sales/i);
  if (totalSalesMatch) data.totalSales = parseInt(totalSalesMatch[1].replace(/,/g, ''));

  // Experience
  const expMatch = markdown.match(/\*\*(\d+)\*\*\s*years? of experience/i) || 
                   markdown.match(/(\d+)\s+Years? of experience/i);
  if (expMatch) data.yearsExperience = parseInt(expMatch[1]);

  // Phone
  const telLinkMatch = markdown.match(/\[([^\]]*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}[^\]]*)\]\(tel:/);
  if (telLinkMatch) {
    const phoneDigits = telLinkMatch[1].replace(/\D/g, '');
    if (phoneDigits.length === 10) {
      data.phone = `(${phoneDigits.slice(0,3)}) ${phoneDigits.slice(3,6)}-${phoneDigits.slice(6)}`;
    }
  }

  // Email
  const emailMatch = markdown.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) data.email = emailMatch[1];

  // Website
  const websiteMatch = markdown.match(/\[Visit (?:team )?website\]\(([^)]+)\)/i);
  if (websiteMatch) data.website = websiteMatch[1];

  // Photo from OG image
  if (metadata?.ogImage) data.profilePhotoUrl = metadata.ogImage;

  // Status flags
  data.isPremierAgent = /premier agent/i.test(markdown);
  data.isTopAgent = /top agent/i.test(markdown) || /What is Top Agent\?/i.test(markdown);

  // Bio
  const bioMatch = markdown.match(/## Get to know[^\n]*\n+(.+?)(?=\n##|\n\*\*\d+\*\*|$)/is);
  if (bioMatch) {
    data.bio = bioMatch[1]
      .trim()
      .replace(/\[Show more\]\([^)]+\)/gi, '')
      .replace(/\[Show less\]\([^)]+\)/gi, '')
      .replace(/\[Visit (?:team )?website\]\([^)]+\)/gi, '')
      .replace(/\[Facebook\]\([^)]+\)/gi, '')
      .replace(/\[LinkedIn\]\([^)]+\)/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .substring(0, 3000);
  }

  // Brokerage
  const brokerageMatch = markdown.match(/^([A-Za-z\s]+(?:Group|Realty|Real Estate|Brokerage|Properties|RE\/MAX|Keller Williams|Coldwell Banker|Century 21|eXp))(?:\s*Lead of|\s*$)/im);
  if (brokerageMatch) {
    data.company = brokerageMatch[1].trim();
  }

  return data;
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cityName, stateName, stateAbbr, maxAgents = 20, minRating = 4.9 } = await req.json();

    if (!cityName || !stateName) {
      return new Response(
        JSON.stringify({ success: false, error: 'cityName and stateName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[Firecrawl Import] Starting import for ${cityName}, ${stateName}`);

    // Build Zillow search URL for the city
    const citySlug = cityName.toLowerCase().replace(/\s+/g, '-');
    const stateSlugLower = stateAbbr?.toLowerCase() || stateName.toLowerCase().replace(/\s+/g, '-');
    const searchUrl = `https://www.zillow.com/professionals/real-estate-agent-reviews/${citySlug}-${stateSlugLower}/`;
    
    console.log(`[Firecrawl Import] Search URL: ${searchUrl}`);

    // Step 1: Scrape the search results page
    const searchMarkdown = await scrapeZillowSearchPage(searchUrl);

    // Step 2: Extract agent profile URLs
    const agentLinks = extractAgentLinksFromMarkdown(searchMarkdown);
    
    if (agentLinks.length === 0) {
      console.log(`[Firecrawl Import] No agent links found in search results`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No agents found on search page',
          searchUrl,
          markdownLength: searchMarkdown.length 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Firecrawl Import] Found ${agentLinks.length} agent links, will process up to ${maxAgents}`);

    // Step 3: Get or create the city
    const citySlugDb = citySlug;
    const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');

    let { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', citySlugDb)
      .eq('state_slug', stateSlug)
      .single();

    if (!city) {
      // Create the city
      const { data: newCity, error: cityError } = await supabase
        .from('cities')
        .insert({
          name: cityName,
          slug: citySlugDb,
          state: stateName,
          state_slug: stateSlug,
          active: true
        })
        .select('id')
        .single();

      if (cityError) {
        throw new Error(`Failed to create city: ${cityError.message}`);
      }
      city = newCity;
      console.log(`[Firecrawl Import] Created city: ${cityName} (${city.id})`);
    }

    // Get the real estate agent category
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (!category) {
      throw new Error('Category top10realestateagents not found');
    }

    // Step 4: Scrape each agent profile and save
    const results = {
      imported: 0,
      skipped: 0,
      failed: 0,
      agents: [] as any[]
    };

    const agentsToProcess = agentLinks.slice(0, maxAgents);

    for (let i = 0; i < agentsToProcess.length; i++) {
      const agentLink = agentsToProcess[i];
      console.log(`[Firecrawl Import] [${i + 1}/${agentsToProcess.length}] Scraping ${agentLink.profileUrl}`);

      try {
        // Add delay between requests to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const agentData = await scrapeAgentProfile(agentLink.profileUrl);

        // Check minimum rating
        if (agentData.ratingsAverage && agentData.ratingsAverage < minRating) {
          console.log(`[Firecrawl Import] Skipping ${agentData.name || agentLink.name}: rating ${agentData.ratingsAverage} < ${minRating}`);
          results.skipped++;
          continue;
        }

        // Check if agent already exists by Zillow URL
        const { data: existing } = await supabase
          .from('professionals')
          .select('id')
          .eq('zillow_profile_url', agentLink.profileUrl)
          .single();

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('professionals')
            .update({
              name: agentData.name || agentLink.name,
              phone: agentData.phone,
              email: agentData.email,
              website: agentData.website,
              image_url: agentData.profilePhotoUrl,
              review_stars_rating: agentData.ratingsAverage,
              num_total_reviews: agentData.ratingsCount,
              total_sales: agentData.totalSales,
              years_experience: agentData.yearsExperience,
              company: agentData.company,
              description: agentData.bio,
              is_top_agent: agentData.isTopAgent,
              is_premier_agent: agentData.isPremierAgent,
              zillow_data_fetched_at: new Date().toISOString(),
              raw_scraper_data: agentData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`[Firecrawl Import] Update error for ${agentData.name}:`, updateError);
            results.failed++;
          } else {
            results.imported++;
            results.agents.push({ id: existing.id, name: agentData.name, action: 'updated' });
          }
        } else {
          // Insert new - determine type based on years of experience
          const agentType = agentData.yearsExperience >= 10 ? 'established' : 'individual';
          
          const { data: newAgent, error: insertError } = await supabase
            .from('professionals')
            .insert({
              name: agentData.name || agentLink.name,
              screen_name: agentData.screenName,
              city_id: city.id,
              category_id: category.id,
              type: agentType,
              rank: 999, // Will be ranked later
              active: true,
              phone: agentData.phone,
              email: agentData.email,
              website: agentData.website,
              image_url: agentData.profilePhotoUrl,
              review_stars_rating: agentData.ratingsAverage,
              num_total_reviews: agentData.ratingsCount,
              total_sales: agentData.totalSales,
              years_experience: agentData.yearsExperience,
              company: agentData.company,
              description: agentData.bio,
              is_top_agent: agentData.isTopAgent,
              is_premier_agent: agentData.isPremierAgent,
              zillow_profile_url: agentLink.profileUrl,
              zillow_data_fetched_at: new Date().toISOString(),
              raw_scraper_data: agentData
            })
            .select('id, name')
            .single();

          if (insertError) {
            console.error(`[Firecrawl Import] Insert error for ${agentData.name}:`, insertError);
            results.failed++;
          } else {
            results.imported++;
            results.agents.push({ id: newAgent.id, name: newAgent.name, action: 'created' });
            
            // Trigger full enrichment for newly created qualified agents
            try {
              console.log(`[Firecrawl Import] Triggering enrichment for ${newAgent.name}...`);
              
              // Step 1: Research press and community involvement
              const { error: pressError } = await supabase.functions.invoke('search-agent-press-claude', {
                body: {
                  professionalId: newAgent.id,
                  skipSynthesis: false, // Let it auto-trigger synthesis
                  skipIfNoPress: false  // Always proceed to synthesis for community research
                }
              });
              
              if (pressError) {
                console.error(`[Firecrawl Import] Enrichment error for ${newAgent.name}:`, pressError);
              } else {
                console.log(`[Firecrawl Import] ✅ Enrichment complete for ${newAgent.name}`);
                results.agents[results.agents.length - 1].enriched = true;
              }
            } catch (enrichError) {
              console.error(`[Firecrawl Import] Enrichment failed for ${newAgent.name}:`, enrichError);
            }
          }
        }

      } catch (error) {
        console.error(`[Firecrawl Import] Failed to scrape ${agentLink.profileUrl}:`, error);
        results.failed++;
      }
    }

    console.log(`[Firecrawl Import] Complete: ${results.imported} imported, ${results.skipped} skipped, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        city: cityName,
        state: stateName,
        searchUrl,
        results,
        creditsUsed: agentsToProcess.length + 1 // Search page + profiles
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Firecrawl Import] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
