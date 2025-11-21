import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ExternalReview {
  source: 'google' | 'yelp' | 'facebook' | 'other';
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
}: {
  agentName: string;
  company?: string | null;
  market?: string | null;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['external-reviews', agentName, company, market],
    queryFn: async () => {
      const { data: resp, error: err } = await supabase.functions.invoke('fetch-external-reviews', {
        body: {
          agentName,
          company: company || undefined,
          location: market || undefined,
        },
      });

      if (err) throw err;
      return resp as ExternalReviewsResult;
    },
    enabled: !!agentName && !!market,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  return { 
    data: data || null, 
    loading: isLoading, 
    error: error?.message || null 
  };
}
