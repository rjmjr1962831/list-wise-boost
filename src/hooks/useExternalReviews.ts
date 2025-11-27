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
          let allReviews: ExternalReview[] = [];
          let sources: string[] = [];

          // Check for cached external reviews (Google/Yelp)
          if (reviewsData.external_reviews && Array.isArray(reviewsData.external_reviews)) {
            console.log('Using cached external reviews from database');
            allReviews = [...reviewsData.external_reviews];
            sources = reviewsData.external_sources || ['google'];
          }

          // Also include Zillow reviews from database
          if (reviewsData.zillow_reviews && Array.isArray(reviewsData.zillow_reviews)) {
            console.log(`Including ${reviewsData.zillow_reviews.length} cached Zillow reviews from database`);
            
            const mappedZillowReviews: ExternalReview[] = reviewsData.zillow_reviews.map((zr: any) => {
              // Get reviewer name: prefer firstName+lastName, fallback to screenName
              let reviewerName = 'Zillow User';
              if (zr.reviewer) {
                if (zr.reviewer.firstName && zr.reviewer.lastName) {
                  reviewerName = `${zr.reviewer.firstName} ${zr.reviewer.lastName}`;
                } else if (zr.reviewer.screenName) {
                  reviewerName = zr.reviewer.screenName;
                }
              }
              
              return {
                source: 'zillow' as const,
                reviewerName,
                reviewText: zr.reviewComment || '',
                rating: zr.rating,
                reviewDate: zr.createDate, // Already in ISO format
              };
            });
            
            allReviews = [...allReviews, ...mappedZillowReviews];
            if (!sources.includes('zillow')) {
              sources.push('zillow');
            }
          }

          // Return combined reviews if we found any
          if (allReviews.length > 0) {
            return {
              reviews: allReviews,
              sources: sources
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
    staleTime: 1000 * 60 * 30, // 30 minutes - allows fresh data after enrichment
    gcTime: 1000 * 60 * 60, // 1 hour - reasonable cache retention
  });

  return { 
    data: data || null, 
    loading: isLoading, 
    error: error?.message || null 
  };
}
