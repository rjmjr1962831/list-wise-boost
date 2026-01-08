import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ComputePriceResponse, QuoteCartResponse } from '@/types/neighborhoodPricing';

interface UseNeighborhoodPricingReturn {
  computePrice: (neighborhoodId: string) => Promise<ComputePriceResponse>;
  quoteCart: (neighborhoodIds: string[]) => Promise<QuoteCartResponse>;
  isComputing: boolean;
  error: string | null;
}

export function useNeighborhoodPricing(): UseNeighborhoodPricingReturn {
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computePrice = useCallback(async (neighborhoodId: string): Promise<ComputePriceResponse> => {
    setIsComputing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('compute-neighborhood-price', {
        body: { neighborhood_id: neighborhoodId }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as ComputePriceResponse;
    } catch (err: any) {
      console.error('[useNeighborhoodPricing] computePrice error:', err);
      setError(err.message || 'Failed to compute price');
      throw err;
    } finally {
      setIsComputing(false);
    }
  }, []);

  const quoteCart = useCallback(async (neighborhoodIds: string[]): Promise<QuoteCartResponse> => {
    setIsComputing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('quote-neighborhood-cart', {
        body: { neighborhood_ids: neighborhoodIds }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as QuoteCartResponse;
    } catch (err: any) {
      console.error('[useNeighborhoodPricing] quoteCart error:', err);
      setError(err.message || 'Failed to quote cart');
      throw err;
    } finally {
      setIsComputing(false);
    }
  }, []);

  return {
    computePrice,
    quoteCart,
    isComputing,
    error
  };
}
