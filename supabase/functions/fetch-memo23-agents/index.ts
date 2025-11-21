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
    const { cityId, categoryId, maxConcurrency = 10 } = await req.json();

    if (!cityId || !categoryId) {
      throw new Error('cityId and categoryId are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get city info
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('*')
      .eq('id', cityId)
      .single();

    if (cityError || !city) {
      throw new Error(`City not found: ${cityError?.message}`);
    }

    // Get category info
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (categoryError || !category) {
      throw new Error(`Category not found: ${categoryError?.message}`);
    }

    console.log(`Fetching agents for ${city.name}, ${city.state} - ${category.name}`);

    // Get Apify API token
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Prepare location for search
    const searchLocation = `${city.name}, ${city.state}`;

    // Start the memo23 Apify actor for detailed agent data
    const actorId = 'memo23~apify-zillow-agents-cheerio';

    // First, get agent URLs from existing profiles
    // Only fetch agents that need updating (never fetched OR older than 30 days)
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    
    // Query for agents that need enrichment
    let query = supabase
      .from('professionals')
      .select('zillow_profile_url, zillow_data_fetched_at, name')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .not('zillow_profile_url', 'is', null)
      .limit(10); // Process 10 agents per batch to avoid timeouts
    
    // Get agents that have NEVER been fetched OR are stale
    const { data: neverFetched } = await query.is('zillow_data_fetched_at', null);
    const { data: staleFetched } = await query.lt('zillow_data_fetched_at', thirtyDaysAgo);
    
    // Combine both lists, prioritizing never-fetched
    const existingProfiles = [
      ...(neverFetched || []),
      ...(staleFetched || [])
    ].slice(0, 10);

    if (!existingProfiles || existingProfiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No existing profiles found. Please run agenscrape first to get profile URLs.',
          imported: 0,
          total: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentUrls = existingProfiles
      .filter(p => p.zillow_profile_url)
      .map(p => p.zillow_profile_url);

    console.log(`Processing ${agentUrls.length} agent profiles with memo23:`);
    existingProfiles.forEach(p => {
      console.log(`  - ${p.name}: ${p.zillow_profile_url} (last fetch: ${p.zillow_data_fetched_at || 'NEVER'})`);
    });

    // Run memo23 actor with configurable concurrency
    const actorInput = {
      startUrls: agentUrls.map(url => ({ url })),
      maxConcurrency: maxConcurrency,
      proxyConfiguration: { 
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };

    console.log('Starting memo23 actor...');

    const actorResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput)
      }
    );

    if (!actorResponse.ok) {
      throw new Error(`Failed to start Apify actor: ${actorResponse.status}`);
    }

    const runData = await actorResponse.json();
    const runId = runData.data.id;
    console.log(`Actor started with run ID: ${runId}`);

    // Get next rank for this city/category
    const { data: existingPros } = await supabase
      .from('professionals')
      .select('rank')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .order('rank', { ascending: false })
      .limit(1);

    let nextRank = existingPros && existingPros.length > 0 ? existingPros[0].rank + 1 : 1;

    const datasetId = runData.data.defaultDatasetId;
    let processedCount = 0;
    let imported = 0;
    const processedUrls = new Set<string>();

    // Poll dataset incrementally while actor is running
    const maxAttempts = 120;
    let attempt = 0;
    let runStatus = 'RUNNING';
    
    console.log('Starting incremental processing...');
    
    while (attempt < maxAttempts && !['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus)) {
      attempt++;
      
      // Check run status
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      
      if (!statusResponse.ok) {
        throw new Error(`Failed to check run status: ${statusResponse.status}`);
      }
      
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      
      // Fetch current dataset items
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
      );

      if (datasetResponse.ok) {
        const agents = await datasetResponse.json();
        const newAgents = agents.filter((agent: any) => agent.url && !processedUrls.has(agent.url));
        
        if (newAgents.length > 0) {
          console.log(`Found ${newAgents.length} new agents to process (Total: ${agents.length})`);
          
          // Process new agents immediately
          for (const agent of newAgents) {
            processedUrls.add(agent.url);
            const result = await processAgent(agent, cityId, categoryId, supabase, nextRank);
            if (result.success) {
              imported++;
              if (result.isNew) nextRank++;
            }
            processedCount++;
          }
          
          console.log(`Progress: ${processedCount}/${agentUrls.length} agents processed, ${imported} imported`);
        }
      }
      
      console.log(`Attempt ${attempt}/${maxAttempts}: Status=${runStatus}, Processed=${processedCount}/${agentUrls.length}`);
      
      // Wait before next poll (shorter interval for faster updates)
      if (runStatus === 'RUNNING') {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    if (runStatus !== 'SUCCEEDED') {
      console.warn(`Actor run ended with status: ${runStatus}. Processed ${processedCount} agents.`);
    }

    console.log(`Incremental processing complete: ${imported} agents imported out of ${processedCount} processed`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total: processedCount,
        message: `Successfully processed ${imported} out of ${processedCount} agents with memo23 data (incremental updates enabled)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-memo23-agents:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Helper function to process a single agent
async function processAgent(
  agent: any,
  cityId: string,
  categoryId: string,
  supabase: any,
  rank: number
): Promise<{ success: boolean; isNew: boolean }> {
  try {
    const profileUrl = agent.url;
    
    // Fetch existing record to check for updates
    const { data: existingRecord } = await supabase
      .from('professionals')
      .select('*')
      .eq('zillow_profile_url', profileUrl)
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .maybeSingle();

    // Map all memo23 fields
    const memo23Data: any = {};
    
    if (agent.name) memo23Data.name = agent.name;
    if (agent.screenName) memo23Data.screen_name = agent.screenName;
    if (agent.encodedZuid) {
      memo23Data.encoded_zuid = agent.encodedZuid;
      memo23Data.zuid = agent.encodedZuid;
    }
    if (agent.inCanada !== undefined) memo23Data.in_canada = agent.inCanada;
    if (agent.profileTypeIds) memo23Data.profile_type_ids = agent.profileTypeIds;
    if (agent.profileTypes) memo23Data.profile_types = agent.profileTypes;
    if (agent.sidebarVideoUrl) memo23Data.sidebar_video_url = agent.sidebarVideoUrl;
    if (agent.businessAddress) {
      memo23Data.business_address = agent.businessAddress;
      if (agent.businessAddress.postalCode) {
        memo23Data.zip_code = agent.businessAddress.postalCode;
      }
      const addrParts = [
        agent.businessAddress.address1,
        agent.businessAddress.city,
        agent.businessAddress.state,
        agent.businessAddress.postalCode
      ].filter(Boolean);
      if (addrParts.length > 0) {
        memo23Data.address = addrParts.join(', ');
      }
    }
    if (agent.businessName) {
      memo23Data.business_name = agent.businessName;
      memo23Data.company = agent.businessName;
    }
    if (agent.cpdUserPronouns) memo23Data.cpd_user_pronouns = agent.cpdUserPronouns;
    if (agent.isTopAgent !== undefined) memo23Data.is_top_agent = agent.isTopAgent;
    if (agent.profileImageId) memo23Data.profile_image_id = agent.profileImageId;
    if (agent.profilePhotoSrc) memo23Data.image_url = agent.profilePhotoSrc;
    if (agent.isPremierAgent !== undefined) memo23Data.is_premier_agent = agent.isPremierAgent;
    if (agent.ratings) memo23Data.ratings = agent.ratings;
    if (agent.phoneNumbers) memo23Data.phone_numbers = agent.phoneNumbers;
    
    // Extract email is now handled in dedicated section above (lines 314-379)
    // if (agent.email) memo23Data.email = agent.email;
    
    if (agent.professional) memo23Data.professional_data = agent.professional;
    
    if (agent.getToKnowMe) {
      if (typeof agent.getToKnowMe === 'string') {
        memo23Data.get_to_know_me = agent.getToKnowMe;
      } else if (agent.getToKnowMe.description) {
        memo23Data.get_to_know_me = agent.getToKnowMe.description;
      }
    }
    
    if (agent.agentLicenses) memo23Data.agent_licenses = agent.agentLicenses;
    if (agent.agentSalesStats) memo23Data.agent_sales_stats = agent.agentSalesStats;
    if (agent.teamDisplayInformation) memo23Data.team_display_information = agent.teamDisplayInformation;
    if (agent.pastSales) memo23Data.past_sales = agent.pastSales;
    
    // ALWAYS store professional_information for full enrichment (includes contact details, licenses, specialties)
    if (agent.professionalInformation) memo23Data.professional_information = agent.professionalInformation;
    
    // Extract specialties from multiple possible locations
    if (agent.professionalInformation && Array.isArray(agent.professionalInformation)) {
      const specialtiesEntry = agent.professionalInformation.find((info: any) => 
        info.term === 'Specialties' || info.term === 'Areas of Focus' || info.term === 'Service areas'
      );
      if (specialtiesEntry) {
        // Try detail, lines, or description fields
        const rawData = specialtiesEntry.detail || specialtiesEntry.lines || specialtiesEntry.description;
        const specialties: string[] = [];
        
        if (Array.isArray(rawData)) {
          rawData.forEach((item: any) => {
            if (typeof item === 'string' && item.trim()) {
              specialties.push(item.trim());
            } else if (item?.text && typeof item.text === 'string') {
              specialties.push(item.text.trim());
            }
          });
        } else if (typeof rawData === 'string' && rawData.trim()) {
          // Single string specialty
          specialties.push(rawData.trim());
        }
        
        if (specialties.length > 0) {
          memo23Data.specialty = specialties;
        }
      }
    }
    
    // Extract email from multiple sources
    if (agent.email) {
      memo23Data.email = agent.email;
    } else if (agent.professionalInformation && Array.isArray(agent.professionalInformation)) {
      // Check for email in professionalInformation
      const emailEntry = agent.professionalInformation.find((info: any) => 
        (info.term || '').toLowerCase().includes('email')
      );
      if (emailEntry) {
        // Try links first (mailto: links)
        if (emailEntry.links && Array.isArray(emailEntry.links)) {
          for (const link of emailEntry.links) {
            if (link.url && link.url.startsWith('mailto:')) {
              memo23Data.email = link.url.replace('mailto:', '');
              break;
            } else if (link.text && link.text.includes('@')) {
              memo23Data.email = link.text;
              break;
            }
          }
        }
        
        // Try lines or description
        if (!memo23Data.email) {
          const candidates = [];
          if (Array.isArray(emailEntry.lines)) candidates.push(...emailEntry.lines);
          if (emailEntry.description) candidates.push(emailEntry.description);
          
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
          for (const raw of candidates) {
            if (!raw) continue;
            const match = raw.match(emailRegex);
            if (match) {
              memo23Data.email = match[0].trim();
              break;
            }
          }
        }
      }
    }
    
    // Extract video URL
    if (!agent.sidebarVideoUrl && agent.professionalInformation && Array.isArray(agent.professionalInformation)) {
      for (const info of agent.professionalInformation) {
        if (info.term === 'Websites' && Array.isArray(info.detail)) {
          const videoLink = info.detail.find((d: any) => 
            d.text?.toLowerCase().includes('video') || 
            d.text?.toLowerCase().includes('youtube') ||
            d.link?.includes('youtube.com') ||
            d.link?.includes('youtu.be')
          );
          if (videoLink?.link) {
            memo23Data.sidebar_video_url = videoLink.link;
            break;
          }
        }
      }
    }
    
    if (!memo23Data.sidebar_video_url && agent.getToKnowMe?.videoUrl) {
      memo23Data.sidebar_video_url = agent.getToKnowMe.videoUrl;
    }
    
    // Extract license number
    if (agent.agentLicenses && Array.isArray(agent.agentLicenses) && agent.agentLicenses.length > 0) {
      const license = agent.agentLicenses[0];
      if (typeof license === 'string') {
        memo23Data.license_number = license;
      } else if (typeof license === 'object') {
        memo23Data.license_number = license.text || license.licenseNumber || null;
      }
    }
    
    // Extract website
    if (agent.professionalInformation && Array.isArray(agent.professionalInformation)) {
      const websitesEntry = agent.professionalInformation.find((info: any) => info.term === 'Websites');
      if (websitesEntry?.links && Array.isArray(websitesEntry.links)) {
        const primaryWebsite = websitesEntry.links[0];
        if (primaryWebsite?.url) {
          memo23Data.website = primaryWebsite.url;
        }
      }
    }
    
    // Extract phone
    if (agent.phoneNumbers && agent.phoneNumbers.length > 0) {
      const primaryPhone = agent.phoneNumbers.find((p: any) => p.primary) || agent.phoneNumbers[0];
      if (primaryPhone?.formattedPhoneNumber) {
        memo23Data.phone = primaryPhone.formattedPhoneNumber;
      } else if (typeof primaryPhone === 'string') {
        memo23Data.phone = primaryPhone;
      }
    }
    
    // Extract review data
    if (agent.ratings) {
      if (agent.ratings.starRating !== undefined) {
        memo23Data.review_stars_rating = agent.ratings.starRating;
      } else if (agent.ratings.averageRating !== undefined) {
        memo23Data.review_stars_rating = agent.ratings.averageRating;
      }
      
      if (agent.ratings.totalReviews !== undefined) {
        memo23Data.num_total_reviews = agent.ratings.totalReviews;
      } else if (agent.ratings.count !== undefined) {
        memo23Data.num_total_reviews = agent.ratings.count;
      }
    }
    
    if (agent.reviewsData && Array.isArray(agent.reviewsData) && agent.reviewsData.length > 0) {
      memo23Data.reviews_data = agent.reviewsData;
    }
    
    // Extract sales data
    if (agent.agentSalesStats) {
      if (agent.agentSalesStats.countAllTime !== undefined) {
        memo23Data.total_sales = agent.agentSalesStats.countAllTime;
      } else if (agent.agentSalesStats.totalTransactionSides !== undefined) {
        memo23Data.total_sales = agent.agentSalesStats.totalTransactionSides;
      } else if (agent.agentSalesStats.countLastYear !== undefined) {
        memo23Data.total_sales = agent.agentSalesStats.countLastYear;
      }
      
      if (agent.agentSalesStats.currentListings !== undefined) {
        memo23Data.current_listings = agent.agentSalesStats.currentListings;
      }
    }
    
    // Extract years experience
    if (agent.yearsExperience !== undefined) {
      memo23Data.years_experience = agent.yearsExperience;
    } else if (agent.professionalInformation?.yearsExperience !== undefined) {
      memo23Data.years_experience = agent.professionalInformation.yearsExperience;
    }
    
    memo23Data.zillow_data_fetched_at = new Date().toISOString();
    if (!existingRecord?.zillow_profile_url) {
      memo23Data.zillow_profile_url = profileUrl;
    }

    if (existingRecord) {
      const { error: updateError } = await supabase
        .from('professionals')
        .update(memo23Data)
        .eq('id', existingRecord.id);

      if (updateError) {
        console.error(`Error updating ${agent.name}:`, updateError);
        return { success: false, isNew: false };
      }
      console.log(`✅ Updated: ${agent.name}`);
      return { success: true, isNew: false };
    } else {
      memo23Data.rank = rank;
      memo23Data.city_id = cityId;
      memo23Data.category_id = categoryId;
      memo23Data.type = 'individual';
      memo23Data.active = true;
      
      const { error: insertError } = await supabase
        .from('professionals')
        .insert(memo23Data);

      if (insertError) {
        console.error(`Error inserting ${agent.name}:`, insertError);
        return { success: false, isNew: true };
      }
      console.log(`✅ Inserted: ${agent.name}`);
      return { success: true, isNew: true };
    }
  } catch (error) {
    console.error(`Error processing agent:`, error);
    return { success: false, isNew: false };
  }
}
