/**
 * fetch-zillow-agent-firecrawl-json
 * 
 * Uses Firecrawl's JSON extraction to get structured Zillow agent data
 * This is the new format that replaces memo23 - faster, more stable, cheaper
 * 
 * To back out: switch import-city-agents back to fetch-single-memo23-agent
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema for Firecrawl JSON extraction - matches your output format
const zillowAgentSchema = {
  type: "object",
  properties: {
    url: { type: "string" },
    encodedZuid: { type: "string" },
    screenName: { type: "string" },
    fullName: { type: "string" },
    businessAddress: { type: "string" },
    brokerageName: { type: "string" },
    professionalDetails: {
      type: "object",
      properties: {
        agentLicenses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              value: { type: "string" }
            }
          }
        },
        pronouns: { type: "string" },
        topAgentStatus: { type: "boolean" },
        premierAgentStatus: { type: "boolean" }
      }
    },
    contactInformation: {
      type: "object",
      properties: {
        email: { type: "string" },
        phoneNumbers: {
          type: "object",
          properties: {
            cell: { type: "string" },
            brokerage: { type: "string" },
            business: { type: "string" }
          }
        }
      }
    },
    performanceMetrics: {
      type: "object",
      properties: {
        salesStatistics: {
          type: "object",
          properties: {
            allTimeSalesCount: { type: "number" },
            lastYearSalesCount: { type: "number" },
            priceRanges: {
              type: "object",
              properties: {
                minPrice: { type: "number" },
                maxPrice: { type: "number" }
              }
            }
          }
        },
        currentListings: {
          type: "object",
          properties: {
            forSale: { type: "array" },
            forRent: { type: "array" }
          }
        },
        pastSalesHistory: { type: "array" }
      }
    },
    ratings: {
      type: "object",
      properties: {
        overallRating: { type: "number" },
        subRatings: { type: "array" },
        reviewComments: { type: "array" }
      }
    },
    sidebarVideoUrls: { type: "array" },
    profilePhotos: { type: "array" },
    teamDisplayInformation: {
      type: "object",
      properties: {
        leadDetails: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            profileUrl: { type: "string" }
          }
        },
        memberDetails: { type: "array" }
      }
    },
    inCanada: { type: "boolean" },
    name: { type: "string" },
    profileTypeIds: { type: "array" },
    profileTypes: { type: "array" },
    businessName: { type: "string" },
    cpdUserPronouns: { type: "string" },
    isTopAgent: { type: "boolean" },
    profileImageId: { type: "string" },
    profilePhotoSrc: { type: "string" },
    isPremierAgent: { type: "boolean" },
    professional: {
      type: "object",
      properties: {
        yearsOfExperience: { type: "number" },
        specialties: { type: "array", items: { type: "string" } },
        languagesSpoken: { type: "array", items: { type: "string" } }
      }
    },
    getToKnowMe: { type: "string" },
    agentSalesStats: {
      type: "object",
      properties: {
        countAllTime: { type: "number" },
        countLastYear: { type: "number" },
        priceRangeThreeYearMin: { type: "number" },
        priceRangeThreeYearMax: { type: "number" },
        averageValueThreeYear: { type: "number" },
        stats_include_team: { type: "boolean" }
      }
    },
    forSaleListings: { type: "array" },
    forRentListings: { type: "array" },
    pastSales: { type: "array" },
    preferredLenders: { type: "array" },
    professionalInformation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          broker: { type: "string" },
          address: { type: "string" },
          phone: { type: "string" },
          website: { type: "string" },
          licenses: { type: "array", items: { type: "string" } },
          languages: { type: "array", items: { type: "string" } },
          areasServed: { type: "array", items: { type: "string" } }
        }
      }
    },
    reviewsData: {
      type: "object",
      properties: {
        totalReviews: { type: "number" },
        averageRating: { type: "number" },
        reviews: { type: "array" },
        subRatings: { type: "array" },
        reviewee: {
          type: "object",
          properties: {
            name: { type: "string" },
            teamName: { type: "string" }
          }
        }
      }
    }
  }
};

interface FirecrawlAgentData {
  url?: string;
  encodedZuid?: string;
  screenName?: string;
  fullName?: string;
  businessAddress?: string;
  brokerageName?: string;
  professionalDetails?: {
    agentLicenses?: Array<{ value: string }>;
    pronouns?: string;
    topAgentStatus?: boolean;
    premierAgentStatus?: boolean;
  };
  contactInformation?: {
    email?: string;
    phoneNumbers?: {
      cell?: string;
      brokerage?: string;
      business?: string;
    };
  };
  performanceMetrics?: {
    salesStatistics?: {
      allTimeSalesCount?: number;
      lastYearSalesCount?: number;
      priceRanges?: {
        minPrice?: number;
        maxPrice?: number;
      };
    };
    currentListings?: {
      forSale?: any[];
      forRent?: any[];
    };
    pastSalesHistory?: any[];
  };
  ratings?: {
    overallRating?: number;
    subRatings?: any[];
    reviewComments?: any[];
  };
  sidebarVideoUrls?: Array<{ value: string }>;
  profilePhotos?: Array<{ value: string }>;
  teamDisplayInformation?: {
    leadDetails?: {
      name?: string;
      role?: string;
      profileUrl?: string;
    };
    memberDetails?: any[];
  };
  inCanada?: boolean;
  name?: string;
  profileTypes?: any[];
  businessName?: string;
  cpdUserPronouns?: string;
  isTopAgent?: boolean;
  profilePhotoSrc?: string;
  isPremierAgent?: boolean;
  professional?: {
    yearsOfExperience?: number;
    specialties?: string[];
    languagesSpoken?: string[];
  };
  getToKnowMe?: string;
  agentSalesStats?: {
    countAllTime?: number;
    countLastYear?: number;
    priceRangeThreeYearMin?: number;
    priceRangeThreeYearMax?: number;
    averageValueThreeYear?: number;
    stats_include_team?: boolean;
  };
  forSaleListings?: any[];
  forRentListings?: any[];
  pastSales?: any[];
  professionalInformation?: Array<{
    broker?: string;
    address?: string;
    phone?: string;
    website?: string;
    licenses?: string[];
    languages?: string[];
    areasServed?: string[];
  }>;
  reviewsData?: {
    totalReviews?: number;
    averageRating?: number;
    reviews?: any[];
    subRatings?: any[];
    reviewee?: {
      name?: string;
      teamName?: string;
    };
  };
}

// Map Firecrawl JSON to professionals table schema
function mapToDatabase(data: FirecrawlAgentData, profileUrl: string) {
  const profInfo = data.professionalInformation?.[0];
  const phoneNumber = data.contactInformation?.phoneNumbers?.cell || 
                      data.contactInformation?.phoneNumbers?.business ||
                      profInfo?.phone;
  
  // Parse address into components
  let businessAddress = null;
  if (data.businessAddress) {
    const parts = data.businessAddress.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      const lastPart = parts[parts.length - 1];
      const stateZip = lastPart.match(/([A-Z]{2})\s*(\d{5})?/);
      businessAddress = {
        address1: parts[0],
        city: parts.length > 2 ? parts[parts.length - 2] : null,
        state: stateZip ? stateZip[1] : null,
        postalCode: stateZip ? stateZip[2] : null
      };
    }
  }

  return {
    // Core identity
    name: data.fullName || data.name,
    screen_name: data.screenName,
    encoded_zuid: data.encodedZuid,
    business_name: data.businessName || data.brokerageName,
    company: data.brokerageName,
    
    // Contact
    email: data.contactInformation?.email,
    phone: phoneNumber,
    website: profInfo?.website,
    address: data.businessAddress,
    business_address: businessAddress,
    image_url: data.profilePhotoSrc || data.profilePhotos?.[0]?.value,
    
    // Stats
    review_stars_rating: data.ratings?.overallRating || data.reviewsData?.averageRating,
    num_total_reviews: data.reviewsData?.totalReviews,
    total_sales: data.agentSalesStats?.countAllTime,
    current_listings: data.forSaleListings?.length || 0,
    years_experience: data.professional?.yearsOfExperience,
    
    // Agent flags
    is_top_agent: data.isTopAgent || data.professionalDetails?.topAgentStatus || false,
    is_premier_agent: data.isPremierAgent || data.professionalDetails?.premierAgentStatus || false,
    cpd_user_pronouns: data.cpdUserPronouns,
    in_canada: data.inCanada || false,
    
    // Profile content
    specialty: data.professional?.specialties || [],
    languages: data.professional?.languagesSpoken || profInfo?.languages || [],
    get_to_know_me: data.getToKnowMe,
    service_areas: profInfo?.areasServed || [],
    
    // Licenses
    agent_licenses: data.professionalDetails?.agentLicenses?.map(l => l.value) || profInfo?.licenses || [],
    
    // Rich data
    agent_sales_stats: data.agentSalesStats,
    professional_information: data.professionalInformation,
    reviews_data: data.reviewsData,
    ratings: data.ratings,
    past_sales: data.pastSales,
    team_display_information: data.teamDisplayInformation,
    profile_types: data.profileTypes,
    sidebar_video_url: data.sidebarVideoUrls?.[0]?.value,
    
    // Listings
    // Note: forSaleListings and forRentListings are stored in raw_scraper_data
    
    // Meta
    zillow_profile_url: profileUrl,
    zuid: data.encodedZuid,
    zillow_data_fetched_at: new Date().toISOString(),
    
    // Store full raw data for backup
    raw_scraper_data: {
      ...data,
      scrape_method: 'firecrawl-json',
      scraped_at: new Date().toISOString()
    }
  };
}

async function scrapeZillowAgentJson(profileUrl: string): Promise<{ data: FirecrawlAgentData; dbRecord: any }> {
  console.log(`[Firecrawl-JSON] Scraping: ${profileUrl}`);
  const startTime = Date.now();

  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  const response = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: profileUrl,
      formats: ['json'],
      jsonOptions: {
        schema: zillowAgentSchema,
        prompt: "Extract all agent profile data from this Zillow agent page. Include contact info, sales stats, reviews, team info, specialties, and all available data."
      },
      waitFor: 3000
    })
  });

  const duration = Date.now() - startTime;
  console.log(`[Firecrawl-JSON] Response in ${duration}ms`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(`Firecrawl scrape failed: ${result.error || 'Unknown error'}`);
  }

  // The JSON data is in result.data.json
  const agentData: FirecrawlAgentData = result.data?.json || result.data || {};
  
  console.log(`[Firecrawl-JSON] Extracted: ${agentData.fullName || agentData.name}, ${agentData.reviewsData?.totalReviews || 0} reviews, ${agentData.agentSalesStats?.countAllTime || 0} sales`);

  const dbRecord = mapToDatabase(agentData, profileUrl);

  return { data: agentData, dbRecord };
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl, agentId, updateDatabase, dryRun } = await req.json();

    if (!profileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'profileUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profileUrl.includes('zillow.com/profile/')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Zillow profile URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scrape the agent
    const { data: agentData, dbRecord } = await scrapeZillowAgentJson(profileUrl);

    // If dry run, just return the data without updating DB
    if (dryRun) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          dryRun: true,
          rawData: agentData,
          mappedToDb: dbRecord,
          meta: {
            scrapeMethod: 'firecrawl-json',
            creditUsed: 1
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optionally update database
    if (updateDatabase && agentId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from('professionals')
        .update({
          ...dbRecord,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId);

      if (updateError) {
        console.error('[Firecrawl-JSON] Database update error:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Database update failed: ${updateError.message}`,
            data: agentData
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[Firecrawl-JSON] Updated database for agent ${agentId}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: agentData,
        mappedToDb: dbRecord,
        meta: {
          scrapeMethod: 'firecrawl-json',
          creditUsed: 1,
          databaseUpdated: updateDatabase && agentId ? true : false
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Firecrawl-JSON] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
