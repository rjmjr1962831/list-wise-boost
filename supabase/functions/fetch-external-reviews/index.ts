import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReqBody {
  agentName: string;
  company?: string;
  location?: string;
  professionalId?: string;
}

interface ExternalReview {
  source: 'google' | 'yelp' | 'facebook' | 'zillow' | 'other';
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
    const { agentName, company, location, professionalId }: ReqBody = await req.json();
    if (!agentName) throw new Error('agentName is required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first if professionalId provided
    if (professionalId) {
      const { data: professional } = await supabase
        .from('professionals')
        .select('reviews_data')
        .eq('id', professionalId)
        .single();

      const cachedReviews = professional?.reviews_data?.external_reviews;
      const fetchedAt = professional?.reviews_data?.external_reviews_fetched_at;
      
      if (cachedReviews && Array.isArray(cachedReviews) && cachedReviews.length > 0 && fetchedAt) {
        const cacheAge = Date.now() - new Date(fetchedAt).getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        // Return cached reviews if less than 30 days old
        if (cacheAge < thirtyDays) {
          console.log(`Serving cached reviews for professional ${professionalId} (${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days old)`);
          return new Response(
            JSON.stringify({
              reviews: cachedReviews,
              sources: professional.reviews_data.external_sources || ['Google'],
              cached: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

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

    // ============================================
    // SUPPLEMENT WITH ZILLOW REVIEWS IF NEEDED
    // ============================================
    const googleReviewCount = reviews.length;
    if (googleReviewCount < 3 && professionalId) {
      console.log(`Only ${googleReviewCount} Google reviews found. Attempting to supplement with Zillow reviews...`);
      
      try {
        // Fetch professional data to get zillow_profile_url and zuid
        const { data: professional } = await supabase
          .from('professionals')
          .select('zillow_profile_url, zuid, name')
          .eq('id', professionalId)
          .single();

        if (professional?.zuid || professional?.zillow_profile_url) {
          console.log(`Fetching Zillow reviews for ${professional.name} (ZUID: ${professional.zuid})`);
          
          // Construct profile URL from ZUID or use existing zillow_profile_url
          const profileUrl = professional.zillow_profile_url || 
            (professional.zuid ? `https://www.zillow.com/profile/${professional.zuid}` : null);
          
          if (!profileUrl) {
            console.log('❌ Could not construct Zillow profile URL - missing ZUID and zillow_profile_url');
          } else {
            console.log(`📞 Calling fetch-apify-zillow-cheerio with profileUrls: [${profileUrl}]`);
            // Call the fetch-apify-zillow-cheerio function to get Zillow reviews
            const { data: zillowData, error: zillowError } = await supabase.functions.invoke(
              'fetch-apify-zillow-cheerio',
              {
                body: {
                  profileUrls: [profileUrl],
                  professionalIds: [professionalId]
                }
              }
            );

            if (!zillowError && zillowData?.reviews && Array.isArray(zillowData.reviews)) {
              const zillowReviews = zillowData.reviews;
              console.log(`Retrieved ${zillowReviews.length} Zillow reviews`);
              
              // Calculate how many Zillow reviews we need to add
              const neededCount = Math.min(3 - googleReviewCount, zillowReviews.length);
              
              // Add Zillow reviews to supplement Google reviews
              for (let i = 0; i < neededCount; i++) {
                const zr = zillowReviews[i];
                reviews.push({
                  source: 'zillow',
                  reviewerName: zr.reviewerName || 'Zillow Reviewer',
                  reviewText: zr.reviewText || '',
                  rating: zr.rating || 0,
                  reviewDate: zr.reviewDate || '',
                  url: zillowData.profileUrl || (professional.zuid ? `https://www.zillow.com/profile/${professional.zuid}` : undefined),
                });
              }
              
              if (neededCount > 0) {
                sources.push('Zillow');
                console.log(`✅ Added ${neededCount} Zillow reviews to supplement Google reviews. Total: ${reviews.length}`);
              }
            } else {
              console.log('No Zillow reviews available or error fetching them');
            }
          }
        } else {
          console.log('No Zillow ZUID or profile URL available for this professional');
        }
      } catch (zillowErr) {
        console.error('Error supplementing with Zillow reviews:', zillowErr);
        // Continue without Zillow reviews
      }
    } else if (googleReviewCount >= 3) {
      console.log(`✅ Have ${googleReviewCount} Google reviews, no need to supplement with Zillow`);
    }

    // Store reviews in database if professionalId provided
    if (professionalId && reviews.length > 0) {
      try {
        const { error: updateError } = await supabase
          .from('professionals')
          .update({
            reviews_data: {
              external_reviews: reviews,
              external_sources: sources,
              external_reviews_fetched_at: new Date().toISOString()
            }
          })
          .eq('id', professionalId);

        if (updateError) {
          console.error('Failed to store external reviews:', updateError);
        } else {
          console.log(`Stored ${reviews.length} external reviews for professional ${professionalId}`);
        }
      } catch (storeError) {
        console.error('Error storing reviews in database:', storeError);
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
