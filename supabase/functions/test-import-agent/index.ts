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
    videoUrl: { type: "string" },
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
    recentReviews: { type: "array", items: { type: "object", properties: { text: { type: "string" }, rating: { type: "number" }, date: { type: "string" } } } },
  },
  required: ["name"]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, city, state, zillowUrl } = await req.json();

    if (!name && !zillowUrl) {
      throw new Error('Either name or zillowUrl is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY not configured');
    }

    let profileUrl = zillowUrl;
    
    // Step 1: Search for Zillow profile if not provided
    if (!profileUrl && name) {
      console.log(`🔍 Searching for: ${name} ${city || ''} ${state || ''}`);
      
      const searchQuery = `${name} Zillow real estate agent ${city || ''} ${state || ''}`;
      
      const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
        }),
      });

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${await searchResponse.text()}`);
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.success || !searchData.data?.length) {
        throw new Error('No search results found');
      }

      // Find Zillow profile URL
      for (const result of searchData.data) {
        const url = result.url || result.sourceUrl;
        if (url && url.includes('zillow.com/profile/')) {
          profileUrl = url;
          break;
        }
      }

      if (!profileUrl) {
        throw new Error('No Zillow profile found in search results');
      }
    }

    console.log(`📍 Zillow URL: ${profileUrl}`);

    // Step 2: Scrape the Zillow profile
    console.log(`📥 Scraping profile...`);
    
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
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

    if (!scrapeResponse.ok) {
      throw new Error(`Scrape failed: ${await scrapeResponse.text()}`);
    }

    const scrapeData = await scrapeResponse.json();
    const extractedData = scrapeData.data?.extract || scrapeData.extract || scrapeData.data || {};
    const markdown = scrapeData.data?.markdown || '';

    console.log(`✅ Scraped: ${extractedData.name}`);
    console.log(`   Rating: ${extractedData.zillowRating || 'NA'}, Reviews: ${extractedData.reviewCount || 'NA'}`);
    console.log(`   Email: ${extractedData.email || 'NA'}, Phone: ${extractedData.phone || 'NA'}`);

    const rating = extractedData.zillowRating || 0;
    const reviewCount = extractedData.reviewCount || 0;

    // Step 3: Check qualification
    const isQualified = rating >= 4.5 && reviewCount >= 50;
    console.log(`📊 Qualification: ${isQualified ? '✅ QUALIFIED' : '❌ NOT QUALIFIED'} (${rating}★, ${reviewCount} reviews)`);

    // Step 4: Get or create city
    const agentCity = extractedData.primaryCity || city || 'Unknown';
    const agentState = extractedData.primaryState || state || 'Unknown';

    let { data: cityData } = await supabase
      .from('cities')
      .select('id')
      .ilike('name', agentCity)
      .ilike('state', agentState)
      .maybeSingle();

    let cityId = cityData?.id;

    if (!cityId) {
      const citySlug = agentCity.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const stateSlug = agentState.toLowerCase().replace(/\s+/g, '-');
      
      const { data: newCity } = await supabase
        .from('cities')
        .insert({
          name: agentCity,
          state: agentState,
          slug: citySlug,
          state_slug: stateSlug,
          active: true
        })
        .select('id')
        .single();

      cityId = newCity?.id;
      console.log(`📍 Created city: ${agentCity}, ${agentState}`);
    }

    // Step 5: Get category
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    const categoryId = categoryData?.id;
    if (!categoryId) throw new Error('Category not found');

    // Step 6: Check for duplicates
    const { data: existingByUrl } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('zillow_profile_url', profileUrl)
      .maybeSingle();

    if (existingByUrl) {
      console.log(`⚠️ Duplicate found: ${existingByUrl.name}`);
      return new Response(JSON.stringify({
        success: true,
        status: 'duplicate',
        existingId: existingByUrl.id,
        existingName: existingByUrl.name,
        data: extractedData
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 7: Insert professional
    const agentType = isQualified ? 
      (extractedData.yearsExperience && extractedData.yearsExperience >= 10 ? 'established' : 'emerging') : 
      'individual';

    const insertData: Record<string, any> = {
      name: extractedData.name || name,
      city_id: cityId,
      category_id: categoryId,
      type: agentType,
      rank: 999,
      active: isQualified,
      zillow_profile_url: profileUrl,
      review_stars_rating: rating,
      num_total_reviews: reviewCount,
      zillow_data_fetched_at: new Date().toISOString(),
    };

    // Map all extracted data
    if (extractedData.phone) insertData.phone = extractedData.phone;
    if (extractedData.email) insertData.email = extractedData.email;
    if (extractedData.website) insertData.website = extractedData.website;
    if (extractedData.photoUrl) insertData.image_url = extractedData.photoUrl;
    if (extractedData.videoUrl) insertData.sidebar_video_url = extractedData.videoUrl;
    if (extractedData.bio) insertData.description = extractedData.bio;
    if (extractedData.headline) insertData.headline = extractedData.headline;
    if (extractedData.yearsExperience) insertData.years_experience = extractedData.yearsExperience;
    if (extractedData.totalSales) insertData.total_sales = extractedData.totalSales;
    if (extractedData.currentListings) insertData.current_listings = extractedData.currentListings;
    if (extractedData.brokerageName) insertData.company = extractedData.brokerageName;
    if (extractedData.specialties) insertData.specialty = extractedData.specialties;
    if (extractedData.serviceAreas) insertData.service_areas = extractedData.serviceAreas;

    insertData.agent_sales_stats = {
      source: 'firecrawl',
      fetchedAt: new Date().toISOString(),
      countAllTime: extractedData.totalSales,
      countLast12Months: extractedData.salesLast12Months,
      currentListings: extractedData.currentListings,
      avgListPrice: extractedData.avgListPrice,
      avgSalePrice: extractedData.avgSalePrice,
      priceRange: extractedData.priceRange,
    };

    if (extractedData.brokerageName || extractedData.brokerageAddress) {
      insertData.business_address = {
        name: extractedData.brokerageName,
        address: extractedData.brokerageAddress,
        phone: extractedData.brokeragePhone,
      };
    }

    insertData.professional_information = {
      source: 'firecrawl',
      markdown: markdown.slice(0, 5000),
      extractedAt: new Date().toISOString(),
      recentReviews: extractedData.recentReviews,
    };

    const { data: professional, error: insertError } = await supabase
      .from('professionals')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }

    console.log(`✅ Inserted professional: ${professional.id}`);

    // Step 8: Trigger synthesis for qualified agents
    if (isQualified) {
      console.log(`🧠 Triggering web search and synthesis...`);
      
      const { error: synthesisError } = await supabase.functions.invoke('search-agent-press-claude', {
        body: { 
          professionalId: professional.id, 
          skipSynthesis: false, 
          skipIfNoPress: false 
        }
      });

      if (synthesisError) {
        console.error(`⚠️ Synthesis error (non-blocking):`, synthesisError);
      } else {
        console.log(`✅ Synthesis triggered`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      status: isQualified ? 'qualified' : 'not_qualified',
      professionalId: professional.id,
      data: {
        name: extractedData.name,
        rating,
        reviewCount,
        email: extractedData.email,
        phone: extractedData.phone,
        city: agentCity,
        state: agentState,
        type: agentType,
        synthesisTriggered: isQualified
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
