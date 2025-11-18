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
      },
      concurrency: 50
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
    console.log(`📊 Sample of first agent data:`, JSON.stringify(agentDetails[0], null, 2).substring(0, 500));
    
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

      // Basic info
      if (agent.name) updateData.name = agent.name;
      if (agent.encodedZuid) updateData.zuid = agent.encodedZuid;
      if (agent.url) updateData.zillow_profile_url = agent.url;
      
      // Business info
      if (agent.businessName) updateData.company = agent.businessName;
      if (agent.email) updateData.email = agent.email;
      if (agent.profilePhotoSrc) updateData.image_url = agent.profilePhotoSrc;
      
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

      // Ratings - store as review count and calculate rating
      if (agent.ratings) {
        // Note: ratings are stored in professional_reviews table, not directly on professional
        // We'll just log this for now
        console.log(`Agent ${agent.name} has ${agent.ratings.count} reviews with ${agent.ratings.average} average`);
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

      // License information from agentLicenses or professionalInformation
      if (agent.agentLicenses && agent.agentLicenses.length > 0) {
        updateData.license_number = agent.agentLicenses[0].licenseNumber || agent.agentLicenses[0].license_number;
        updateData.license_verified_at = new Date().toISOString(); // Verified from Zillow
      } else if (agent.professionalInformation && agent.professionalInformation.length > 0) {
        const licenseInfo = agent.professionalInformation.find((info: any) => info.licenses);
        if (licenseInfo?.licenses && licenseInfo.licenses.length > 0) {
          updateData.license_number = licenseInfo.licenses[0];
          updateData.license_verified_at = new Date().toISOString(); // Verified from Zillow
        }
      }

      // Build description from available bio fields
      const descriptionParts = [];
      if (agent.getToKnowMe?.text) descriptionParts.push(agent.getToKnowMe.text);
      if (agent.professional?.text) descriptionParts.push(agent.professional.text);
      if (agent.cpdUserPronouns) descriptionParts.push(`Pronouns: ${agent.cpdUserPronouns}`);
      if (descriptionParts.length > 0) {
        updateData.description = descriptionParts.join('\n\n');
      }

      // Extract website from professionalInformation if not already set
      if (!updateData.website && agent.professionalInformation && agent.professionalInformation.length > 0) {
        const websiteInfo = agent.professionalInformation.find((info: any) => info.websites);
        if (websiteInfo?.websites && websiteInfo.websites.length > 0) {
          updateData.website = websiteInfo.websites[0];
        }
      }

      // Extract specialties from various sources
      const specialties: string[] = [];
      if (agent.professionalInformation && agent.professionalInformation.length > 0) {
        agent.professionalInformation.forEach((info: any) => {
          if (info.specialties) {
            specialties.push(...info.specialties);
          }
        });
      }
      if (specialties.length > 0) {
        updateData.specialty = Array.from(new Set(specialties)); // Remove duplicates
      }

      // Add badges based on achievements
      const badges = [];
      if (agent.isTopAgent) badges.push('Top Agent');
      if (agent.isPremierAgent) badges.push('Premier Agent');
      if (agent.ratings?.average === 5) badges.push('5-Star Rated');
      if (agent.agentSalesStats?.countAllTime > 100) badges.push('100+ Sales');
      if (badges.length > 0) {
        updateData.badges = badges;
      }

      console.log(`📝 Update payload for ${agent.name}:`, JSON.stringify(updateData, null, 2));

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
        const responseData = await updateResponse.json();
        console.log(`✓ Updated professional ${professionalId} (${agent.name}) - Response:`, JSON.stringify(responseData).substring(0, 200));
      } else {
        const errorText = await updateResponse.text();
        const errorStatus = updateResponse.status;
        console.error(`✗ Failed to update professional ${professionalId} (${agent.name}):`, {
          status: errorStatus,
          statusText: updateResponse.statusText,
          error: errorText.substring(0, 500),
          updateDataSample: JSON.stringify(updateData).substring(0, 200)
        });
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
