import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// State name to abbreviation mapper
const stateAbbreviations: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { locationText, cityId, categoryId } = await req.json();
    
    if (!categoryId || !cityId) {
      throw new Error('cityId and categoryId are required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    console.log(`Starting agenscrape scraper for location: ${locationText || 'city lookup'}`);

    // Determine final cityId and search location
    let finalCityId = cityId;
    let searchLocation = locationText;
    
    if (!cityId && locationText) {
      // User provided only locationText (zip code) but no city selected
      // We'll use the locationText for search, but we need a cityId for database storage
      throw new Error('Please select a city from the dropdown. Zip code alone is not sufficient - we need to know which city to associate these agents with.');
    } else if (cityId && !locationText) {
      // cityId provided but no locationText, get first zip code for the city
      const cityResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/cities?id=eq.${cityId}&select=name,state&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      
      const cityData = await cityResponse.json();
      
      if (cityData && cityData.length > 0) {
        const cityName = cityData[0].name;
        
        // Load zip code data and find first zip for this city
        const zipDataModule = await import('../zipCodeData.json', { assert: { type: 'json' } });
        const zipData = zipDataModule.default;
        
        const cityZipData = zipData.find((c: any) => 
          c.city.toLowerCase() === cityName.toLowerCase()
        );
        
        if (cityZipData && cityZipData.suburbs?.[0]?.zipcodes?.[0]) {
          searchLocation = cityZipData.suburbs[0].zipcodes[0].zipcode;
          console.log(`Using first zip code for ${cityName}: ${searchLocation}`);
        } else {
          throw new Error(`No zip codes found for city: ${cityName}`);
        }
      } else {
        throw new Error(`City not found with id: ${cityId}`);
      }
    }
    
    if (!finalCityId) {
      throw new Error('Could not determine city for import');
    }

    // Start the Apify actor
    const actorInput = {
      locationText: searchLocation,
      category: "real-estate-agents",
      maxResults: 50,
      startPage: 1
    };
    
    console.log('Apify actor input:', JSON.stringify(actorInput, null, 2));

    const startResponse = await fetch(
      'https://api.apify.com/v2/acts/agenscrape~zillow-agents-finder/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
        body: JSON.stringify(actorInput),
      }
    );

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(`Failed to start actor: ${startResponse.status} - ${errorText}`);
    }

    const { data: runData } = await startResponse.json();
    const runId = runData.id;
    console.log(`Actor started with run ID: ${runId}`);

    // Poll for completion
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 sec intervals)

    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${APIFY_API_TOKEN}`,
          },
        }
      );

      const { data: statusData } = await statusResponse.json();
      status = statusData.status;
      attempts++;
      
      console.log(`Run status: ${status}, attempt ${attempts}/${maxAttempts}`);
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Actor run did not succeed. Final status: ${status}`);
    }

    // Get results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
      {
        headers: {
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
      }
    );

    const agents = await resultsResponse.json();
    console.log(`Raw Apify response:`, JSON.stringify(agents, null, 2));
    console.log(`Retrieved ${agents.length} agent profile URLs`);

    // Get next rank using REST API
    const existingProsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/professionals?city_id=eq.${finalCityId}&category_id=eq.${categoryId}&select=rank&order=rank.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    const existingPros = await existingProsResponse.json();
    let nextRank = existingPros && existingPros.length > 0 ? existingPros[0].rank + 1 : 1;

    // Insert agents into database (just profile URLs for now)
    const insertedAgents = [];
    
    for (const agent of agents) {
      // Extract agent info from Apify response
      const profileUrl = agent.profileLink;
      
      if (!profileUrl) {
        console.log('Skipping agent without profile URL');
        continue;
      }

      const professionalData = {
        name: agent.fullName || 'Agent ' + nextRank,
        zillow_profile_url: profileUrl,
        phone: agent.phoneNumber || null,
        company: agent.businessName || null,
        city_id: finalCityId,
        category_id: categoryId,
        rank: nextRank++,
        type: 'individual',
        active: true,
      };

      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/professionals`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(professionalData),
        }
      );

      if (insertResponse.ok) {
        const [inserted] = await insertResponse.json();
        insertedAgents.push(inserted);
        console.log(`Inserted agent with profile: ${profileUrl}`);
      } else {
        const error = await insertResponse.text();
        console.error(`Error inserting agent:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedAgents.length,
        total: agents.length,
        agents: insertedAgents.map(a => ({
          id: a.id,
          name: a.name,
          profileUrl: a.zillow_profile_url
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in fetch-agenscrape-agents:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
