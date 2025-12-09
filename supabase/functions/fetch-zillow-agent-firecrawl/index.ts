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
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

// Schema for structured extraction from Zillow agent profiles
const ZILLOW_AGENT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Full name of the real estate agent' },
    screenName: { type: 'string', description: 'Zillow screen name / profile slug' },
    businessName: { type: 'string', description: 'Brokerage or business name' },
    businessAddress: {
      type: 'object',
      properties: {
        address1: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        postalCode: { type: 'string' }
      }
    },
    phone: { type: 'string', description: 'Primary phone number' },
    email: { type: 'string', description: 'Email address' },
    website: { type: 'string', description: 'Personal/team website URL' },
    profilePhotoUrl: { type: 'string', description: 'Profile photo URL' },
    
    // Stats
    ratingsAverage: { type: 'number', description: 'Average rating (e.g., 5.0)' },
    ratingsCount: { type: 'integer', description: 'Total number of reviews' },
    salesLast12Months: { type: 'integer', description: 'Number of sales in last 12 months' },
    totalSales: { type: 'integer', description: 'Total career sales' },
    priceRangeMin: { type: 'string', description: 'Minimum price in range (e.g., "$13K")' },
    priceRangeMax: { type: 'string', description: 'Maximum price in range (e.g., "$5.6M")' },
    averagePrice: { type: 'string', description: 'Average sale price' },
    yearsExperience: { type: 'integer', description: 'Years of experience' },
    
    // Profile details
    isTopAgent: { type: 'boolean', description: 'Is marked as Top Agent' },
    isPremierAgent: { type: 'boolean', description: 'Is a Zillow Premier Agent' },
    specialties: { 
      type: 'array', 
      items: { type: 'string' },
      description: 'List of specialties (e.g., Buyer\'s Agent, Listing Agent)' 
    },
    languages: { 
      type: 'array', 
      items: { type: 'string' },
      description: 'Languages spoken' 
    },
    bio: { type: 'string', description: 'Agent bio/description text' },
    
    // Team info
    teamName: { type: 'string', description: 'Team name if applicable' },
    teamSize: { type: 'integer', description: 'Number of team members' },
    isTeamLead: { type: 'boolean', description: 'Is the team lead' },
    
    // Social
    facebookUrl: { type: 'string' },
    linkedinUrl: { type: 'string' },
    
    // Listings summary
    activeListingsCount: { type: 'integer', description: 'Number of active for-sale listings' },
    rentalListingsCount: { type: 'integer', description: 'Number of rental listings' }
  }
};

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown: string;
    extract?: Record<string, unknown>;
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
    throw new Error('FIRECRAWL_API_KEY is not configured');
  }

  const response = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: profileUrl,
      formats: ['markdown', 'extract'],
      onlyMainContent: true,
      waitFor: 2000,
      extract: {
        schema: ZILLOW_AGENT_SCHEMA,
        prompt: `Extract all real estate agent profile information from this Zillow agent page. 
                 Include contact info, sales statistics, ratings, specialties, bio, and team information.
                 For sales stats, extract the exact numbers shown (e.g., "1,483 sales last 12 months").
                 For price range, capture both min and max values.`
      }
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

  const extract = result.data?.extract || {};
  const metadata = result.data?.metadata || {};
  const markdown = result.data?.markdown || '';

  // Parse additional data from markdown if extract missed it
  const additionalData = parseMarkdownFallback(markdown);

  // Build the agent data object
  const agentData: AgentData = {
    // Core identity
    name: (extract.name as string) || additionalData.name || null,
    screenName: (extract.screenName as string) || extractScreenName(profileUrl),
    businessName: (extract.businessName as string) || additionalData.businessName || null,
    
    // Contact
    businessAddress: extract.businessAddress as AgentData['businessAddress'] || additionalData.businessAddress || null,
    phone: (extract.phone as string) || additionalData.phone || null,
    email: (extract.email as string) || additionalData.email || null,
    website: (extract.website as string) || additionalData.website || null,
    profilePhotoUrl: (extract.profilePhotoUrl as string) || (metadata.ogImage as string) || null,
    
    // Stats
    ratingsAverage: (extract.ratingsAverage as number) || additionalData.ratingsAverage || null,
    ratingsCount: (extract.ratingsCount as number) || additionalData.ratingsCount || null,
    salesLast12Months: (extract.salesLast12Months as number) || additionalData.salesLast12Months || null,
    totalSales: (extract.totalSales as number) || additionalData.totalSales || null,
    priceRangeMin: (extract.priceRangeMin as string) || additionalData.priceRangeMin || null,
    priceRangeMax: (extract.priceRangeMax as string) || additionalData.priceRangeMax || null,
    averagePrice: (extract.averagePrice as string) || additionalData.averagePrice || null,
    yearsExperience: (extract.yearsExperience as number) || additionalData.yearsExperience || null,
    
    // Status
    isTopAgent: (extract.isTopAgent as boolean) || additionalData.isTopAgent || false,
    isPremierAgent: (extract.isPremierAgent as boolean) || additionalData.isPremierAgent || false,
    
    // Profile
    specialties: (extract.specialties as string[]) || additionalData.specialties || [],
    languages: (extract.languages as string[]) || additionalData.languages || [],
    bio: (extract.bio as string) || additionalData.bio || null,
    
    // Team
    teamName: (extract.teamName as string) || additionalData.teamName || null,
    teamSize: (extract.teamSize as number) || additionalData.teamSize || null,
    isTeamLead: (extract.isTeamLead as boolean) || additionalData.isTeamLead || false,
    
    // Social
    facebookUrl: (extract.facebookUrl as string) || additionalData.facebookUrl || null,
    linkedinUrl: (extract.linkedinUrl as string) || additionalData.linkedinUrl || null,
    
    // Listings
    activeListingsCount: (extract.activeListingsCount as number) || additionalData.activeListingsCount || null,
    rentalListingsCount: (extract.rentalListingsCount as number) || additionalData.rentalListingsCount || null,
    
    // Meta
    zillowProfileUrl: profileUrl,
    scrapedAt: new Date().toISOString(),
    scrapeMethod: 'firecrawl',
    rawMarkdown: markdown.substring(0, 5000) // Store first 5k chars for debugging
  };

  console.log(`[Firecrawl] Extracted: ${agentData.name}, ${agentData.ratingsCount} reviews, ${agentData.salesLast12Months} sales`);
  
  return agentData;
}

