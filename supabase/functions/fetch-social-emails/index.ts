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
      batchSize = 10
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

    console.log(`Starting social media email scraper for ${professionalIds.length} professionals`);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch professionals to get their social media URLs
    const { data: professionals, error: profError } = await supabase
      .from('professionals')
      .select('id, name, social_facebook, social_instagram, social_linkedin, social_twitter, social_tiktok, email')
      .in('id', professionalIds);

    if (profError || !professionals || professionals.length === 0) {
      throw new Error(`Failed to fetch professionals: ${profError?.message || 'No records found'}`);
    }

    console.log(`Fetched ${professionals.length} professional records`);

    // Build requests for the actor - one per social media profile
    const requests: Array<{ professionalId: string; platform: string; url: string }> = [];

    professionals.forEach(prof => {
      if (prof.social_linkedin) {
        requests.push({ professionalId: prof.id, platform: 'linkedin', url: prof.social_linkedin });
      }
      if (prof.social_instagram) {
        requests.push({ professionalId: prof.id, platform: 'instagram', url: prof.social_instagram });
      }
      if (prof.social_tiktok) {
        requests.push({ professionalId: prof.id, platform: 'tiktok', url: prof.social_tiktok });
      }
      if (prof.social_facebook) {
        requests.push({ professionalId: prof.id, platform: 'facebook', url: prof.social_facebook });
      }
      if (prof.social_twitter) {
        requests.push({ professionalId: prof.id, platform: 'twitter', url: prof.social_twitter });
      }
    });

    console.log(`Generated ${requests.length} social media profile requests`);

    if (requests.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No social media profiles found for the provided professionals',
          professionalsUpdated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process in batches to avoid rate limits
    const results: any[] = [];
    const updatedProfessionals = new Map<string, { emails: string[] }>();

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} profiles`);

      // Process each profile in the batch
      for (const request of batch) {
        console.log(`Scraping ${request.platform} for professional ${request.professionalId}`);

        const actorInput = {
          platform: request.platform,
          url: request.url
        };

        try {
          // Use synchronous endpoint that returns dataset items directly
          const response = await fetch(
            'https://api.apify.com/v2/acts/chitosibug3~social-media-email-scraper-2026/run-sync-get-dataset-items',
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
            console.error(`Failed to scrape ${request.platform}: ${response.status} - ${errorText}`);
            continue;
          }

          const result = await response.json();
          console.log(`Result for ${request.platform}:`, JSON.stringify(result));

          // Extract email from result
          if (result && result.length > 0 && result[0].email) {
            const email = result[0].email;
            console.log(`✓ Found email for ${request.platform}: ${email}`);

            // Track emails per professional
            if (!updatedProfessionals.has(request.professionalId)) {
              updatedProfessionals.set(request.professionalId, { emails: [] });
            }
            updatedProfessionals.get(request.professionalId)!.emails.push(email);

            results.push({
              professionalId: request.professionalId,
              platform: request.platform,
              email,
              url: request.url
            });
          } else {
            console.log(`No email found for ${request.platform}`);
          }
        } catch (error) {
          console.error(`Error processing ${request.platform}:`, error);
        }

        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Found ${results.length} emails across ${updatedProfessionals.size} professionals`);

    // Update professionals with discovered emails (if they don't already have one)
    for (const [professionalId, data] of updatedProfessionals.entries()) {
      // Get the professional to check if they already have an email
      const professional = professionals.find(p => p.id === professionalId);
      
      // Only update if they don't have an email, or if the new email is different
      if (professional && (!professional.email || data.emails.length > 0)) {
        // Use the first email found (could be from any platform)
        const newEmail = data.emails[0];
        
        if (!professional.email || professional.email !== newEmail) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({
              email: newEmail,
              email_verified_at: new Date().toISOString() // Mark as verified since it came from social media
            })
            .eq('id', professionalId);

          if (updateError) {
            console.error(`Failed to update professional ${professionalId}:`, updateError);
          } else {
            console.log(`✓ Updated email for professional ${professionalId}: ${newEmail}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        profilesScraped: requests.length,
        emailsFound: results.length,
        professionalsUpdated: updatedProfessionals.size,
        details: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in fetch-social-emails:', error);
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
