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
    const { 
      professionalIds,
      batchSize = 10,
      limitToSites = ['LinkedIn', 'Instagram', 'TikTok', 'Facebook', 'YouTube'] // Default to these platforms
    } = await req.json();
    
    if (!professionalIds || !Array.isArray(professionalIds) || professionalIds.length === 0) {
      throw new Error('professionalIds array is required');
    }

    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN not configured');
    }

    console.log(`Starting social media search for ${professionalIds.length} professionals`);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch professionals to get their names
    const { data: professionals, error: profError } = await supabase
      .from('professionals')
      .select('id, name')
      .in('id', professionalIds);

    if (profError || !professionals || professionals.length === 0) {
      throw new Error(`Failed to fetch professionals: ${profError?.message || 'No records found'}`);
    }

    console.log(`Fetched ${professionals.length} professional records`);

    // Extract usernames from names (use first and last name combinations)
    const usernamesToSearch: string[] = [];
    const usernameToIdMap: { [key: string]: string } = {};

    professionals.forEach(prof => {
      // Generate potential usernames from name
      const nameParts = prof.name.toLowerCase().split(' ').filter(Boolean);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        
        // Common patterns for real estate agents
        const variations = [
          // LinkedIn-style (most common)
          `${firstName}-${lastName}`,
          `${firstName}${lastName}`,
          `${firstName}.${lastName}`,
          `${firstName}_${lastName}`,
          // With profession indicators
          `${firstName}-${lastName}-realtor`,
          `${firstName}-${lastName}-broker`,
          `${firstName}${lastName}realtor`,
          // First initial + last name
          `${firstName[0]}${lastName}`,
          `${firstName[0]}.${lastName}`,
          // Instagram/TikTok style
          `${firstName}.${lastName}.realtor`,
          `${firstName}_${lastName}_realestate`,
        ];
        
        variations.forEach(username => {
          usernamesToSearch.push(username);
          usernameToIdMap[username] = prof.id;
        });
      } else if (nameParts.length === 1) {
        usernamesToSearch.push(nameParts[0]);
        usernameToIdMap[nameParts[0]] = prof.id;
      }
    });

    console.log(`Generated ${usernamesToSearch.length} potential usernames to search`);

    // Process in batches
    const results: any[] = [];
    
    for (let i = 0; i < usernamesToSearch.length; i += batchSize) {
      const batch = usernamesToSearch.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} usernames`);

      // Configure actor to search specific platforms
      const actorInput: any = {
        usernames: batch,
        sites: limitToSites // Search LinkedIn, Instagram, TikTok, Facebook, YouTube
      };

      console.log(`Starting Apify actor xtech/social-media-finder-pro with ${batch.length} usernames`);

      // Use synchronous endpoint that returns dataset items directly
      // This is faster and simpler than polling
      const response = await fetch(
        'https://api.apify.com/v2/acts/xtech~social-media-finder-pro/run-sync-get-dataset-items',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APIFY_TOKEN}`,
          },
          body: JSON.stringify(actorInput),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Actor run failed: ${response.status} - ${errorText}`);
        continue; // Skip this batch but continue with others
      }

      const batchResults = await response.json();
      console.log(`Retrieved ${batchResults.length} results for batch`);
      
      results.push(...batchResults);
    }

    console.log(`Total results retrieved: ${results.length}`);

    // Process results and update professionals table
    const updatedProfessionals: any[] = [];

    for (const result of results) {
      const username = result.username;
      const professionalId = usernameToIdMap[username];

      if (!professionalId) {
        console.log(`No professional ID found for username: ${username}`);
        continue;
      }

      if (!result.accounts_found || result.accounts_found.length === 0) {
        console.log(`No social media accounts found for ${username}`);
        continue;
      }

      console.log(`Found ${result.total_found} accounts for ${username}`);

      // Extract social media URLs
      const updateData: any = {};
      const accountsFound = result.accounts_found;

      for (const account of accountsFound) {
        const site = account.site.toLowerCase();
        const url = account.url;

        if (site.includes('facebook')) {
          updateData.social_facebook = url;
        } else if (site.includes('instagram')) {
          updateData.social_instagram = url;
        } else if (site.includes('linkedin')) {
          updateData.social_linkedin = url;
        } else if (site.includes('twitter') || site.includes('x.com')) {
          updateData.social_twitter = url;
        } else if (site.includes('tiktok')) {
          updateData.social_tiktok = url;
        } else if (site.includes('youtube')) {
          // Store YouTube in a field - we need to add this to the DB schema if it doesn't exist
          // For now, log it
          console.log(`YouTube found for ${username}: ${url}`);
          // updateData.social_youtube = url; // Uncomment when DB field exists
        }
      }

      if (Object.keys(updateData).length === 0) {
        console.log(`No relevant social media platforms found for ${username}`);
        continue;
      }

      console.log(`Updating professional ${professionalId} with social links:`, updateData);

      // Update the professional record
      const { error: updateError } = await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', professionalId);

      if (updateError) {
        console.error(`Failed to update professional ${professionalId}:`, updateError);
      } else {
        console.log(`✓ Updated professional ${professionalId} with ${Object.keys(updateData).length} social links`);
        updatedProfessionals.push({
          id: professionalId,
          username,
          totalFound: result.total_found,
          socialLinks: updateData
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedUsernames: usernamesToSearch.length,
        resultsFound: results.length,
        professionalsUpdated: updatedProfessionals.length,
        details: updatedProfessionals
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in fetch-social-media-links:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
