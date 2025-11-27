import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ExternalReview {
  source: 'google' | 'yelp' | 'facebook' | 'zillow' | 'other';
  reviewerName: string;
  reviewText: string;
  rating?: number;
  reviewDate?: string;
  url?: string;
}

export interface ExternalReviewsResult {
  reviews: ExternalReview[];
  sources: string[]; // e.g., ['google']
}

export function useExternalReviews({
  agentName,
  company,
  market,
  professionalId,
}: {
  agentName: string;
  company?: string | null;
  market?: string | null;
  professionalId?: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['external-reviews', professionalId || agentName],
    queryFn: async () => {
      // First, check if reviews are already in the database
      if (professionalId) {
        const { data: professional, error: dbError } = await supabase
          .from('professionals')
          .select('reviews_data')
          .eq('id', professionalId)
          .maybeSingle();

        if (!dbError && professional?.reviews_data) {
          const reviewsData = professional.reviews_data as any;
          if (reviewsData.external_reviews && Array.isArray(reviewsData.external_reviews)) {
            console.log('Using cached external reviews from database');
            return {
              reviews: reviewsData.external_reviews,
              sources: reviewsData.external_sources || ['google']
            } as ExternalReviewsResult;
          }
        }
      }

      // If not in database, fetch from Outscraper and store
      console.log('Fetching external reviews from Outscraper...');
      const { data: resp, error: err } = await supabase.functions.invoke('fetch-external-reviews', {
        body: {
          agentName,
          company: company || undefined,
          location: market || undefined,
          professionalId: professionalId || undefined,
        },
      });

      if (err) throw err;
      return resp as ExternalReviewsResult;
    },
    enabled: !!agentName && !!market,
    staleTime: Infinity, // Never refetch automatically
    gcTime: Infinity, // Keep in cache forever
  });

  return { 
    data: data || null, 
    loading: isLoading, 
    error: error?.message || null 
  };
}
