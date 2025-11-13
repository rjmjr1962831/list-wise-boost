import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { zuid, pageNumber = 1, pageSize = 10 } = await req.json();
    
    if (!zuid) {
      throw new Error('ZUID is required');
    }

    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')?.trim();
    const RAPIDAPI_HOST = Deno.env.get('RAPIDAPI_HOST')?.trim();

    if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
      throw new Error('RapidAPI credentials not configured');
    }

    console.log(`Fetching reviews for ZUID: ${zuid}, requesting ${pageSize} reviews`);

    // Fetch multiple pages if needed to get the requested number of reviews
    const allReviews: any[] = [];
    let currentPage = pageNumber;
    let totalReviews = 0;
    let averageRating = 0;

    // Fetch up to 10 pages to get at least 10 reviews
    while (allReviews.length < pageSize && currentPage < pageNumber + 10) {
      console.log(`Fetching page ${currentPage}`);
      
      const response = await fetch(
        `https://${RAPIDAPI_HOST}/?data_type=find_reviews&zuid=${encodeURIComponent(zuid)}&page_number=${currentPage}`,
        {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': RAPIDAPI_HOST,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('RapidAPI error:', response.status, errorText);
        throw new Error(`RapidAPI request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Page ${currentPage} - Reviews count:`, data?.reviews?.length || 0);
      
      if (data.reviews && data.reviews.length > 0) {
        allReviews.push(...data.reviews);
        totalReviews = data.totalReviews || totalReviews;
        averageRating = data.averageRating || averageRating;
      } else {
        // No more reviews available
        break;
      }

      currentPage++;
    }

    console.log(`Total reviews fetched: ${allReviews.length}`);

    const result = {
      reviews: allReviews.slice(0, pageSize),
      totalReviews,
      averageRating
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-zillow-reviews function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
