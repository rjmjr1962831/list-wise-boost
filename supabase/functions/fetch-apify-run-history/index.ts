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
  stats: {
    inputBodyLen: number;
    restartCount: number;
  };
}

interface ApifyDatasetItem {
  name?: string;
  screenName?: string;
  encodedZuid?: string;
  email?: string;
  phone?: string;
  phoneNumbers?: { cell?: string; office?: string };
  businessAddress?: { postalCode?: string; city?: string; state?: string };
  pastSales?: {
    total: number;
    past_sales: Array<{
      city_state_zipcode: string;
      city: string;
      state: string;
      street_address: string;
      price: string;
      sold_date: string;
      represented: string;
    }>;
  };
  forSaleListings?: {
    listings: Array<{
      address: {
        postalCode: string;
        city: string;
        stateOrProvince: string;
      };
    }>;
  };
  agentLicenses?: Array<{ text: string; state: string }>;
  ratings?: { average: number; count: number };
  agentSalesStats?: {
    countAllTime: number;
    countLastYear: number;
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

    const { action, runId, actorId, limit = 10, offset = 0 } = await req.json();

    // Action 1: List runs for an actor
    if (action === "list-runs") {
      const actId = actorId || "memo23~zillow-scraper"; // Default memo23 actor
      console.log(`Fetching runs for actor: ${actId}`);
      
      const runsUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actId)}/runs?token=${APIFY_API_TOKEN}&limit=${limit}&offset=${offset}&desc=true`;
      const runsResponse = await fetch(runsUrl);
      
      if (!runsResponse.ok) {
        const errorText = await runsResponse.text();
        console.error("Apify runs API error:", errorText);
        throw new Error(`Failed to fetch runs: ${runsResponse.status}`);
      }
      
      const runsData = await runsResponse.json();
      
      // Return run summaries
      const runs = runsData.data?.items?.map((run: ApifyRun) => ({
        id: run.id,
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

    // Action 2: Fetch dataset from a specific run
    if (action === "fetch-dataset") {
      if (!runId) {
        throw new Error("runId is required for fetch-dataset action");
      }
      
      console.log(`Fetching dataset for run: ${runId}`);
      
      // First get the run details to find the dataset ID
      const runUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`;
      const runResponse = await fetch(runUrl);
      
      if (!runResponse.ok) {
        throw new Error(`Failed to fetch run details: ${runResponse.status}`);
      }
      
      const runData = await runResponse.json();
      const datasetId = runData.data?.defaultDatasetId;
      
      if (!datasetId) {
        throw new Error("No dataset found for this run");
      }
      
      // Fetch dataset items
      const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=${limit}&offset=${offset}`;
      const datasetResponse = await fetch(datasetUrl);
      
      if (!datasetResponse.ok) {
        throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
      }
      
      const items: ApifyDatasetItem[] = await datasetResponse.json();
      
      // Extract ZIP codes from each agent
      const processedAgents = items.map((item) => {
        const zipsFromSales = new Set<string>();
        const zipsFromListings = new Set<string>();
        
        // Extract from pastSales
        if (item.pastSales?.past_sales) {
          for (const sale of item.pastSales.past_sales) {
            const zipMatch = sale.city_state_zipcode?.match(/\d{5}/);
            if (zipMatch) {
              zipsFromSales.add(zipMatch[0]);
            }
          }
        }
        
        // Extract from forSaleListings
        if (item.forSaleListings?.listings) {
          for (const listing of item.forSaleListings.listings) {
            if (listing.address?.postalCode) {
              zipsFromListings.add(listing.address.postalCode);
            }
          }
        }
        
        return {
          name: item.name || item.screenName,
          screenName: item.screenName,
          encodedZuid: item.encodedZuid,
          email: item.email,
          phone: item.phoneNumbers?.cell || item.phoneNumbers?.office,
          businessZip: item.businessAddress?.postalCode,
          licenseNumber: item.agentLicenses?.[0]?.text,
          rating: item.ratings?.average,
          reviewCount: item.ratings?.count,
          totalSales: item.agentSalesStats?.countAllTime || item.pastSales?.total || 0,
          salesLastYear: item.agentSalesStats?.countLastYear,
          activeZips: {
            fromSales: Array.from(zipsFromSales),
            fromListings: Array.from(zipsFromListings),
            combined: Array.from(new Set([...zipsFromSales, ...zipsFromListings]))
          },
          salesCount: item.pastSales?.past_sales?.length || 0,
          listingsCount: item.forSaleListings?.listings?.length || 0,
        };
      });

      return new Response(JSON.stringify({ 
        success: true, 
        datasetId,
        itemCount: items.length,
        agents: processedAgents
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 3: Get full dataset and match to professionals
    if (action === "import-zips") {
      if (!runId) {
        throw new Error("runId is required for import-zips action");
      }

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      console.log(`Importing ZIPs from run: ${runId}`);
      
      // Get run's dataset ID
      const runUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`;
      const runResponse = await fetch(runUrl);
      const runData = await runResponse.json();
      const datasetId = runData.data?.defaultDatasetId;
      
      if (!datasetId) {
        throw new Error("No dataset found for this run");
      }
      
      // Fetch all dataset items (paginate if needed)
      let allItems: ApifyDatasetItem[] = [];
      let currentOffset = 0;
      const pageSize = 1000;
      
      while (true) {
        const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=${pageSize}&offset=${currentOffset}`;
        const datasetResponse = await fetch(datasetUrl);
        const items: ApifyDatasetItem[] = await datasetResponse.json();
        
        if (!items || items.length === 0) break;
        
        allItems = [...allItems, ...items];
        currentOffset += pageSize;
        
        if (items.length < pageSize) break; // Last page
      }
      
      console.log(`Fetched ${allItems.length} agents from Apify dataset`);
      
      // Match and update professionals
      let matched = 0;
      let notFound = 0;
      const updates: Array<{ id: string; name: string; zips: string[] }> = [];
      
      for (const item of allItems) {
        // Extract ZIPs
        const allZips = new Set<string>();
        
        if (item.pastSales?.past_sales) {
          for (const sale of item.pastSales.past_sales) {
            const zipMatch = sale.city_state_zipcode?.match(/\d{5}/);
            if (zipMatch) allZips.add(zipMatch[0]);
          }
        }
        
        if (item.forSaleListings?.listings) {
          for (const listing of item.forSaleListings.listings) {
            if (listing.address?.postalCode) {
              allZips.add(listing.address.postalCode);
            }
          }
        }
        
        if (allZips.size === 0) continue;
        
        // Try to match by encoded_zuid or license_number or name
        let professional = null;
        
        if (item.encodedZuid) {
          const { data } = await supabase
            .from("professionals")
            .select("id, name")
            .eq("encoded_zuid", item.encodedZuid)
            .single();
          professional = data;
        }
        
        if (!professional && item.agentLicenses?.[0]?.text) {
          const { data } = await supabase
            .from("professionals")
            .select("id, name")
            .eq("license_number", item.agentLicenses[0].text)
            .single();
          professional = data;
        }
        
        if (professional) {
          matched++;
          updates.push({
            id: professional.id,
            name: professional.name,
            zips: Array.from(allZips)
          });
        } else {
          notFound++;
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        totalInDataset: allItems.length,
        matched,
        notFound,
        updates: updates.slice(0, 20), // Preview first 20
        message: `Found ${matched} matching professionals. Use action 'apply-zips' to update.`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}. Use 'list-runs', 'fetch-dataset', or 'import-zips'`);

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
