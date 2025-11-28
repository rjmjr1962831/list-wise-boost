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
  lastFetched?: string | null; // Timestamp of most recent fetch (external or zillow)
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
          let lastFetched: string | null = null;

          // Check for cached external reviews (Google/Yelp) WITH timestamp validation
          if (reviewsData.external_reviews && Array.isArray(reviewsData.external_reviews)) {
            const fetchedAt = reviewsData.external_reviews_fetched_at 
              ? new Date(reviewsData.external_reviews_fetched_at)
              : null;
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (fetchedAt && fetchedAt > thirtyDaysAgo) {
              console.log('Using cached external reviews from database (fresh within 30 days)');
              allReviews = [...reviewsData.external_reviews];
              sources = reviewsData.external_sources || ['google'];
              lastFetched = reviewsData.external_reviews_fetched_at;
            } else {
              console.log('Cached external reviews are stale (>30 days), will fetch fresh data');
            }
          }

          // Also include Zillow reviews from database WITH timestamp validation
          if (reviewsData.zillow_reviews && Array.isArray(reviewsData.zillow_reviews)) {
            const zillowFetchedAt = reviewsData.zillow_reviews_fetched_at
              ? new Date(reviewsData.zillow_reviews_fetched_at)
              : null;
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (zillowFetchedAt && zillowFetchedAt > thirtyDaysAgo) {
              console.log(`Including ${reviewsData.zillow_reviews.length} cached Zillow reviews from database (fresh within 30 days)`);
              
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
              // Use the most recent fetch timestamp
              const zillowTimestamp = reviewsData.zillow_reviews_fetched_at;
              if (!lastFetched || (zillowTimestamp && new Date(zillowTimestamp) > new Date(lastFetched))) {
                lastFetched = zillowTimestamp;
              }
            } else {
              console.log('Cached Zillow reviews are stale (>30 days), will fetch fresh data if needed');
            }
          }

          // Return combined reviews if we found any
          if (allReviews.length > 0) {
            return {
              reviews: allReviews,
              sources: sources,
              lastFetched: lastFetched
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
    staleTime: 1000 * 60 * 60 * 24 * 30, // 30 days - matches database cache policy
    gcTime: 1000 * 60 * 60 * 24 * 31, // 31 days - slightly longer retention
  });

  return { 
    data: data || null, 
    loading: isLoading, 
    error: error?.message || null 
  };
}
