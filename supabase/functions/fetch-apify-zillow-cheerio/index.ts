import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

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

    // Start background processing
    const backgroundTask = async () => {
      try {

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
      }

      // Calculate years_experience from license date
      let licenseDate = null;
      
      // Try to get license date from agentLicenses
      if (agent.agentLicenses && agent.agentLicenses.length > 0) {
        const license = agent.agentLicenses[0];
        licenseDate = license.issueDate || license.issue_date || license.licenseDate || license.license_date;
      }
      
      // Fall back to professionalInformation
      if (!licenseDate && agent.professionalInformation && agent.professionalInformation.length > 0) {
        const licenseInfo = agent.professionalInformation.find((info: any) => info.licenseDate || info.license_date);
        if (licenseInfo) {
          licenseDate = licenseInfo.licenseDate || licenseInfo.license_date;
        }
      }
      
      // Calculate years from license date or estimate from sales
      if (licenseDate) {
        const issueYear = new Date(licenseDate).getFullYear();
        const currentYear = new Date().getFullYear();
        updateData.years_experience = currentYear - issueYear;
      } else if (agent.agentSalesStats?.countAllTime) {
        // Fall back to sales-based estimate
        updateData.years_experience = Math.ceil(agent.agentSalesStats.countAllTime / 10);
      }

      // Current listings
      if (agent.forSaleListings?.listing_count) {
        updateData.current_listings = agent.forSaleListings.listing_count;
      }

      // License information from agentLicenses or professionalInformation
      console.log(`📋 License data for ${agent.name}:`, JSON.stringify({
        agentLicenses: agent.agentLicenses,
        professionalInformation: agent.professionalInformation
      }, null, 2));
      
      if (agent.agentLicenses && agent.agentLicenses.length > 0) {
        const license = agent.agentLicenses[0];
        // Check for 'text' field which is what Apify actually returns
        const licenseNumber = license.text || license.licenseNumber || license.license_number || license.number;
        if (licenseNumber) {
          updateData.license_number = licenseNumber;
          updateData.license_verified_at = new Date().toISOString();
          console.log(`✓ License found in agentLicenses: ${licenseNumber}`);
        } else {
          console.log(`⚠ agentLicenses exists but no license number found:`, license);
        }
      } else if (agent.professionalInformation && agent.professionalInformation.length > 0) {
        // Try to find license in professionalInformation
        const licenseInfo = agent.professionalInformation.find((info: any) => 
          info.term === "Real Estate Licenses" && (info.lines || info.description)
        );
        if (licenseInfo) {
          const licenseNumber = licenseInfo.lines?.[0] || licenseInfo.description;
          if (licenseNumber && licenseNumber !== "Not provided") {
            // Extract just the license number (remove state abbreviation if present)
            const cleanLicense = licenseNumber.split(' ')[0];
            updateData.license_number = cleanLicense;
            updateData.license_verified_at = new Date().toISOString();
            console.log(`✓ License found in professionalInformation: ${cleanLicense}`);
          } else {
            console.log(`⚠ License marked as "Not provided"`);
          }
        } else {
          console.log(`⚠ professionalInformation exists but no licenses found`);
        }
      } else {
        console.log(`⚠ No license data found for ${agent.name}`);
      }

      // Generate AI bio if no description exists
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          // Build context from available agent data
          const specialties = agent.specialties?.join(', ') || 'real estate';
          const totalSalesCount = updateData.total_sales || 'numerous';
          
          const bioPrompt = `Generate a professional and compelling bio for real estate agent ${agent.name}. 

Agent Details:
- Works at: ${agent.company || 'a reputable brokerage'}
- Specialties: ${specialties}
- Sales: ${totalSalesCount} transactions
${agent.reviewCount ? `- Client reviews: ${agent.reviewCount} with ${agent.reviewValue} average rating` : ''}

Requirements:
- 2-3 sentences only
- Professional and engaging tone
- Focus on expertise and client success
- Third person perspective
- Highlight what makes them a great choice
- DO NOT mention or estimate years of experience`;

          const bioResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You are a professional bio writer for real estate agents. Write compelling, concise bios." },
                { role: "user", content: bioPrompt }
              ],
            }),
          });

          if (bioResponse.ok) {
            const bioData = await bioResponse.json();
            const generatedBio = bioData.choices[0]?.message?.content;
            if (generatedBio) {
              updateData.description = generatedBio;
              console.log(`✓ Generated bio for ${agent.name}`);
            }
          } else {
            console.log(`⚠ Failed to generate bio for ${agent.name}: ${bioResponse.status}`);
          }
        } catch (error) {
          console.error(`Error generating bio for ${agent.name}:`, error);
        }
      } else {
        console.log(`⚠ No LOVABLE_API_KEY found, skipping bio generation`);
      }

      // Extract website from professionalInformation - prioritize this source
      if (agent.professionalInformation && agent.professionalInformation.length > 0) {
        console.log(`🌐 Searching for website in professionalInformation for ${agent.name}:`, JSON.stringify(agent.professionalInformation, null, 2));
        
        // Try multiple possible field names and structures
        for (const info of agent.professionalInformation) {
          let foundWebsite = null;
          
          // Check for websites array
          if (info.websites && Array.isArray(info.websites) && info.websites.length > 0) {
            foundWebsite = info.websites[0];
          }
          // Check for single website field
          else if (info.website && typeof info.website === 'string') {
            foundWebsite = info.website;
          }
          // Check for url field
          else if (info.url && typeof info.url === 'string') {
            foundWebsite = info.url;
          }
          // Check for lines array (sometimes website is in there)
          else if (info.lines && Array.isArray(info.lines)) {
            const urlLine = info.lines.find((line: string) => 
              line && (line.startsWith('http') || line.includes('.com') || line.includes('.net'))
            );
            if (urlLine) foundWebsite = urlLine;
          }
          
          if (foundWebsite && foundWebsite.trim() !== '') {
            updateData.website = foundWebsite.trim();
            console.log(`✓ Website found in professionalInformation: ${updateData.website}`);
            break;
          }
        }
        
        if (!updateData.website) {
          console.log(`⚠ No website found in professionalInformation for ${agent.name}`);
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
        console.log(`✓ Updated professional ${professionalId} (${agent.name})`);
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
      } catch (error) {
        console.error('Background task error:', error);
      }
    };

    // Start background task
    EdgeRuntime.waitUntil(backgroundTask());

    // Return immediate response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Started enrichment for ${profileUrls.length} profiles`,
        status: 'processing'
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
