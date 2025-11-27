import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ZillowReview {
  reviewerName: string;
  reviewText: string;
  rating: number;
  reviewDate: string;
}

interface ZillowReviewsData {
  reviews: ZillowReview[];
  totalReviews: number;
  averageRating: number;
  profileUrl?: string;
}

export const useZillowReviews = (zuid: string | null, agentName?: string | null, market?: string | null, lazyLoad: boolean = false) => {
  const [reviews, setReviews] = useState<ZillowReviewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(!lazyLoad);

  useEffect(() => {
    if (!shouldFetch || (!zuid && !(agentName && market))) {
      setReviews(null);
      return;
    }

    const fetchReviews = async () => {
      setLoading(true);
      setError(null);

      try {
        // First, check if we have cached reviews in the database
        if (agentName) {
          const { data: professional } = await supabase
            .from('professionals')
            .select('reviews_data')
            .ilike('name', agentName)
            .single();

          if (professional?.reviews_data) {
            const reviewsData = professional.reviews_data as any;
            if (reviewsData.zillow_reviews && Array.isArray(reviewsData.zillow_reviews)) {
              // Check if cache is fresh (< 30 days)
              const fetchedAt = reviewsData.zillow_reviews_fetched_at 
                ? new Date(reviewsData.zillow_reviews_fetched_at)
                : null;
              
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

              if (fetchedAt && fetchedAt > thirtyDaysAgo) {
                console.log('Using cached Zillow reviews from database');
                
                // Map cached reviews to expected format
                const cachedReviews = reviewsData.zillow_reviews.map((review: any) => ({
                  reviewerName: review.reviewerName || 'Anonymous',
                  reviewText: review.text || review.reviewText || '',
                  rating: review.rating || 5,
                  reviewDate: review.createDate || review.reviewDate || new Date().toISOString()
                }));

                setReviews({
                  reviews: cachedReviews,
                  totalReviews: cachedReviews.length,
                  averageRating: cachedReviews.reduce((acc: number, r: any) => acc + r.rating, 0) / cachedReviews.length,
                  profileUrl: reviewsData.zillow_profile_url || (zuid ? `https://www.zillow.com/profile/${zuid}` : undefined)
                });
                setLoading(false);
                return;
              }
            }
          }
        }

        // No cache or stale cache - fetch from API
        // Discover ZUID/profile if missing
        let targetZuid: string | null = zuid || null;
        let discoveredProfileUrl: string | undefined;

        if (!targetZuid && agentName && market) {
          try {
            const parts = market.split(',');
            const city = parts[0]?.trim() || '';
            const state = parts[1]?.trim() || '';
            const { data: agentList, error: agentErr } = await supabase.functions.invoke('fetch-zillow-agents', {
              body: { city, state }
            });
            if (!agentErr && Array.isArray(agentList) && agentList.length) {
              const lowerName = agentName.toLowerCase();
              const candidate = agentList.find((a: any) => (a.fullName || a.name || '').toLowerCase().includes(lowerName)) || agentList[0];
              if (candidate) {
                // Prefer explicit ZUID
                targetZuid = candidate.zuid || null;
                // Build full profile URL if available
                if (candidate.profileLink) {
                  try {
                    const u = new URL(candidate.profileLink.startsWith('http') ? candidate.profileLink : `https://www.zillow.com${candidate.profileLink}`);
                    discoveredProfileUrl = u.toString();
                    // Try to extract zuid from URL params if not provided
                    if (!targetZuid) {
                      const paramZuid = u.searchParams.get('zuid');
                      if (paramZuid) targetZuid = paramZuid;
                    }
                  } catch {}
                }
              }
            }
          } catch (e) {
            console.warn('Zillow profile discovery failed:', e);
          }
        }

        // Try Apify first using discovered ZUID when available
        console.log('Attempting to fetch reviews from Apify...');
        const { data: apifyData, error: apifyError } = await supabase.functions.invoke('fetch-apify-zillow-reviews', {
          body: { zuid: targetZuid, agentName, location: market }
        });

        if (!apifyError && apifyData && apifyData.reviews && apifyData.reviews.length > 0) {
          console.log('Successfully fetched reviews from Apify');
          setReviews({
            reviews: apifyData.reviews || [],
            totalReviews: apifyData.totalReviews || 0,
            averageRating: apifyData.averageRating || 0,
            profileUrl: apifyData.profileUrl || discoveredProfileUrl || (targetZuid ? `https://www.zillow.com/profile/${targetZuid}` : undefined),
          });
          return;
        }

        // If Apify returned no reviews but we discovered a profile, keep the link
        if (!apifyError && (apifyData?.profileUrl || discoveredProfileUrl || targetZuid)) {
          setReviews({
            reviews: [],
            totalReviews: apifyData?.totalReviews || 0,
            averageRating: apifyData?.averageRating || 0,
            profileUrl: apifyData?.profileUrl || discoveredProfileUrl || (targetZuid ? `https://www.zillow.com/profile/${targetZuid}` : undefined),
          });
          // Do not return yet; still try Rapid below with ZUID if available
        }

        // Only use Apify - no more RapidAPI fallback
        const effectiveZuid = targetZuid || zuid;
        if (!effectiveZuid && !(apifyData && apifyData.reviews && apifyData.reviews.length > 0)) {
          // If we discovered a profile URL but no reviews, still show the profile link
          if (discoveredProfileUrl || targetZuid) {
            setReviews({
              reviews: [],
              totalReviews: 0,
              averageRating: 0,
              profileUrl: discoveredProfileUrl || (targetZuid ? `https://www.zillow.com/profile/${targetZuid}` : undefined),
            });
          }
        }
      } catch (err) {
        console.error('Error fetching Zillow reviews from Apify:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [shouldFetch, zuid, agentName, market]);

  return { reviews, loading, error, triggerFetch: () => setShouldFetch(true) };
};
