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
        const { data, error: functionError } = await supabase.functions.invoke('fetch-zillow-reviews', {
          body: { zuid, pageNumber: 1, pageSize: 10 }
        });

        if (functionError) throw functionError;

        if (data) {
          setReviews({
            reviews: data.reviews || [],
            totalReviews: data.totalReviews || 0,
            averageRating: data.averageRating || 0
          });
        }
      } catch (err) {
        console.error('Error fetching Zillow reviews:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [zuid]);

  return { reviews, loading, error };
};
