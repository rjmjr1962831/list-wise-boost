import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, city, state } = await req.json();

    if (!email || !firstName || !lastName || !city || !state) {
      throw new Error('email, firstName, lastName, city, and state are required');
    }

    console.log(`Searching for agent: ${firstName} ${lastName} in ${city}, ${state}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Step 1: Search using agenscrape
    const agenscrapeActorId = 'getdataforme~agenscrape';
    const searchQuery = `${firstName} ${lastName} ${city} ${state} real estate agent zillow`;

    console.log(`Searching with agenscrape: ${searchQuery}`);

    const searchInput = {
      query: searchQuery,
      maxResults: 5
    };

    const searchResponse = await fetch(
      `https://api.apify.com/v2/acts/${agenscrapeActorId}/runs?token=${apifyToken}&waitForFinish=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchInput)
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`agenscrape failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const searchDatasetId = searchData.data.defaultDatasetId;

    const resultsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${searchDatasetId}/items?token=${apifyToken}`
    );

    if (!resultsResponse.ok) {
      throw new Error('Failed to get search results');
    }

    const results = await resultsResponse.json();

    if (!results || results.length === 0) {
      throw new Error(`No agent profile found for ${firstName} ${lastName} in ${city}, ${state}`);
    }

    // Find best match
    const fullNameLower = `${firstName} ${lastName}`.toLowerCase();
    const bestMatch = results.find((r: any) => 
      r.name && r.name.toLowerCase().includes(fullNameLower)
    ) || results[0];

    const profileUrl = bestMatch.url;
    console.log(`Found profile: ${bestMatch.name} - ${profileUrl}`);

    // Step 2: Fetch detailed data with memo23
    const memo23ActorId = 'memo23~apify-zillow-agents-cheerio';

    const memo23Input = {
      startUrls: [{ url: profileUrl }],
      maxConcurrency: 1,
      proxyConfiguration: { 
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };

    console.log('Fetching detailed data with memo23...');

    const memo23Response = await fetch(
      `https://api.apify.com/v2/acts/${memo23ActorId}/runs?token=${apifyToken}&waitForFinish=180`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memo23Input)
      }
    );

    if (!memo23Response.ok) {
      throw new Error(`memo23 failed: ${memo23Response.status}`);
    }

    const memo23Data = await memo23Response.json();
    const agentDatasetId = memo23Data.data.defaultDatasetId;

    const agentDataResponse = await fetch(
      `https://api.apify.com/v2/datasets/${agentDatasetId}/items?token=${apifyToken}`
    );

    if (!agentDataResponse.ok) {
      throw new Error('Failed to get agent data');
    }

    const agentDataResults = await agentDataResponse.json();

    if (!agentDataResults || agentDataResults.length === 0) {
      throw new Error('No data returned from memo23');
    }

    const agent = agentDataResults[0];
    console.log(`Retrieved data for: ${agent.name}`);

    // Step 3: Get or create city/category
    let { data: cityData } = await supabase
      .from('cities')
      .select('id')
      .ilike('name', city)
      .ilike('state', state)
      .maybeSingle();

    let cityId = cityData?.id;

    if (!cityId) {
      const citySlug = city.toLowerCase().replace(/\s+/g, '-');
      const stateSlug = state.toLowerCase().replace(/\s+/g, '-');
      
      const { data: newCity, error: createCityError } = await supabase
        .from('cities')
        .insert({
          name: city,
          state: state,
          slug: citySlug,
          state_slug: stateSlug,
          active: true
        })
        .select('id')
        .single();

      if (createCityError) throw new Error(`Failed to create city: ${createCityError.message}`);
      cityId = newCity.id;
      console.log(`Created city: ${city}, ${state}`);
    }

    let { data: categoryData } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .maybeSingle();

    let categoryId = categoryData?.id;

    if (!categoryId) {
      const { data: newCategory, error: createCategoryError } = await supabase
        .from('categories')
        .insert({
          name: 'Real Estate Agent',
          plural_name: 'Real Estate Agents',
          slug: 'top10realestateagents',
          active: true
        })
        .select('id')
        .single();

      if (createCategoryError) throw new Error(`Failed to create category: ${createCategoryError.message}`);
      categoryId = newCategory.id;
    }

    // Step 4: Create professional record
    const professionalData: any = {
      name: agent.name || `${firstName} ${lastName}`,
      screen_name: agent.screenName,
      encoded_zuid: agent.encodedZuid,
      zuid: agent.encodedZuid,
      business_name: agent.businessName,
      company: agent.businessName,
      image_url: agent.profilePhotoSrc,
      ratings: agent.ratings,
      phone_numbers: agent.phoneNumbers,
      get_to_know_me: typeof agent.getToKnowMe === 'string' ? agent.getToKnowMe : agent.getToKnowMe?.description,
      agent_licenses: agent.agentLicenses,
      agent_sales_stats: agent.agentSalesStats,
      professional_information: agent.professionalInformation,
      raw_scraper_data: agent,
      zillow_profile_url: profileUrl,
      zillow_data_fetched_at: new Date().toISOString(),
      city_id: cityId,
      category_id: categoryId,
      email: email.toLowerCase(),
      active: true,
      type: 'established',
      rank: 999,
    };

    // Extract address
    if (agent.businessAddress) {
      professionalData.business_address = agent.businessAddress;
      if (agent.businessAddress.postalCode) {
        professionalData.zip_code = agent.businessAddress.postalCode;
      }
      const addrParts = [
        agent.businessAddress.address1,
        agent.businessAddress.city,
        agent.businessAddress.state,
        agent.businessAddress.postalCode
      ].filter(Boolean);
      if (addrParts.length > 0) {
        professionalData.address = addrParts.join(', ');
      }
    }

    // Extract phone
    if (agent.phoneNumbers && agent.phoneNumbers.length > 0) {
      const primaryPhone = agent.phoneNumbers.find((p: any) => p.primary) || agent.phoneNumbers[0];
      if (primaryPhone?.formattedPhoneNumber) {
        professionalData.phone = primaryPhone.formattedPhoneNumber;
      }
    }

    // Extract website
    if (agent.professionalInformation && Array.isArray(agent.professionalInformation)) {
      const websitesEntry = agent.professionalInformation.find((info: any) => info.term === 'Websites');
      if (websitesEntry?.links && Array.isArray(websitesEntry.links)) {
        const primaryWebsite = websitesEntry.links[0];
        if (primaryWebsite?.url) {
          professionalData.website = primaryWebsite.url;
        }
      }
    }

    // Extract license
    if (agent.agentLicenses && Array.isArray(agent.agentLicenses) && agent.agentLicenses.length > 0) {
      const license = agent.agentLicenses[0];
      if (typeof license === 'string') {
        professionalData.license_number = license;
      } else if (typeof license === 'object') {
        professionalData.license_number = license.text || license.licenseNumber || null;
      }
    }

    // Extract ratings
    if (agent.ratings) {
      if (agent.ratings.starRating !== undefined) {
        professionalData.review_stars_rating = agent.ratings.starRating;
      }
      if (agent.ratings.numReviews !== undefined) {
        professionalData.num_total_reviews = agent.ratings.numReviews;
      }
    }

    // Check if exists
    const { data: existing } = await supabase
      .from('professionals')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from('professionals')
        .update(professionalData)
        .eq('id', existing.id);

      if (updateError) throw new Error(`Update failed: ${updateError.message}`);
      console.log(`Updated: ${agent.name}`);
    } else {
      const { error: insertError } = await supabase
        .from('professionals')
        .insert(professionalData);

      if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
      console.log(`Created: ${agent.name}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        agent: {
          name: agent.name,
          email: email,
          profileUrl: profileUrl
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
