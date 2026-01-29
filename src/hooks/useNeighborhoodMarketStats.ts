import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NeighborhoodMarketStats } from "@/types/neighborhoodMarketStats";

export const useNeighborhoodMarketStats = (
  neighborhoodSlug: string | undefined,
  state?: string
) => {
  return useQuery({
    queryKey: ['neighborhood-market-stats', state, neighborhoodSlug],
    queryFn: async (): Promise<NeighborhoodMarketStats | null> => {
      if (!neighborhoodSlug) return null;

      // Try state-aware format first (new format: neighborhood-{state}-{slug})
      if (state) {
        const statePageKey = `neighborhood-${state.toLowerCase()}-${neighborhoodSlug}`;
        
        const { data: stateData, error: stateError } = await supabase
          .from('marketing_content')
          .select('value')
          .eq('page', statePageKey)
          .eq('section', 'market_stats')
          .eq('key', 'full_content')
          .maybeSingle();

        if (!stateError && stateData?.value) {
          try {
            const parsed = typeof stateData.value === 'string' 
              ? JSON.parse(stateData.value) 
              : stateData.value;
            return parsed as NeighborhoodMarketStats;
          } catch (e) {
            console.error('Error parsing neighborhood market stats JSON:', e);
          }
        }
      }

      // Fall back to legacy format (neighborhood-{slug})
      const legacyPageKey = `neighborhood-${neighborhoodSlug}`;
      
      const { data, error } = await supabase
        .from('marketing_content')
        .select('value')
        .eq('page', legacyPageKey)
        .eq('section', 'market_stats')
        .eq('key', 'full_content')
        .maybeSingle();

      if (error) {
        console.error('Error fetching neighborhood market stats:', error);
        return null;
      }

      if (!data?.value) {
        return null;
      }

      try {
        const parsed = typeof data.value === 'string' 
          ? JSON.parse(data.value) 
          : data.value;
        return parsed as NeighborhoodMarketStats;
      } catch (e) {
        console.error('Error parsing neighborhood market stats JSON:', e);
        return null;
      }
    },
    enabled: !!neighborhoodSlug,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};
