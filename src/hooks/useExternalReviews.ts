import { useEffect, useState } from 'react';
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
  const [data, setData] = useState<ExternalReviewsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentName || !market) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        // External reviews deprecated - only using Zillow reviews via getdataforme
        const resp = { reviews: [], sources: [] };
        const err = null;
        if (err) throw err;
        if (resp) setData(resp);
      } catch (e: any) {
        setError(e?.message || 'Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [agentName, company, market]);

  return { data, loading, error };
}
