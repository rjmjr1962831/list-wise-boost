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

export const useZillowReviews = (zuid: string | null, agentName?: string | null, market?: string | null) => {
  const [reviews, setReviews] = useState<ZillowReviewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zuid && !(agentName && market)) {
      setReviews(null);
      return;
    }

    const fetchReviews = async () => {
      setLoading(true);
      setError(null);

      try {
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
            profileUrl: apifyData.profileUrl || undefined,
          });
          return;
        }

        // Fallback to RapidAPI only if we have a ZUID
        if (zuid) {
          console.log('Apify failed, falling back to RapidAPI...');
          const { data: rapidData, error: rapidError } = await supabase.functions.invoke('fetch-zillow-reviews', {
            body: { zuid, pageNumber: 1, pageSize: 10 }
          });

          if (rapidError) throw rapidError;

          if (rapidData) {
            console.log('Successfully fetched reviews from RapidAPI');
            setReviews({
              reviews: rapidData.reviews || [],
              totalReviews: rapidData.totalReviews || 0,
              averageRating: rapidData.averageRating || 0
            });
          }
        }
      } catch (err) {
        console.error('Error fetching Zillow reviews from both sources:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [zuid, agentName, market]);

  return { reviews, loading, error };
};
