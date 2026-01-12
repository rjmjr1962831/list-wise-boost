import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApifyRun {
  id: string;
  actId: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  defaultDatasetId: string;
}

// Complete memo23 data structure
interface Memo23Agent {
  url?: string;
  encodedZuid?: string;
  screenName?: string;
  inCanada?: boolean;
  name?: string;
  flag?: number;
  profileTypeIds?: number[];
  profileTypes?: string[];
  businessAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  businessName?: string;
  isTopAgent?: boolean;
  profileImageId?: string;
  profilePhotoSrc?: string;
  ratings?: {
    average?: number;
    count?: number;
  };
  phoneNumbers?: {
    cell?: string;
    office?: string;
  };
  email?: string;
  getToKnowMe?: {
    title?: string;
    description?: string;
    yearsInIndustry?: number;
    videoUrl?: string;
    specialties?: string[];
    languages?: string[];
    websiteUrl?: string;
    facebookUrl?: string;
    linkedInUrl?: string;
    xUrl?: string;
    instagramUrl?: string;
  };
  agentLicenses?: Array<{
    text?: string;
    state?: string;
    status?: string;
    original_status?: string;
    license_type?: string;
    expiration?: string;
  }>;
  agentSalesStats?: {
    countAllTime?: number;
    countLastYear?: number;
    priceRangeThreeYearMin?: number;
    priceRangeThreeYearMax?: number;
    averageValueThreeYear?: number;
    stats_include_team?: boolean;
  };
  forSaleListings?: {
    listings?: Array<{
      zpid?: number;
      home_type?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        stateOrProvince?: string;
        postalCode?: string;
      };
      bedrooms?: number;
      bathrooms?: number;
      price?: number;
      status?: string;
      latitude?: number;
      longitude?: number;
      brokerage_name?: string;
      listing_url?: string;
    }>;
    listing_count?: number;
  };
  forRentListings?: {
    listings?: unknown[];
    listing_count?: number;
  };
  pastSales?: {
    total?: number;
    past_sales?: Array<{
      represented?: string;
      representedList?: string[];
      sold_date?: string;
      price?: string;
      zpid?: number;
      image_url?: string;
      home_details_url?: string;
      street_address?: string;
      city_state_zipcode?: string;
      latitude?: number;
      longitude?: number;
      bathrooms?: number;
      bedrooms?: number;
      city?: string;
      state?: string;
      livingAreaValue?: number;
      livingAreaUnitsShort?: string;
    }>;
  };
  preferredLenders?: {
    lenders?: unknown[];
  };
  professionalInformation?: Array<{
    term?: string;
    description?: string;
    lines?: string[];
    links?: Array<{ text?: string; url?: string }>;
  }>;
  reviewsData?: {
    reviews?: Array<{
      reviewComment?: string;
      reviewId?: number;
      subRatings?: Array<{ description?: string; score?: number }>;
      reviewee?: {
        screenName?: string;
        firstName?: string;
        lastName?: string;
      };
      reviewer?: {
        screenName?: string;
        firstName?: string;
        lastName?: string;
      };
      rating?: number;
      createDate?: string;
      workDescription?: string;
    }>;
    filters?: Array<{
      prompt?: string;
      count?: number;
      serviceTypeIds?: number[];
    }>;
  };
  teamDisplayInformation?: {
    teamLeadInfo?: {
      teamName?: string;
      children?: Array<{
        name?: string;
        screenName?: string;
        ratings?: { count?: number; average?: number };
        profilePhotoUrl?: string;
        isTopAgent?: boolean;
        encodedZuid?: string;
      }>;
    };
    teamMemberInfo?: unknown;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN not configured");
    }

    const { action, runId, datasetId, actorId, limit = 10, offset = 0, dryRun = true } = await req.json();

    // Action 1: List ALL user's runs (can filter by actor)
    if (action === "list-runs") {
      // Use the APIFY_ACTOR_ID from secrets if available
      const actId = actorId || Deno.env.get("APIFY_ACTOR_ID");
      
      // First, try to list user's runs directly
      let runsUrl: string;
      if (actId) {
        // If actor ID provided, get runs for that specific actor
        runsUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actId)}/runs?token=${APIFY_API_TOKEN}&limit=${limit}&offset=${offset}&desc=true`;
      } else {
        // Otherwise list all user's runs
        runsUrl = `https://api.apify.com/v2/actor-runs?token=${APIFY_API_TOKEN}&limit=${limit}&offset=${offset}&desc=true`;
      }
      
      console.log(`Fetching runs from: ${runsUrl.replace(APIFY_API_TOKEN, "***")}`);
      const runsResponse = await fetch(runsUrl);
      
      if (!runsResponse.ok) {
        const errorText = await runsResponse.text();
        console.error("Apify runs API error:", errorText);
        
        // Fallback: try listing all user runs if actor-specific failed
        if (actId) {
          console.log("Trying fallback: listing all user runs...");
          const fallbackUrl = `https://api.apify.com/v2/actor-runs?token=${APIFY_API_TOKEN}&limit=${limit}&offset=${offset}&desc=true`;
          const fallbackResponse = await fetch(fallbackUrl);
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const runs = fallbackData.data?.items?.map((run: ApifyRun) => ({
              id: run.id,
              actId: run.actId,
              status: run.status,
              startedAt: run.startedAt,
              finishedAt: run.finishedAt,
              datasetId: run.defaultDatasetId,
            })) || [];
            return new Response(JSON.stringify({ 
              success: true, 
              note: "Listing all user runs (actor-specific lookup failed)",
              runs,
              total: fallbackData.data?.total || 0
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        
        throw new Error(`Failed to fetch runs: ${runsResponse.status} - ${errorText}`);
      }
      
      const runsData = await runsResponse.json();
      
      const runs = runsData.data?.items?.map((run: ApifyRun) => ({
        id: run.id,
        actId: run.actId,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        datasetId: run.defaultDatasetId,
      })) || [];

      return new Response(JSON.stringify({ 
        success: true, 
        runs,
        total: runsData.data?.total || 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: List user's datasets
    if (action === "list-datasets") {
      const datasetsUrl = `https://api.apify.com/v2/datasets?token=${APIFY_API_TOKEN}&limit=${limit}&offset=${offset}&desc=true`;
      console.log(`Fetching datasets...`);
      const datasetsResponse = await fetch(datasetsUrl);
      
      if (!datasetsResponse.ok) {
        const errorText = await datasetsResponse.text();
        throw new Error(`Failed to fetch datasets: ${datasetsResponse.status} - ${errorText}`);
      }
      
      const datasetsData = await datasetsResponse.json();
      
      return new Response(JSON.stringify({ 
        success: true, 
        datasets: datasetsData.data?.items || [],
        total: datasetsData.data?.total || 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 2: Fetch raw dataset items (preview)
    if (action === "fetch-dataset") {
      let targetDatasetId = datasetId;
      
      if (!targetDatasetId && runId) {
        const runUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`;
        const runResponse = await fetch(runUrl);
        const runData = await runResponse.json();
        targetDatasetId = runData.data?.defaultDatasetId;
      }
      
      if (!targetDatasetId) {
        throw new Error("datasetId or runId is required");
      }
      
      console.log(`Fetching dataset: ${targetDatasetId}`);
      
      const datasetUrl = `https://api.apify.com/v2/datasets/${targetDatasetId}/items?token=${APIFY_API_TOKEN}&limit=${limit}&offset=${offset}`;
      const datasetResponse = await fetch(datasetUrl);
      
      if (!datasetResponse.ok) {
        throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
      }
      
      const items: Memo23Agent[] = await datasetResponse.json();

      return new Response(JSON.stringify({ 
        success: true, 
        datasetId: targetDatasetId,
        itemCount: items.length,
        items: items // Return raw items for preview
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 3: Import ALL data from a run into professionals table
    if (action === "import-all") {
      let targetDatasetId = datasetId;
      
      if (!targetDatasetId && runId) {
        const runUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`;
        const runResponse = await fetch(runUrl);
        const runData = await runResponse.json();
        targetDatasetId = runData.data?.defaultDatasetId;
      }
      
      if (!targetDatasetId) {
        throw new Error("datasetId or runId is required for import-all");
      }

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      console.log(`Importing ALL data from dataset: ${targetDatasetId}`);
      
      // Fetch all dataset items with pagination
      let allItems: Memo23Agent[] = [];
      let currentOffset = 0;
      const pageSize = 1000;
      
      while (true) {
        const datasetUrl = `https://api.apify.com/v2/datasets/${targetDatasetId}/items?token=${APIFY_API_TOKEN}&limit=${pageSize}&offset=${currentOffset}`;
        const datasetResponse = await fetch(datasetUrl);
        const items: Memo23Agent[] = await datasetResponse.json();
        
        if (!items || items.length === 0) break;
        
        allItems = [...allItems, ...items];
        currentOffset += pageSize;
        console.log(`Fetched ${allItems.length} items so far...`);
        
        if (items.length < pageSize) break;
      }
      
      console.log(`Total items fetched: ${allItems.length}`);
      
      // Process and match to professionals
      let matched = 0;
      let notFound = 0;
      let updated = 0;
      let errors = 0;
      const matchedAgents: Array<{ id: string; name: string; zipsCount: number }> = [];
      const unmatchedAgents: string[] = [];
      
      for (const item of allItems) {
        // Extract all ZIP codes
        const allZips = new Set<string>();
        const salesByZip: Record<string, number> = {};
        const listingsByZip: Record<string, number> = {};
        
        // From pastSales
        if (item.pastSales?.past_sales) {
          for (const sale of item.pastSales.past_sales) {
            const zipMatch = sale.city_state_zipcode?.match(/\d{5}/);
            if (zipMatch) {
              const zip = zipMatch[0];
              allZips.add(zip);
              salesByZip[zip] = (salesByZip[zip] || 0) + 1;
            }
          }
        }
        
        // From forSaleListings
        if (item.forSaleListings?.listings) {
          for (const listing of item.forSaleListings.listings) {
            if (listing.address?.postalCode) {
              const zip = listing.address.postalCode;
              allZips.add(zip);
              listingsByZip[zip] = (listingsByZip[zip] || 0) + 1;
            }
          }
        }
        
        // Try to match by encoded_zuid first, then license_number
        let professional = null;
        
        if (item.encodedZuid) {
          const { data } = await supabase
            .from("professionals")
            .select("id, name, encoded_zuid")
            .eq("encoded_zuid", item.encodedZuid)
            .single();
          professional = data;
        }
        
        if (!professional && item.agentLicenses?.[0]?.text) {
          const { data } = await supabase
            .from("professionals")
            .select("id, name, license_number")
            .eq("license_number", item.agentLicenses[0].text)
            .single();
          professional = data;
        }
        
        if (professional) {
          matched++;
          matchedAgents.push({
            id: professional.id,
            name: professional.name,
            zipsCount: allZips.size
          });
          
          if (!dryRun) {
            // Build update object with ALL the data
            const updateData: Record<string, unknown> = {
              // Store complete raw data
              raw_scraper_data: {
                source: "memo23",
                fetched_at: new Date().toISOString(),
                run_id: runId,
                dataset_id: targetDatasetId,
                ...item
              },
              
              // Parsed structured fields
              encoded_zuid: item.encodedZuid,
              screen_name: item.screenName,
              in_canada: item.inCanada,
              is_top_agent: item.isTopAgent,
              profile_image_id: item.profileImageId,
              
              // Business info
              business_name: item.businessName,
              business_address: item.businessAddress,
              
              // Contact
              phone_numbers: item.phoneNumbers,
              email: item.email || undefined,
              
              // Ratings
              ratings: item.ratings,
              review_stars_rating: item.ratings?.average,
              num_total_reviews: item.ratings?.count,
              
              // Licenses
              agent_licenses: item.agentLicenses,
              license_number: item.agentLicenses?.[0]?.text,
              
              // Sales stats
              agent_sales_stats: item.agentSalesStats,
              total_sales: item.agentSalesStats?.countAllTime || item.pastSales?.total,
              current_listings: item.forSaleListings?.listing_count,
              
              // Past sales with full details
              past_sales: item.pastSales,
              
              // Profile info
              profile_types: item.profileTypes,
              profile_type_ids: item.profileTypeIds,
              professional_information: item.professionalInformation,
              
              // Bio and specialties from getToKnowMe
              get_to_know_me: item.getToKnowMe?.description,
              headline: item.getToKnowMe?.title,
              years_experience: item.getToKnowMe?.yearsInIndustry,
              specialty: item.getToKnowMe?.specialties,
              languages: item.getToKnowMe?.languages,
              website: item.getToKnowMe?.websiteUrl,
              social_facebook: item.getToKnowMe?.facebookUrl,
              social_linkedin: item.getToKnowMe?.linkedInUrl,
              social_twitter: item.getToKnowMe?.xUrl,
              social_instagram: item.getToKnowMe?.instagramUrl,
              
              // Reviews
              reviews_data: {
                zillow_reviews: item.reviewsData?.reviews,
                review_filters: item.reviewsData?.filters,
                fetched_at: new Date().toISOString()
              },
              
              // Team info
              team_display_information: item.teamDisplayInformation,
              
              // Image
              image_url: item.profilePhotoSrc,
              
              // Zillow profile URL
              zillow_profile_url: item.url,
              
              // Active ZIP analysis
              service_areas: {
                active_zips: Array.from(allZips),
                sales_by_zip: salesByZip,
                listings_by_zip: listingsByZip,
                total_unique_zips: allZips.size,
                analyzed_at: new Date().toISOString()
              },
              
              // Timestamp
              zillow_data_fetched_at: new Date().toISOString()
            };
            
            // Remove undefined values
            Object.keys(updateData).forEach(key => {
              if (updateData[key] === undefined) {
                delete updateData[key];
              }
            });
            
            const { error } = await supabase
              .from("professionals")
              .update(updateData)
              .eq("id", professional.id);
            
            if (error) {
              console.error(`Error updating ${professional.name}:`, error);
              errors++;
            } else {
              updated++;
            }
          }
        } else {
          notFound++;
          unmatchedAgents.push(item.name || item.screenName || "Unknown");
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        dryRun,
        summary: {
          totalInDataset: allItems.length,
          matched,
          notFound,
          updated: dryRun ? 0 : updated,
          errors: dryRun ? 0 : errors
        },
        matchedAgents: matchedAgents.slice(0, 50), // First 50
        unmatchedAgents: unmatchedAgents.slice(0, 50), // First 50
        message: dryRun 
          ? `DRY RUN: Would update ${matched} professionals. Set dryRun: false to apply.`
          : `Updated ${updated} professionals with full memo23 data.`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}. Use 'list-runs', 'fetch-dataset', or 'import-all'`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
