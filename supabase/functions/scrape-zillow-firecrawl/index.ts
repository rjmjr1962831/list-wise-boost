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
  },
  required: ["name"]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zillow_url, professional_id, save_to_db } = await req.json();

    if (!zillow_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'zillow_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping Zillow profile:', zillow_url);

    // Use Firecrawl extract mode with JSON schema
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: zillow_url,
        formats: ['extract'],
        extract: {
          schema: ZILLOW_AGENT_SCHEMA
        },
        onlyMainContent: true,
        timeout: 30000,
      }),
    });

    const data = await response.json();
    console.log('Raw Firecrawl response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try multiple paths to find extracted data
    const agentData = data.data?.extract || data.extract || data.data?.json || data.json || data.data;
    console.log('Extracted agent data:', JSON.stringify(agentData, null, 2));

    // Optionally save to database
    if (save_to_db && professional_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

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

      const { error: updateError } = await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', professional_id);

      if (updateError) {
        console.error('Error updating professional:', updateError);
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: agentData, 
            saved: false, 
            save_error: updateError.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Successfully saved to database for professional:', professional_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: agentData,
        saved: save_to_db && professional_id ? true : false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-zillow-firecrawl:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
