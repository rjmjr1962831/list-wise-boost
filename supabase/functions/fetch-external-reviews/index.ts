import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReqBody {
  agentName: string;
  company?: string;
  location?: string;
}

interface ExternalReview {
  source: 'google' | 'yelp' | 'facebook' | 'other';
  reviewerName: string;
  reviewText: string;
  rating?: number;
  reviewDate?: string;
  url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentName, company, location }: ReqBody = await req.json();
    if (!agentName) throw new Error('agentName is required');

    const OUTSCRAPER_API_KEY = Deno.env.get('OUTSCRAPER_API_KEY');
    const reviews: ExternalReview[] = [];
    const sources: string[] = [];

    // Try Google Business reviews via Outscraper
    if (OUTSCRAPER_API_KEY) {
      try {
        const query = company ? `${company} ${location || ''}` : `${agentName} ${location || ''}`;
        console.log('Fetching Google reviews for:', query.trim());

        const params = new URLSearchParams({
          query: query.trim(),
          reviewsLimit: '5',
          language: 'en',
          async: 'false',
        });

        const resp = await fetch(
          `https://api.app.outscraper.com/maps/reviews-v3?${params}`,
          {
            method: 'GET',
            headers: {
              'X-API-KEY': OUTSCRAPER_API_KEY,
            },
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          console.log('Outscraper Google response:', JSON.stringify(data, null, 2));
          
          const places = Array.isArray(data?.data) ? data.data : [];
          for (const place of places) {
            const placeReviews = Array.isArray(place.reviews_data) ? place.reviews_data : [];
            for (const r of placeReviews.slice(0, 3)) {
              reviews.push({
                source: 'google',
                reviewerName: r.author_title || r.author || 'Reviewer',
                reviewText: r.review_text || r.text || '',
                rating: Number(r.review_rating ?? r.rating ?? 0),
                reviewDate: r.review_datetime_utc || r.review_timestamp || '',
                url: r.review_link || place.link || undefined,
              });
            }
          }
          if (reviews.length > 0) sources.push('Google');
        } else {
          console.warn('Outscraper Google API error:', resp.status, await resp.text());
        }
      } catch (e) {
        console.error('Error fetching Google reviews:', e);
      }
    }

    return new Response(
      JSON.stringify({ reviews, sources }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('fetch-external-reviews error:', error);
    return new Response(
      JSON.stringify({ reviews: [], sources: [], error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
