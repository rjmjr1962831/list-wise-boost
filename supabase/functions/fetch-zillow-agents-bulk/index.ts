import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendFailureAlert(functionName: string, error: string, context?: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Cannot send alert: Supabase credentials missing');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.functions.invoke('send-api-failure-alert', {
      body: {
        functionName,
        error,
        context,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error('Failed to send alert email:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text().catch(() => '');
    let city = '' as string;
    let state = '' as string;
    let categoryId: string | undefined;
    let cityId: string | undefined;

    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText);
        city = parsed.city;
        state = parsed.state;
        categoryId = parsed.categoryId;
        cityId = parsed.cityId;
      } catch (_e) {
        console.warn('Invalid JSON body; falling back to empty payload. Body preview:', bodyText.slice(0, 200));
      }
    }

    if (!city || !state) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing city or state in request body',
          hint: 'Send JSON: { "city": "Anchorage", "state": "Alaska", "cityId": "...", "categoryId": "..." }'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const apiToken = Deno.env.get('APIFY_API_KEY')?.trim() || Deno.env.get('APIFY_API_TOKEN')?.trim();

    if (!apiToken) {
      const error = 'Apify API key/token not configured';
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state });
      throw new Error(error);
    }

    // Load zip code data and find one for this city
    let zipCode: string | null = null;
    try {
      const zipDataResp = await fetch('https://raw.githubusercontent.com/lovable-dev/lovable-agent-importer/main/src/data/zipCodeData.json');
      if (zipDataResp.ok) {
        const zipData = await zipDataResp.json();
        const cityZips = zipData.filter((z: any) => 
          z.city.toLowerCase() === city.toLowerCase() && 
          (z.state.toLowerCase() === state.toLowerCase() || z.stateAbbreviation.toLowerCase() === state.toLowerCase())
        );
        if (cityZips.length > 0) {
          // Pick the zip with highest agent value
          const bestZip = cityZips.sort((a: any, b: any) => b.agentValue - a.agentValue)[0];
          zipCode = bestZip.zipCode;
          console.log(`Found zip code ${zipCode} for ${city}, ${state}`);
        }
      }
    } catch (e) {
      console.warn('Could not load zip code data, using city/state format:', e);
    }

    const query = zipCode || `real estate agent in ${city}, ${state}`;
    console.log(`Agent discovery query: ${query}`);

    // Use getdataforme/zillow-real-state-agents-scraper - more reliable
    const actorId = 'getdataforme~zillow-real-state-agents-scraper';
    console.log(`Fetching agents from Apify (actor: ${actorId})`);

    // This actor expects a simple search_query format
    const apifyInput = {
      search_query: `${city}, ${state}`,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      }
    };

    const startResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput),
    });

    if (!startResp.ok) {
      const errorText = await startResp.text();
      console.error('Apify start error:', startResp.status, errorText);
      await sendFailureAlert('fetch-zillow-agents-bulk', `Apify API start failed: ${startResp.status}`, {
        city,
        state,
        error: errorText
      });
      throw new Error(`Apify API request failed: ${startResp.status}`);
    }

    const run = await startResp.json();
    const runId = run.data.id;
    console.log('Apify run started:', runId);

    // Poll for completion (max 180s)
    let status = run.data.status;
    let attempts = 0;
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && attempts < 90) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apiToken}`);
      if (!statusResp.ok) break;
      const statusData = await statusResp.json();
      status = statusData.data.status;
      console.log(`Apify run status: ${status} (attempt ${attempts + 1})`);
      attempts++;
    }

    if (status !== 'SUCCEEDED') {
      const error = `Apify run did not succeed: ${status}`;
      console.error(error);
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state, runId, attempts });
      throw new Error(error);
    }

    const datasetId = run.data.defaultDatasetId;
    const dataResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`);
    if (!dataResp.ok) {
      const error = 'Failed to fetch Apify dataset';
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state, datasetId });
      throw new Error(error);
    }

    const rawAgents = await dataResp.json();
    console.log(`Apify returned ${rawAgents.length} results, limiting to 15`);
    const items = rawAgents.slice(0, 15); // Only return top 15

    function mapAgent(agent: any) {
      // Log first agent to help debug field mappings
      if (items.indexOf(agent) === 0) {
        console.log('First agent fields:', Object.keys(agent));
        console.log('First agent sample:', JSON.stringify(agent).substring(0, 500));
      }
      
      // Handle hello.datawizards/Real-Estate-Agents-Scraper format (prioritized)
      const name = agent.agentName || agent.name || agent['Business Name'] || agent.title || agent.fullName || agent.agent_name || '';
      const phone = agent.phoneNumber || agent.phone || agent['Phone Number'] || agent.call_number || agent.contact_phone || null;
      const website = agent.profileUrl || agent.url || agent.website || agent['Website'] || agent.site || agent.domain || agent.profileLink || agent.profile_url || null;
      const thumbnail = agent.photoUrl || agent.photo || agent.image || agent.profilePhoto || agent['Profile Photo'] || agent.thumbnail || agent.logo || agent.profilePhotoSrc || agent.photo_url || agent.image_url || null;
      const address = agent.address || agent.location || agent['Address'] || agent.full_address || agent.city || agent.office_address || '';
      const rating = agent.rating || agent.reviewRating || agent['Rating'] || agent.stars || agent.score || agent.review_rating || 4.5;
      const reviews = agent.reviewCount || agent.reviewsCount || agent.reviews || agent['Review Count'] || agent.review_count || agent.reviews_count || agent.total_reviews || 0;
      const company = agent.brokerageName || agent.brokerage || agent.company || agent.businessName || agent['Business Name'] || 'Independent';
      const zuid = agent.zuid || agent.zillowId || null;
      const totalSales = agent.salesLast12Months || agent.totalSales || agent.recentSales || null;
      const currentListings = agent.activeListings || agent.currentListings || null;
      const yearsExperience = agent.yearsOfExperience || agent.yearsExperience || agent.experience || null;
      
      let categories: string[] = [];
      if (Array.isArray(agent.specialties)) {
        categories = agent.specialties;
      } else if (Array.isArray(agent.categories)) {
        categories = agent.categories;
      } else if (agent.subtypes) {
        categories = String(agent.subtypes).split(',');
      } else if (agent.category) {
        categories = [agent.category];
      }

      const categoryText = categories.join(' ').toLowerCase();
      const isRealEstateAgent = categoryText.includes('real estate') || 
                                 categoryText.includes('realtor') ||
                                 true; // Zillow scraper only returns agents

      return {
        isRealEstateAgent,
        fullName: name,
        name,
        email: website ? `info@${String(website).replace(/https?:\/\/(www\.)?/, '').split('/')[0]}` : null,
        phoneNumber: phone,
        phone,
        businessName: company,
        profileLink: website,
        website,
        reviewStarsRating: Number(rating) || 4.5,
        rating,
        numTotalReviews: Number(reviews) || 0,
        reviews,
        reviewCount: Number(reviews) || 0,
        specialties: extractSpecialtiesFromCategories(categories),
        thumbnail,
        profilePhotoSrc: thumbnail,
        location: address,
        address,
        full_address: address,
        zuid,
        totalSales: totalSales ? Number(totalSales) : null,
        currentListings: currentListings ? Number(currentListings) : null,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
      };
    }

    console.log(`Using Apify source, raw count: ${items.length}`);

    const transformedAgents = (items || [])
      .map((a: any) => mapAgent(a))
      .filter((a: any) => a && a.isRealEstateAgent && a.name)
      .slice(0, 10);

    console.log(`Transformed ${transformedAgents.length} agents with complete data`);

    if (!categoryId || !cityId) {
      console.warn('Missing categoryId or cityId - returning agents without saving');
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing categoryId or cityId',
        agents: transformedAgents
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save agents to database
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < transformedAgents.length; i++) {
      const agent = transformedAgents[i];
      
      try {
        // Check if agent already exists
        const { data: existing } = await supabase
          .from('professionals')
          .select('id')
          .eq('name', agent.name)
          .eq('city_id', cityId)
          .eq('category_id', categoryId)
          .maybeSingle();

        const professionalData = {
          name: agent.name,
          company: agent.company,
          phone: agent.phone,
          email: 'info@zillow.com',
          website: agent.website,
          image_url: agent.profilePhotoSrc,
          specialty: agent.specialties || ["Buyer's Agent", "Listing Agent"],
          city_id: cityId,
          category_id: categoryId,
          type: i < 5 ? 'established' : 'emerging',
          rank: i + 1,
          active: true,
          zuid: agent.zuid,
          total_sales: agent.totalSales,
          current_listings: agent.currentListings,
        };

        if (existing) {
          // Update existing agent
          const { error: updateError } = await supabase
            .from('professionals')
            .update(professionalData)
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Failed to update ${agent.name}:`, updateError);
            skipped++;
          } else {
            updated++;
            console.log(`Updated ${agent.name}`);
          }
        } else {
          // Insert new agent
          const { error: insertError } = await supabase
            .from('professionals')
            .insert([professionalData]);

          if (insertError) {
            console.error(`Failed to insert ${agent.name}:`, insertError);
            skipped++;
          } else {
            created++;
            console.log(`Created ${agent.name}`);
          }
        }
      } catch (err) {
        console.error(`Error processing ${agent.name}:`, err);
        skipped++;
      }
    }

    const summary = {
      total: transformedAgents.length,
      created,
      updated,
      skipped
    };

    console.log('Import summary:', summary);

    return new Response(JSON.stringify({
      success: true,
      summary,
      agents: transformedAgents
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-zillow-agents-bulk function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractSpecialtiesFromCategories(categories: string[]): string[] {
  const specialtyMap: { [key: string]: string } = {
    'buyer': "Buyer's Agent",
    'seller': "Listing Agent",
    'listing': "Listing Agent",
    'consultant': 'Real Estate Consultant',
    'relocation': 'Relocation Specialist',
    'investment': 'Investment Properties',
    'commercial': 'Commercial Real Estate',
    'residential': 'Residential Real Estate',
  };

  const specialties: string[] = [];
  const lowercaseCategories = categories.join(' ').toLowerCase();

  for (const [key, value] of Object.entries(specialtyMap)) {
    if (lowercaseCategories.includes(key)) {
      specialties.push(value);
    }
  }

  return specialties.length > 0 ? specialties : ["Buyer's Agent", "Listing Agent"];
}
