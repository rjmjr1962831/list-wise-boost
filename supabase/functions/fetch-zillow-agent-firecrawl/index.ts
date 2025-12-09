/**
 * fetch-zillow-agent-firecrawl
 * 
 * Drop-in replacement for fetch-single-memo23-agent
 * Uses Firecrawl instead of Apify for faster, more reliable Zillow scraping
 * 
 * Speed: 2-5 seconds vs 30-60+ seconds with Apify
 * Cost: 1 Firecrawl credit (~$0.006) per agent
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/scrape';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown: string;
    metadata?: {
      ogImage?: string;
      title?: string;
      description?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  };
  error?: string;
}

interface AgentData {
  // Core identity
  name: string | null;
  screenName: string | null;
  businessName: string | null;
  
  // Contact
  businessAddress: {
    address1: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  } | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  profilePhotoUrl: string | null;
  
  // Stats
  ratingsAverage: number | null;
  ratingsCount: number | null;
  salesLast12Months: number | null;
  totalSales: number | null;
  priceRangeMin: string | null;
  priceRangeMax: string | null;
  averagePrice: string | null;
  yearsExperience: number | null;
  
  // Status
  isTopAgent: boolean;
  isPremierAgent: boolean;
  
  // Profile
  specialties: string[];
  languages: string[];
  bio: string | null;
  
  // Team
  teamName: string | null;
  teamSize: number | null;
  isTeamLead: boolean;
  
  // Social
  facebookUrl: string | null;
  linkedinUrl: string | null;
  
  // Listings
  activeListingsCount: number | null;
  rentalListingsCount: number | null;
  
  // Meta
  zillowProfileUrl: string;
  scrapedAt: string;
  scrapeMethod: 'firecrawl';
  rawMarkdown?: string;
}

async function scrapeZillowAgent(profileUrl: string): Promise<AgentData> {
  console.log(`[Firecrawl] Scraping: ${profileUrl}`);
  const startTime = Date.now();

  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  // FAST MODE: Markdown only, no LLM extraction (2-4 sec vs 13+ sec)
  const response = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: profileUrl,
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 1000 // Reduced from 2000ms
    })
  });

  const duration = Date.now() - startTime;
  console.log(`[Firecrawl] Response received in ${duration}ms`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error ${response.status}: ${errorText}`);
  }

  const result: FirecrawlResponse = await response.json();

  if (!result.success) {
    throw new Error(`Firecrawl scrape failed: ${result.error || 'Unknown error'}`);
  }

  const metadata = result.data?.metadata || {};
  const markdown = result.data?.markdown || '';

  // Parse all data from markdown (fast, no LLM needed)
  const parsedData = parseMarkdownFallback(markdown);

  // Build the agent data object from parsed markdown
  const agentData: AgentData = {
    // Core identity
    name: parsedData.name || null,
    screenName: extractScreenName(profileUrl),
    businessName: parsedData.businessName || null,
    
    // Contact
    businessAddress: parsedData.businessAddress || null,
    phone: parsedData.phone || null,
    email: parsedData.email || null,
    website: parsedData.website || null,
    profilePhotoUrl: (metadata.ogImage as string) || null,
    
    // Stats
    ratingsAverage: parsedData.ratingsAverage || null,
    ratingsCount: parsedData.ratingsCount || null,
    salesLast12Months: parsedData.salesLast12Months || null,
    totalSales: parsedData.totalSales || null,
    priceRangeMin: parsedData.priceRangeMin || null,
    priceRangeMax: parsedData.priceRangeMax || null,
    averagePrice: parsedData.averagePrice || null,
    yearsExperience: parsedData.yearsExperience || null,
    
    // Status
    isTopAgent: parsedData.isTopAgent || false,
    isPremierAgent: parsedData.isPremierAgent || false,
    
    // Profile
    specialties: parsedData.specialties || [],
    languages: parsedData.languages || [],
    bio: parsedData.bio || null,
    
    // Team
    teamName: parsedData.teamName || null,
    teamSize: parsedData.teamSize || null,
    isTeamLead: parsedData.isTeamLead || false,
    
    // Social
    facebookUrl: parsedData.facebookUrl || null,
    linkedinUrl: parsedData.linkedinUrl || null,
    
    // Listings
    activeListingsCount: parsedData.activeListingsCount || null,
    rentalListingsCount: parsedData.rentalListingsCount || null,
    
    // Meta
    zillowProfileUrl: profileUrl,
    scrapedAt: new Date().toISOString(),
    scrapeMethod: 'firecrawl',
    rawMarkdown: markdown
  };

  console.log(`[Firecrawl] Extracted: ${agentData.name}, ${agentData.ratingsCount} reviews, ${agentData.salesLast12Months} sales`);
  
  return agentData;
}

function extractScreenName(url: string): string | null {
  const match = url.match(/zillow\.com\/profile\/([^/?#]+)/i);
  return match ? match[1] : null;
}

// Robust markdown parser for Zillow agent profiles
function parseMarkdownFallback(markdown: string): Partial<AgentData> {
  const data: Partial<AgentData> = {};

  // Extract name from "# George Laughton" pattern (at end of page typically)
  const nameMatch = markdown.match(/^#\s+([A-Za-z\s]+?)$/m);
  if (nameMatch) data.name = nameMatch[1].trim();

  // Extract team name from "## Meet The X Team" or "Lead of The X Team"
  const teamMatch = markdown.match(/Meet The (.+? Team)/i) || markdown.match(/Lead of\s*The\s*(.+? Team)/i);
  if (teamMatch) data.teamName = teamMatch[1].trim();

  // Check if team lead
  data.isTeamLead = /Lead of/i.test(markdown);

  // Extract team size from "190 members"
  const teamSizeMatch = markdown.match(/(\d+)\s*members/i);
  if (teamSizeMatch) data.teamSize = parseInt(teamSizeMatch[1]);

  // Extract ratings - multiple patterns
  // Pattern 1: "5.0 [3,786 team reviews]"
  // Pattern 2: "5.0(149)"
  const ratingMatch = markdown.match(/(\d+\.?\d*)\s*[\[(]?([\d,]+)\s*(?:team\s*)?reviews/i);
  if (ratingMatch) {
    data.ratingsAverage = parseFloat(ratingMatch[1]);
    data.ratingsCount = parseInt(ratingMatch[2].replace(/,/g, ''));
  }

  // Extract sales stats - bold format: **1,483**sales last 12 months
  const salesMatch = markdown.match(/\*\*([\d,]+)\*\*\s*sales last 12 months/i);
  if (salesMatch) data.salesLast12Months = parseInt(salesMatch[1].replace(/,/g, ''));

  const totalSalesMatch = markdown.match(/\*\*([\d,]+)\*\*\s*total sales/i);
  if (totalSalesMatch) data.totalSales = parseInt(totalSalesMatch[1].replace(/,/g, ''));

  // Extract price range: **$13K-$5.6M**price range
  const priceRangeMatch = markdown.match(/\*\*(\$[\d.]+[KMB]?)-(\$[\d.]+[KMB]?)\*\*\s*price range/i);
  if (priceRangeMatch) {
    data.priceRangeMin = priceRangeMatch[1];
    data.priceRangeMax = priceRangeMatch[2];
  }

  // Extract average price: **$487K**average price
  const avgPriceMatch = markdown.match(/\*\*(\$[\d,]+[KMB]?)\*\*\s*average price/i);
  if (avgPriceMatch) data.averagePrice = avgPriceMatch[1];

  // Extract years experience: **19**years of experience OR "19 Years of experience"
  const expMatch = markdown.match(/\*\*(\d+)\*\*\s*years? of experience/i) || 
                   markdown.match(/(\d+)\s+Years? of experience/i);
  if (expMatch) data.yearsExperience = parseInt(expMatch[1]);

  // Extract phone: [(623) 462-3017](tel:...)
  const phoneMatch = markdown.match(/\[?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\]?/);
  if (phoneMatch) data.phone = phoneMatch[0].replace(/[\[\]]/g, '');

  // Extract email from mailto link
  const emailMatch = markdown.match(/\[([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\]/);
  if (emailMatch) {
    data.email = emailMatch[1];
  } else {
    // Fallback: plain email
    const plainEmailMatch = markdown.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (plainEmailMatch) data.email = plainEmailMatch[1];
  }

  // Extract website from [Visit team website](url)
  const websiteMatch = markdown.match(/\[Visit (?:team )?website\]\(([^)]+)\)/i);
  if (websiteMatch) data.website = websiteMatch[1];

  // Extract social links
  const fbMatch = markdown.match(/\[Facebook\]\(([^)]+)\)/i);
  if (fbMatch) data.facebookUrl = fbMatch[1];

  const liMatch = markdown.match(/\[LinkedIn\]\(([^)]+)\)/i);
  if (liMatch) data.linkedinUrl = liMatch[1];

  // Extract specialties - appears after "Specialties" header
  const specialtiesSection = markdown.match(/Specialties\s*\n\s*([^\n]+)/i);
  if (specialtiesSection) {
    // Split on capital letters that start new words (BuyerAgent -> Buyer, Agent)
    const rawSpecialties = specialtiesSection[1];
    data.specialties = rawSpecialties
      .split(/(?=[A-Z][a-z])/)
      .map(s => s.trim())
      .filter(s => s.length > 2);
  }

  // Extract languages - "SpeaksEnglish, Spanish" or "Speaks English, Spanish"
  const langMatch = markdown.match(/Speaks?\s*([A-Za-z,\s]+?)(?:\n|$)/i);
  if (langMatch) {
    data.languages = langMatch[1]
      .split(/,\s*/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
  }

  // Extract bio from "Get to know" section
  const bioMatch = markdown.match(/## Get to know[^\n]*\n+(?:Your Neighborhood Realtors\s*\n+)?(.+?)(?=\n\nShow more|\n\nSpecialties|\*\*|##)/is);
  if (bioMatch) {
    data.bio = bioMatch[1]
      .trim()
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 2000);
  }

  // Check for Premier Agent
  data.isPremierAgent = /premier agent/i.test(markdown);
  
  // Check for Top Agent
  data.isTopAgent = /top agent/i.test(markdown) || /What is Top Agent\?/i.test(markdown);

  // Extract brokerage - look for pattern before "Lead of" or standalone
  const brokerageMatch = markdown.match(/^([A-Za-z\s]+(?:Group|Realty|Real Estate|Brokerage|Properties|RE\/MAX|Keller Williams|Coldwell Banker|Century 21|eXp))(?:\s*Lead of|\s*$)/im);
  if (brokerageMatch) {
    data.businessName = brokerageMatch[1].trim();
  }

  // Extract address from maps link or text
  const addressMatch = markdown.match(/\[([^\]]+(?:Drive|Dr|Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)[^\]]*)\]\(https:\/\/maps\.google/i);
  if (addressMatch) {
    const addrParts = addressMatch[1].split(/\\n|,/).map(p => p.trim());
    if (addrParts.length >= 2) {
      const lastPart = addrParts[addrParts.length - 1];
      const stateZipMatch = lastPart.match(/([A-Z]{2})\s*,?\s*(\d{5})/);
      data.businessAddress = {
        address1: addrParts[0],
        city: addrParts.length > 2 ? addrParts[1].replace(/,/g, '') : null,
        state: stateZipMatch ? stateZipMatch[1] : null,
        postalCode: stateZipMatch ? stateZipMatch[2] : null
      };
    }
  }

  // Extract listings count from "## For Sale (236)"
  const listingsMatch = markdown.match(/## For Sale\s*\((\d+)\)/i);
  if (listingsMatch) data.activeListingsCount = parseInt(listingsMatch[1]);

  const rentalsMatch = markdown.match(/## For Rent\s*\((\d+)\)/i);
  if (rentalsMatch) data.rentalListingsCount = parseInt(rentalsMatch[1]);

  return data;
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl, agentId, updateDatabase } = await req.json();

    if (!profileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'profileUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate it's a Zillow profile URL
    if (!profileUrl.includes('zillow.com/profile/')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Zillow profile URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scrape the agent
    const agentData = await scrapeZillowAgent(profileUrl);

    // Optionally update database
    if (updateDatabase && agentId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from('professionals')
        .update({
          name: agentData.name,
          business_name: agentData.businessName,
          phone: agentData.phone,
          email: agentData.email,
          website: agentData.website,
          image_url: agentData.profilePhotoUrl,
          review_stars_rating: agentData.ratingsAverage,
          num_total_reviews: agentData.ratingsCount,
          total_sales: agentData.totalSales,
          years_experience: agentData.yearsExperience,
          specialty: agentData.specialties,
          languages: agentData.languages,
          description: agentData.bio,
          zillow_profile_url: profileUrl,
          raw_scraper_data: agentData,
          zillow_data_fetched_at: agentData.scrapedAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId);

      if (updateError) {
        console.error('[Firecrawl] Database update error:', updateError);
      } else {
        console.log(`[Firecrawl] Updated database for agent ${agentId}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: agentData,
        meta: {
          scrapeMethod: 'firecrawl',
          creditUsed: 1
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Firecrawl] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
