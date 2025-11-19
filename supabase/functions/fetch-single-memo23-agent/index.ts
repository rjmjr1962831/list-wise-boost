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
    const { professionalId } = await req.json();

    if (!professionalId) {
      throw new Error('professionalId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get professional record
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', professionalId)
      .single();

    if (profError || !professional) {
      throw new Error(`Professional not found: ${profError?.message}`);
    }

    if (!professional.zillow_profile_url) {
      throw new Error('No Zillow profile URL found for this professional');
    }

    console.log(`Fetching memo23 data for: ${professional.name} - ${professional.zillow_profile_url}`);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    const actorId = 'memo23~apify-zillow-agents-cheerio';
    const actorInput = {
      startUrls: [{ url: professional.zillow_profile_url }],
      maxConcurrency: 1,
      proxyConfiguration: { useApifyProxy: true }
    };

    // Start the run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput)
      }
    );

    if (!runResponse.ok) {
      throw new Error('Failed to start Apify run');
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    
    // Poll for completion (max 60 seconds)
    let attempts = 0;
    const maxAttempts = 60;
    let runStatus = 'RUNNING';
    let agentData = null;

    while (attempts < maxAttempts && runStatus === 'RUNNING') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apifyToken}`
      );
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        runStatus = statusData.data.status;
        
        if (runStatus === 'SUCCEEDED') {
          const datasetId = statusData.data.defaultDatasetId;
          const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
          );
          
          if (datasetResponse.ok) {
            const results = await datasetResponse.json();
            if (results && results.length > 0) {
              agentData = results[0];
              console.log('Successfully fetched memo23 data');
            }
          }
          break;
        }
      }
      attempts++;
    }

    if (!agentData) {
      throw new Error('Failed to fetch agent data from memo23');
    }

    // Map memo23 fields to database columns
    const updateData: any = {
      zillow_data_fetched_at: new Date().toISOString(),
    };
    
    if (agentData.name) updateData.name = agentData.name;
    if (agentData.screenName) updateData.screen_name = agentData.screenName;
    if (agentData.encodedZuid) {
      updateData.encoded_zuid = agentData.encodedZuid;
      updateData.zuid = agentData.encodedZuid;
    }
    if (agentData.sidebarVideoUrl) updateData.sidebar_video_url = agentData.sidebarVideoUrl;
    if (agentData.businessAddress) {
      updateData.business_address = agentData.businessAddress;
      if (agentData.businessAddress.postalCode) {
        updateData.zip_code = agentData.businessAddress.postalCode;
      }
      const addrParts = [
        agentData.businessAddress.address1,
        agentData.businessAddress.city,
        agentData.businessAddress.state,
        agentData.businessAddress.postalCode
      ].filter(Boolean);
      if (addrParts.length > 0) {
        updateData.address = addrParts.join(', ');
      }
    }
    if (agentData.businessName) {
      updateData.business_name = agentData.businessName;
      updateData.company = agentData.businessName;
    }
    if (agentData.profilePhotoSrc) updateData.image_url = agentData.profilePhotoSrc;
    if (agentData.ratings) updateData.ratings = agentData.ratings;
    if (agentData.phoneNumbers) {
      updateData.phone_numbers = agentData.phoneNumbers;
      if (agentData.phoneNumbers.cell) updateData.phone = agentData.phoneNumbers.cell;
    }
    if (agentData.agentLicenses) {
      updateData.agent_licenses = agentData.agentLicenses;
      if (agentData.agentLicenses.length > 0 && agentData.agentLicenses[0].text) {
        updateData.license_number = agentData.agentLicenses[0].text;
      }
    }
    if (agentData.agentSalesStats) {
      updateData.agent_sales_stats = agentData.agentSalesStats;
      if (agentData.agentSalesStats.countAllTime) {
        updateData.total_sales = agentData.agentSalesStats.countAllTime;
      }
    }
    if (agentData.professionalInformation) {
      updateData.professional_information = agentData.professionalInformation;
    }
    if (agentData.professionalData) {
      updateData.professional_data = agentData.professionalData;
    }
    // Rewrite bio if present to make it unique
    if (agentData.getToKnowMe) {
      try {
        console.log('Rewriting bio to make it unique...');

        // Handle both plain string and JSON-stringified bio objects
        let originalBio: string = agentData.getToKnowMe;
        let parsedBio: any | null = null;

        if (typeof originalBio === 'string') {
          try {
            const maybeJson = JSON.parse(originalBio);
            if (maybeJson && typeof maybeJson === 'object' && maybeJson.description) {
              parsedBio = maybeJson;
              // Strip HTML from description to get plain text
              const htmlContent = maybeJson.description;
              // Simple HTML tag removal using regex
              originalBio = htmlContent
                .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
                .replace(/&amp;/g, '&')     // Decode HTML entities
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, ' ')       // Collapse multiple spaces
                .trim();
            }
          } catch {
            // Not JSON, keep as-is
          }
        }

        console.log('Sending bio to rewrite-bio function, length:', originalBio.length);

        const rewriteResponse = await fetch(`${supabaseUrl}/functions/v1/rewrite-bio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ originalBio }),
        });

        let rewrittenBio: string | null = null;

        if (rewriteResponse.ok) {
          const rewriteData = await rewriteResponse.json();
          if (rewriteData?.rewrittenBio && typeof rewriteData.rewrittenBio === 'string') {
            console.log('Bio rewritten successfully');
            rewrittenBio = rewriteData.rewrittenBio;
          }
        } else {
          console.error('Bio rewrite HTTP error:', rewriteResponse.status, await rewriteResponse.text());
        }

        const finalBio = rewrittenBio || originalBio;

        // Always save as plain text, not wrapped in JSON
        updateData.get_to_know_me = finalBio;
        updateData.description = finalBio;
      } catch (rewriteError) {
        console.error('Bio rewrite exception:', rewriteError);
        // Fallback to original
        updateData.get_to_know_me = agentData.getToKnowMe;
        updateData.description = agentData.getToKnowMe;
      }
    }
    if (agentData.emailAddress) updateData.email = agentData.emailAddress;
    if (agentData.numTotalReviews) updateData.num_total_reviews = agentData.numTotalReviews;

    // Update the professional record
    const { error: updateError } = await supabase
      .from('professionals')
      .update(updateData)
      .eq('id', professionalId);

    if (updateError) {
      throw new Error(`Failed to update professional: ${updateError.message}`);
    }

    console.log(`Updated professional ${professional.name} with memo23 data`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        professional: professional.name,
        sidebarVideoUrl: agentData.sidebarVideoUrl || null,
        updatedFields: Object.keys(updateData)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});