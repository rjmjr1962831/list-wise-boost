import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NeighborhoodWriteup {
  writeup_html: string | null;
  neighborhood: string;
  tier: string;
}

/**
 * Fetches neighborhood writeup content for GEO optimization.
 * Uses React Query caching so multiple components can access the same data
 * without duplicate requests.
 */
export function useNeighborhoodWriteup(
  neighborhoodSlug: string | undefined,
  citySlug: string | undefined
) {
  return useQuery({
    queryKey: ['neighborhood-writeup', neighborhoodSlug, citySlug],
    queryFn: async (): Promise<NeighborhoodWriteup | null> => {
      if (!neighborhoodSlug || !citySlug) return null;

      const { data, error } = await supabase
        .from('neighborhood_catalog')
        .select('writeup_html, neighborhood, tier')
        .eq('neighborhood_slug', neighborhoodSlug)
        .eq('city_area_slug', citySlug)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[useNeighborhoodWriteup] Error:', error);
        return null;
      }

      return data;
    },
    enabled: !!neighborhoodSlug && !!citySlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
