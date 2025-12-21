import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Zillow Agent Profile Schema for Firecrawl JSON extraction
const ZILLOW_AGENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    profileUrl: { type: "string" },
    photoUrl: { type: "string" },
    zillowRating: { type: "number" },
    reviewCount: { type: "number" },
    totalSales: { type: "number" },
    salesLast12Months: { type: "number" },
    currentListings: { type: "number" },
    listingsForSale: { type: "number" },
    yearsExperience: { type: "number" },
    licenseNumber: { type: "string" },
    licenseState: { type: "string" },
    brokerageName: { type: "string" },
    brokerageAddress: { type: "string" },
    brokeragePhone: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    website: { type: "string" },
    serviceAreas: { type: "array", items: { type: "string" } },
    primaryCity: { type: "string" },
    primaryState: { type: "string" },
    specialties: { type: "array", items: { type: "string" } },
    avgListPrice: { type: "string" },
    avgSalePrice: { type: "string" },
    priceRange: { type: "string" },
    bio: { type: "string" },
    headline: { type: "string" },
  },
  required: ["name"]
};

// Process a single agent with Firecrawl
async function enrichAgentWithFirecrawl(
  supabase: any,
  professional: any,
  apiKey: string,
  delayMs: number = 2000
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const profileUrl = professional.zillow_profile_url;
    if (!profileUrl) {
      return { success: false, error: 'No Zillow profile URL' };
    }

    console.log(`🔥 [Firecrawl] Scraping ${professional.name}: ${profileUrl}`);

    // Call Firecrawl API
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: profileUrl,
        formats: ['extract', 'markdown'],
        extract: {
          schema: ZILLOW_AGENT_SCHEMA
        },
        onlyMainContent: true,
        timeout: 30000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Firecrawl API error for ${professional.name}:`, data);
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    // Extract agent data from response
    const agentData = data.data?.extract || data.extract || data.data?.json || data.json || data.data;
    const markdown = data.data?.markdown || data.markdown;

    if (!agentData) {
      console.warn(`⚠️ No extract data for ${professional.name}`);
      return { success: false, error: 'No extract data returned' };
    }

    console.log(`✅ [Firecrawl] Extracted data for ${professional.name}`);

    // Map Firecrawl data to professionals table fields
    const updateData: Record<string, any> = {
      zillow_data_fetched_at: new Date().toISOString(),
    };

    if (agentData.zillowRating) updateData.review_stars_rating = agentData.zillowRating;
    if (agentData.reviewCount) updateData.num_total_reviews = agentData.reviewCount;
    if (agentData.totalSales) updateData.total_sales = agentData.totalSales;
    if (agentData.currentListings) updateData.current_listings = agentData.currentListings;
    if (agentData.yearsExperience) updateData.years_experience = agentData.yearsExperience;
    if (agentData.licenseNumber) updateData.license_number = agentData.licenseNumber;
    if (agentData.brokerageName) updateData.company = agentData.brokerageName;
    if (agentData.phone) updateData.phone = agentData.phone;
    if (agentData.email) updateData.email = agentData.email;
    if (agentData.website) updateData.website = agentData.website;
    if (agentData.photoUrl) updateData.image_url = agentData.photoUrl;
    if (agentData.specialties) updateData.specialty = agentData.specialties;
    if (agentData.serviceAreas) updateData.service_areas = agentData.serviceAreas;
    if (agentData.bio) updateData.description = agentData.bio;
    if (agentData.headline) updateData.headline = agentData.headline;

    // Store full Firecrawl response in agent_sales_stats
    updateData.agent_sales_stats = {
      source: 'firecrawl',
      fetchedAt: new Date().toISOString(),
      countAllTime: agentData.totalSales,
      countLast12Months: agentData.salesLast12Months,
      currentListings: agentData.currentListings,
      avgListPrice: agentData.avgListPrice,
      avgSalePrice: agentData.avgSalePrice,
      priceRange: agentData.priceRange,
    };

    // Store brokerage info in business_address
    if (agentData.brokerageName || agentData.brokerageAddress) {
      updateData.business_address = {
        name: agentData.brokerageName,
        address: agentData.brokerageAddress,
        phone: agentData.brokeragePhone,
      };
    }

    // Store raw markdown in professional_information for reference
    if (markdown) {
      updateData.professional_information = {
        source: 'firecrawl',
        markdown: markdown,
        extractedAt: new Date().toISOString(),
      };
    }

    // Update the professional record
    const { error: updateError } = await supabase
      .from('professionals')
      .update(updateData)
      .eq('id', professional.id);

    if (updateError) {
      console.error(`❌ DB update error for ${professional.name}:`, updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`💾 [Firecrawl] Saved data for ${professional.name}`);

    // Delay between requests to avoid rate limits
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return { success: true, data: agentData };

  } catch (error: any) {
    console.error(`❌ [Firecrawl] Error for ${professional.name}:`, error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      citySlug,
      cityId,
      limit = 50,
      concurrency = 3,
      delayMs = 2000,
      onlyActive = true,
      onlyMissingData = true,
      minRating = 4.9,
    } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query for professionals to enrich
    let query = supabase
      .from('professionals')
      .select('id, name, zillow_profile_url, zillow_data_fetched_at, review_stars_rating, num_total_reviews, city_id')
      .not('zillow_profile_url', 'is', null);

    // Filter by city
    if (cityId) {
      query = query.eq('city_id', cityId);
    } else if (citySlug) {
      const { data: city } = await supabase
        .from('cities')
        .select('id')
        .eq('slug', citySlug)
        .single();
      
      if (city) {
        query = query.eq('city_id', city.id);
      }
    }

    // Filter active only
    if (onlyActive) {
      query = query.eq('active', true);
    }

    // Filter by rating
    if (minRating) {
      query = query.gte('review_stars_rating', minRating);
    }

    // Filter missing data (not enriched in last 15 days)
    if (onlyMissingData) {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`zillow_data_fetched_at.is.null,zillow_data_fetched_at.lt.${fifteenDaysAgo}`);
    }

    query = query.limit(limit);

    const { data: professionals, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    if (!professionals || professionals.length === 0) {
      console.log('✅ No professionals to enrich');
      return new Response(
        JSON.stringify({ success: true, message: 'No professionals to enrich', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔥 [Firecrawl] Starting batch enrichment for ${professionals.length} agents`);
    console.log(`⚙️ Settings: concurrency=${concurrency}, delay=${delayMs}ms, minRating=${minRating}`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      agents: [] as any[]
    };

    // Process in batches for concurrency control
    const totalBatches = Math.ceil(professionals.length / concurrency);

    for (let i = 0; i < totalBatches; i++) {
      const batchStart = i * concurrency;
      const batchEnd = Math.min((i + 1) * concurrency, professionals.length);
      const batch = professionals.slice(batchStart, batchEnd);

      console.log(`📦 Batch ${i + 1}/${totalBatches}: Processing ${batch.length} agents`);

      // Process batch concurrently
      const batchPromises = batch.map(professional =>
        enrichAgentWithFirecrawl(supabase, professional, firecrawlApiKey, delayMs)
          .then(result => ({ professional, result }))
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      for (const settledResult of batchResults) {
        results.processed++;
        
        if (settledResult.status === 'fulfilled') {
          const { professional, result } = settledResult.value;
          if (result.success) {
            results.succeeded++;
            results.agents.push({ name: professional.name, status: 'success' });
          } else {
            results.failed++;
            results.agents.push({ name: professional.name, status: 'failed', error: result.error });
          }
        } else {
          results.failed++;
          results.agents.push({ name: 'Unknown', status: 'failed', error: settledResult.reason });
        }
      }

      console.log(`✅ Batch ${i + 1}/${totalBatches} complete`);

      // Wait between batches
      if (i < totalBatches - 1) {
        console.log(`⏸️ Waiting 3s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`📊 Enrichment complete: ${results.succeeded}/${results.processed} succeeded`);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ fetch-firecrawl-agents error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