function extractScreenName(url: string): string | null {
  const match = url.match(/zillow\.com\/profile\/([^/?#]+)/i);
  return match ? match[1] : null;
}

// Fallback parser for data that LLM extraction might miss
function parseMarkdownFallback(markdown: string): Partial<AgentData> {
  const data: Partial<AgentData> = {};

  // Extract name from "# George Laughton" pattern
  const nameMatch = markdown.match(/^#\s+(.+?)$/m);
  if (nameMatch) data.name = nameMatch[1].trim();

  // Extract team name from "## Meet The X Team" or "Lead of X"
  const teamMatch = markdown.match(/Meet The (.+? Team)/i) || markdown.match(/Lead of\s*(.+?)(?:\n|$)/i);
  if (teamMatch) data.teamName = teamMatch[1].trim();

  // Extract team size from "190 members"
  const teamSizeMatch = markdown.match(/(\d+)\s*members/i);
  if (teamSizeMatch) data.teamSize = parseInt(teamSizeMatch[1]);

  // Extract ratings from "5.0 [3,786 team reviews]" or "5.0(149)"
  const ratingMatch = markdown.match(/(\d+\.?\d*)\s*[\[(]?([\d,]+)\s*(?:team\s*)?reviews/i);
  if (ratingMatch) {
    data.ratingsAverage = parseFloat(ratingMatch[1]);
    data.ratingsCount = parseInt(ratingMatch[2].replace(/,/g, ''));
  }

  // Extract sales stats
  const salesMatch = markdown.match(/\*\*([\d,]+)\*\*\s*sales last 12 months/i);
  if (salesMatch) data.salesLast12Months = parseInt(salesMatch[1].replace(/,/g, ''));

  const totalSalesMatch = markdown.match(/\*\*([\d,]+)\*\*\s*total sales/i);
  if (totalSalesMatch) data.totalSales = parseInt(totalSalesMatch[1].replace(/,/g, ''));

  // Extract price range
  const priceRangeMatch = markdown.match(/\*\*(\$[\d.]+[KMB]?)-(\$[\d.]+[KMB]?)\*\*\s*price range/i);
  if (priceRangeMatch) {
    data.priceRangeMin = priceRangeMatch[1];
    data.priceRangeMax = priceRangeMatch[2];
  }

  // Extract average price
  const avgPriceMatch = markdown.match(/\*\*(\$[\d,]+[KMB]?)\*\*\s*average price/i);
  if (avgPriceMatch) data.averagePrice = avgPriceMatch[1];

  // Extract years experience
  const expMatch = markdown.match(/\*\*(\d+)\*\*\s*years? of experience/i) || markdown.match(/(\d+)\s+Years? of experience/i);
  if (expMatch) data.yearsExperience = parseInt(expMatch[1]);

  // Extract phone
  const phoneMatch = markdown.match(/\[?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\]?/);
  if (phoneMatch) data.phone = phoneMatch[0].replace(/[\[\]]/g, '');

  // Extract email
  const emailMatch = markdown.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) data.email = emailMatch[1];

  // Extract website
  const websiteMatch = markdown.match(/\[Visit (?:team )?website\]\(([^)]+)\)/i);
  if (websiteMatch) data.website = websiteMatch[1];

  // Extract social links
  const fbMatch = markdown.match(/\[Facebook\]\(([^)]+)\)/i);
  if (fbMatch) data.facebookUrl = fbMatch[1];

  const liMatch = markdown.match(/\[LinkedIn\]\(([^)]+)\)/i);
  if (liMatch) data.linkedinUrl = liMatch[1];

  // Extract specialties
  const specialtiesMatch = markdown.match(/Specialties\s*\n\s*([^\n]+)/i);
  if (specialtiesMatch) {
    data.specialties = specialtiesMatch[1].split(/(?=[A-Z])/).filter(s => s.trim().length > 0);
  }

  // Extract languages
  const langMatch = markdown.match(/Speaks\s*([^\n]+)/i);
  if (langMatch) {
    data.languages = langMatch[1].split(/,\s*/).map(l => l.trim());
  }

  // Extract bio from "Get to know" section
  const bioMatch = markdown.match(/## Get to know[^\n]*\n\n([^#]+?)(?=\n\n(?:Show more|Specialties|\*\*))/is);
  if (bioMatch) {
    data.bio = bioMatch[1].trim().replace(/\n+/g, ' ').substring(0, 2000);
  }

  // Check for Premier Agent
  data.isPremierAgent = markdown.toLowerCase().includes('premier agent');
  
  // Check for Top Agent
  data.isTopAgent = markdown.toLowerCase().includes('top agent');

  // Extract brokerage
  const brokerageMatch = markdown.match(/(?:^|\n)([A-Za-z\s]+(?:Group|Realty|Real Estate|Brokerage|Properties))/i);
  if (brokerageMatch) data.businessName = brokerageMatch[1].trim();

  // Extract listings count from "For Sale (236)"
  const listingsMatch = markdown.match(/For Sale\s*\((\d+)\)/i);
  if (listingsMatch) data.activeListingsCount = parseInt(listingsMatch[1]);

  const rentalsMatch = markdown.match(/For Rent\s*\((\d+)\)/i);
  if (rentalsMatch) data.rentalListingsCount = parseInt(rentalsMatch[1]);

  return data;
}

// Main handler
Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

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
          get_to_know_me: agentData.bio,
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