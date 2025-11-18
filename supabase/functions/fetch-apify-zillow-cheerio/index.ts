import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrls, professionalIds } = await req.json();
    
    if (!profileUrls || !Array.isArray(profileUrls) || profileUrls.length === 0) {
      throw new Error('profileUrls array is required');
    }

    if (!professionalIds || !Array.isArray(professionalIds) || professionalIds.length !== profileUrls.length) {
      throw new Error('professionalIds array must match profileUrls length');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    console.log(`Starting Apify cheerio scraper for ${profileUrls.length} profiles`);

    // Prepare Apify actor input
    const actorInput = {
      startUrls: profileUrls.map(url => ({ url })),
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      }
    };

    // Start the Apify actor
    const startResponse = await fetch(
      'https://api.apify.com/v2/acts/memo23~apify-zillow-agents-cheerio/runs',
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

    const agentDetails = await resultsResponse.json();
    console.log(`Retrieved ${agentDetails.length} detailed agent profiles`);
    
    if (!agentDetails || agentDetails.length === 0) {
      console.log('Warning: No agent details returned from Apify. Raw response:', JSON.stringify(agentDetails).substring(0, 500));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Apify returned no agent data. The scraper may have failed or the profiles may be inaccessible.',
          enriched: 0,
          total: profileUrls.length,
          agents: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update professionals table with enriched data
    const enrichedAgents = [];
    
    for (let i = 0; i < agentDetails.length; i++) {
      const agent = agentDetails[i];
      const professionalId = professionalIds[i];
      
      console.log(`Processing agent ${i + 1}/${agentDetails.length}: ${agent?.name || 'Unknown'}`);
      
      if (!agent || !professionalId) {
        console.log(`Skipping agent ${i + 1} - missing data:`, { hasAgent: !!agent, hasProfId: !!professionalId });
        continue;
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
        zillow_data_fetched_at: new Date().toISOString(),
      };

      // Map fields from Apify response
      if (agent.name) updateData.name = agent.name;
      if (agent.businessName) updateData.company = agent.businessName;
      if (agent.email) updateData.email = agent.email;
      if (agent.website) updateData.website = agent.website;
      if (agent.profilePhotoSrc) updateData.image_url = agent.profilePhotoSrc;
      if (agent.encodedZuid) updateData.zuid = agent.encodedZuid;
      
      // Phone number (prefer cell, fallback to business)
      if (agent.phoneNumbers) {
        updateData.phone = agent.phoneNumbers.cell || agent.phoneNumbers.business || agent.phoneNumbers.brokerage;
      }
      
      // Address
      if (agent.businessAddress) {
        const addr = agent.businessAddress;
        updateData.address = [addr.address1, addr.address2, addr.city, addr.state, addr.postalCode]
          .filter(Boolean)
          .join(', ');
        if (addr.postalCode) {
          updateData.zip_code = addr.postalCode;
        }
      }

      // Sales stats
      if (agent.agentSalesStats) {
        updateData.total_sales = agent.agentSalesStats.countAllTime || agent.agentSalesStats.countLastYear;
        updateData.years_experience = agent.agentSalesStats.countAllTime ? 
          Math.ceil(agent.agentSalesStats.countAllTime / 10) : null;
      }

      // Current listings
      if (agent.forSaleListings?.listing_count) {
        updateData.current_listings = agent.forSaleListings.listing_count;
      }

      const updateResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/professionals?id=eq.${professionalId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      if (updateResponse.ok) {
        console.log(`✓ Updated professional ${professionalId} (${agent.name})`);
        
        // Arizona license lookup integration
        const cityResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/professionals?select=city_id,cities(state)&id=eq.${professionalId}`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY!,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        
        if (cityResponse.ok) {
          const profData = await cityResponse.json();
          const state = profData[0]?.cities?.state;
          
          if (state === 'Arizona') {
            console.log(`🔍 Looking up Arizona license for ${agent.name}...`);
            
            try {
              const licenseResponse = await fetch(
                `${SUPABASE_URL}/functions/v1/lookup-agent-license`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    agentName: agent.name,
                    state: 'Arizona',
                  }),
                }
              );

              if (licenseResponse.ok) {
                const licenseData = await licenseResponse.json();
                if (licenseData.success && licenseData.licenseNumber) {
                  await fetch(
                    `${SUPABASE_URL}/rest/v1/professionals?id=eq.${professionalId}`,
                    {
                      method: 'PATCH',
                      headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        license_number: licenseData.licenseNumber,
                        license_verified_at: new Date().toISOString(),
                      }),
                    }
                  );
                  console.log(`✓ Added Arizona license ${licenseData.licenseNumber} for ${agent.name}`);
                } else {
                  console.log(`⚠ No license found for ${agent.name}`);
                }
              }
            } catch (licenseError) {
              console.error(`✗ License lookup failed for ${agent.name}:`, licenseError);
            }
          }
        }
      } else {
        const error = await updateResponse.text();
        console.error(`✗ Failed to update professional ${professionalId}:`, error);
      }

      // Always add to enrichedAgents array
      const enrichedAgent = {
        id: professionalId,
        name: agent.name || 'Unknown',
        photo: agent.profilePhotoSrc || null,
        totalSales: agent.agentSalesStats?.countAllTime || 0,
        currentListings: agent.forSaleListings?.listing_count || 0,
        reviewsCount: agent.ratings?.count || 0,
        rating: agent.ratings?.average || 0,
      };
      
      enrichedAgents.push(enrichedAgent);
    }
    
    console.log(`Enrichment complete: ${enrichedAgents.length} agents enriched`);

    return new Response(
      JSON.stringify({
        success: true,
        enriched: agentDetails.length,
        total: profileUrls.length,
        agents: enrichedAgents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in fetch-apify-zillow-cheerio:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
