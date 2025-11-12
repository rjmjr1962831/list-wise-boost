import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutscraperRequest {
  profileUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl }: OutscraperRequest = await req.json();
    
    if (!profileUrl) {
      throw new Error('profileUrl is required');
    }

    const apiKey = Deno.env.get('OUTSCRAPER_API_KEY');
    if (!apiKey) {
      throw new Error('OUTSCRAPER_API_KEY not configured');
    }

    console.log('Starting Outscraper scrape for:', profileUrl);

    // Step 1: Start the scraping task
    const taskResponse = await fetch('https://api.app.outscraper.com/maps/search-v2', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: [profileUrl],
        language: 'en',
        region: 'us'
      })
    });

    if (!taskResponse.ok) {
      const errorText = await taskResponse.text();
      console.error('Failed to start Outscraper task:', errorText);
      throw new Error(`Failed to start scraping: ${taskResponse.statusText}`);
    }

    const taskData = await taskResponse.json();
    const taskId = taskData.id;

    console.log('Outscraper task started with ID:', taskId);

    // Step 2: Poll for results (max 60 attempts = 5 minutes)
    let status = 'Pending';
    let attempts = 0;
    const maxAttempts = 60;

    while (status === 'Pending' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(
        `https://api.app.outscraper.com/requests/${taskId}`,
        {
          headers: {
            'X-API-KEY': apiKey
          }
        }
      );

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('Failed to check Outscraper status:', errorText);
        throw new Error(`Failed to check status: ${statusResponse.statusText}`);
      }

      const statusData = await statusResponse.json();
      status = statusData.status;
      
      console.log(`Outscraper status: ${status} (Attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
    }

    if (status !== 'Success') {
      throw new Error(`Scraping failed with status: ${status}`);
    }

    // Step 3: Get the results
    const resultsResponse = await fetch(
      `https://api.app.outscraper.com/requests/${taskId}`,
      {
        headers: {
          'X-API-KEY': apiKey
        }
      }
    );

    if (!resultsResponse.ok) {
      const errorText = await resultsResponse.text();
      console.error('Failed to fetch Outscraper results:', errorText);
      throw new Error(`Failed to fetch results: ${resultsResponse.statusText}`);
    }

    const resultsData = await resultsResponse.json();
    const rawData = resultsData.data;

    console.log('Raw Outscraper data:', JSON.stringify(rawData, null, 2));

    if (!rawData || rawData.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No data returned from Outscraper',
          stats: null
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 4: Format the data
    const agent = rawData[0]; // Get first result
    
    const stats = {
      forSale: agent.listings_count || 0,
      sold: agent.sales_count || agent.total_sales || 0,
      forRent: 0, // Outscraper doesn't provide this
      reviews: agent.reviews || agent.reviews_count || 0,
      currentListings: agent.listings_count || 0,
      totalSales: agent.sales_count || agent.total_sales || 0,
      yearsExperience: 0, // Outscraper doesn't provide this directly
    };

    console.log('Formatted stats:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        source: 'outscraper',
        rawData: agent
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in fetch-outscraper-agent-stats:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: null
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
