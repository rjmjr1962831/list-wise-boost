import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetDataForMeRequest {
  profileUrl: string;
  apifyApiKey?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl, apifyApiKey }: GetDataForMeRequest = await req.json();

    if (!profileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = apifyApiKey || Deno.env.get('APIFY_API_TOKEN');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apify API token not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting GetDataForMe scraper for:', profileUrl);

    // Start the actor run
    const actorId = 'getdataforme/zillow-agents-reviews-scraper';
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_url: profileUrl,
          itemLimit: 50,
          proxyConfiguration: {
            useApifyProxy: false
          }
        })
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start actor:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to start scraper: ${runResponse.statusText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    console.log(`Run started: ${runId}`);

    // Poll for completion (max 5 minutes)
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 60;

    while ((status === 'RUNNING' || status === 'READY') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apiKey}`
      );
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        status = statusData.data.status;
        attempts++;
        console.log(`Status: ${status} (attempt ${attempts}/${maxAttempts})`);
      } else {
        attempts++;
      }
    }

    if (status !== 'SUCCEEDED') {
      console.error(`Run did not complete successfully: ${status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Scraper run failed: ${status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`
    );

    if (!resultsResponse.ok) {
      console.error('Failed to fetch results');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawData = await resultsResponse.json();
    console.log(`Got ${rawData.length} items from dataset`);

    if (!rawData || rawData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, stats: null, reviews: [], message: 'No data found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format the data
    const firstItem = rawData[0];
    
    const formattedData = {
      success: true,
      stats: {
        fullName: firstItem.agent_name || null,
        brokerage: firstItem.company_name || firstItem.brokerage || null,
        starRating: parseFloat(firstItem.agent_rating || firstItem.rating) || null,
        totalReviews: rawData.length,
        phoneNumber: firstItem.phone || firstItem.phone_number || null,
        email: firstItem.email || null,
        yearsExperience: firstItem.years_of_experience || null,
        bio: firstItem.bio || firstItem.description || null,
        specialties: firstItem.specialties || [],
        currentListings: firstItem.current_listings || null,
        totalSales: firstItem.total_sales || null,
      },
      reviews: rawData.map((review: any) => ({
        reviewerName: review.reviewer_name || 'Anonymous',
        text: review.review_text || review.review_comment || '',
        date: review.review_date || review.date || '',
        rating: parseFloat(review.rating) || 0,
        dealType: review.deal_type || '',
        propertyType: review.property_type || '',
        verified: review.verified || false
      })),
      rawDataSample: firstItem // For debugging
    };

    console.log('Successfully formatted agent data with', formattedData.reviews.length, 'reviews');

    return new Response(
      JSON.stringify(formattedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-getdataforme-agent-stats:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
