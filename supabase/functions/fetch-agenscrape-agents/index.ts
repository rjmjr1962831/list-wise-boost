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
    const { locationText, cityId, categoryId, maxResults = 50 } = await req.json();
    
    if (!categoryId || !cityId) {
      throw new Error('cityId and categoryId are required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const PROXYSCRAPE_API_KEY = Deno.env.get('PROXYSCRAPE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }
    
    if (!PROXYSCRAPE_API_KEY) {
      throw new Error('PROXYSCRAPE_API_KEY not configured');
    }

    console.log(`Starting getdataforme scraper for location: ${locationText || 'city lookup'}`);

    // Determine final cityId and search location
    let finalCityId = cityId;
    let searchLocation = locationText;
    
    if (!cityId && locationText) {
      // User provided only locationText (zip code) but no city selected
      // We'll use the locationText for search, but we need a cityId for database storage
      throw new Error('Please select a city from the dropdown. Zip code alone is not sufficient - we need to know which city to associate these agents with.');
      } else if (cityId && !locationText) {
        // cityId provided but no locationText.
        // Prefer a single ZIP code (from our zipCodeData) because Apify docs
        // say locationText should be a ZIP, city, or address (not a list).
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
          const stateName = cityData[0].state;

          // Try to load a primary ZIP from local zipCodeData
          try {
            const zipDataModule = await import('../zipCodeData.json', { assert: { type: 'json' } });
            const zipData = zipDataModule.default as any[];

            const cityZipData = zipData.find((c: any) =>
              c.city.toLowerCase() === cityName.toLowerCase()
            );

            const primaryZip: string | undefined = cityZipData?.suburbs?.[0]?.zipcodes?.[0]?.zipcode;

            // Always use "City ST" format instead of ZIP code alone
            // as agenscrape seems to work better with city/state
            // Check if state is already an abbreviation (2 chars) or full name
            const stateAbbrev = stateName.length === 2 ? stateName : stateAbbreviations[stateName];
            if (!stateAbbrev) {
              throw new Error(`Unknown state: ${stateName}`);
            }
            searchLocation = `${cityName} ${stateAbbrev}`;
            console.log(`Using city/state location: ${searchLocation}, Primary ZIP: ${primaryZip || 'none found'}`);
          } catch (zipErr) {
            console.error('Error loading zipCodeData.json, falling back to city/state:', zipErr);
            const stateAbbrev = stateName.length === 2 ? stateName : stateAbbreviations[stateName];
            if (!stateAbbrev) {
              throw new Error(`Unknown state: ${stateName}`);
            }
            searchLocation = `${cityName} ${stateAbbrev}`;
            console.log(`Fallback city/state location: ${searchLocation}`);
          }
        } else {
          throw new Error(`City not found with id: ${cityId}`);
        }
      }
    
    if (!finalCityId) {
      throw new Error('Could not determine city for import');
    }

    // Construct ProxyScrape URL for US residential proxies
    const proxyUrl = `http://rp.proxyscrape.com:6060?auth=${PROXYSCRAPE_API_KEY}&country=us&protocol=http`;
    console.log('Using ProxyScrape for US residential proxies');

    // Start the Apify actor with proxy configuration
    const actorInput = {
      search_query: searchLocation,
      category: "real-estate-agents",
      locationText: searchLocation,
      name: "",
      language: "English",
      specialty: "",
      maxResults: maxResults,
      startPage: 1,
      proxy: {
        useApifyProxy: false,
        proxyUrls: [proxyUrl]
      }
    };
    
    console.log('Apify actor input:', JSON.stringify(actorInput, null, 2));

    const startResponse = await fetch(
      'https://api.apify.com/v2/acts/getdataforme~zillow-real-state-agents-scraper/runs',
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
    const maxAttempts = 120; // 10 minutes max (5 sec intervals)

    console.log(`Starting to poll Apify run ${runId}...`);
    
    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      try {
        const statusResponse = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}`,
          {
            headers: {
              'Authorization': `Bearer ${APIFY_API_TOKEN}`,
            },
          }
        );

        if (!statusResponse.ok) {
          console.error(`Apify status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
          throw new Error(`Apify API error: ${statusResponse.status}`);
        }

        const { data: statusData } = await statusResponse.json();
        status = statusData.status;
        attempts++;
        
        console.log(`Run status: ${status}, attempt ${attempts}/${maxAttempts}, elapsed: ${attempts * 5}s`);
        
        // Log additional info if available
        if (statusData.stats) {
          console.log(`Apify stats:`, JSON.stringify(statusData.stats));
        }
      } catch (error) {
        console.error(`Error polling Apify status:`, error);
        throw error;
      }
    }

    if (status !== 'SUCCEEDED') {
      console.error(`Actor run failed or timed out. Final status: ${status}, attempts: ${attempts}`);
      throw new Error(`Actor run did not succeed. Final status: ${status} after ${attempts} attempts (${attempts * 5} seconds)`);
    }
    
    console.log(`Apify run completed successfully after ${attempts * 5} seconds`);

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
      // Skip non-real-estate-agents (property managers, etc.)
      if (agent.category && agent.category !== 'real-estate-agents') {
        console.log(`Skipping ${agent.fullName} - category: ${agent.category}`);
        continue;
      }

      // Filter for 4.9+ star ratings and 200+ reviews BEFORE importing
      const rating = agent.reviewStarsRating || agent.rating || 0;
      const reviewCount = agent.numTotalReviews || agent.reviews_count || 0;
      
      if (rating < 4.9) {
        console.log(`Skipping ${agent.fullName} - rating too low: ${rating} (need 4.9+)`);
        continue;
      }
      
      if (reviewCount < 200) {
        console.log(`Skipping ${agent.fullName} - not enough reviews: ${reviewCount} (need 200+)`);
        continue;
      }
      
      console.log(`✅ ${agent.fullName} qualifies: ${rating}★ with ${reviewCount} reviews`);

      // Extract agent info from Apify response
      // Handle both old and new field names from different scrapers
      const profileUrl = agent.profileLink || agent.profile_url;
      
      if (!profileUrl) {
        console.log('Skipping agent without profile URL');
        continue;
      }

      // Extract email
      const email = agent.email || null;
      
      // Generate website from email domain if no explicit website
      let website = null;
      if (email) {
        const domain = email.split('@')[1];
        if (domain) {
          website = `https://${domain}`;
        }
      }

      // Parse sales from team_sales_last_12_months if available
      const salesCount = agent.team_sales_last_12_months 
        ? parseInt(agent.team_sales_last_12_months) 
        : (agent.totalSales || agent.sales_count || agent.sold_in_last_year || 0);

      const professionalData = {
        name: agent.fullName || agent.name || agent.screenName || 'Agent ' + nextRank,
        zillow_profile_url: profileUrl,
        image_url: agent.profilePhotoSrc || agent.image_url || null,
        phone: agent.phoneNumber || agent.phoneNumbers?.business || agent.phoneNumbers?.cell || null,
        email: email,
        website: website,
        company: agent.businessName || agent.company || null,
        review_link: agent.reviewLink || null,
        num_total_reviews: agent.numTotalReviews || agent.reviews_count || 0,
        reviews_text: agent.reviews || null,
        review_stars_rating: rating || null,
        current_listings: agent.currentListings || agent.for_sale_count || 0,
        total_sales: salesCount,
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
        
        // Trigger background email verification if email exists
        if (email && inserted.id) {
          fetch(`${SUPABASE_URL}/functions/v1/verify-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ professionalId: inserted.id })
          }).catch(err => console.log('Background email verification failed:', err));
        }
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
