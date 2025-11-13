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
}

export const useZillowReviews = (zuid: string | null) => {
  const [reviews, setReviews] = useState<ZillowReviewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zuid) {
      setReviews(null);
      return;
    }

    const fetchReviews = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try Apify first
        console.log('Attempting to fetch reviews from Apify...');
        const { data: apifyData, error: apifyError } = await supabase.functions.invoke('fetch-apify-zillow-reviews', {
          body: { zuid }
        });

        if (!apifyError && apifyData && apifyData.reviews && apifyData.reviews.length > 0) {
          console.log('Successfully fetched reviews from Apify');
          setReviews({
            reviews: apifyData.reviews || [],
            totalReviews: apifyData.totalReviews || 0,
            averageRating: apifyData.averageRating || 0
          });
          return;
        }

        // Fallback to RapidAPI
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
      } catch (err) {
        console.error('Error fetching Zillow reviews from both sources:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [zuid]);

  return { reviews, loading, error };
};
