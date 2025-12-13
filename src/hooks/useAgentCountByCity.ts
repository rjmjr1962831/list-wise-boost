// src/hooks/useAgentCountByCity.ts
// Hook to get cached agent counts per city.
// Reads from city_agent_counts table (refreshed by edge function).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CityAgentCount {
  city_slug: string;
  city_name: string;
  agent_count: number;
  last_updated: string;
}

// Get agent count for a specific city
export function useAgentCountForCity(citySlug: string) {
  return useQuery({
    queryKey: ['agent-count', citySlug],
    queryFn: async () => {
      if (!citySlug) return 0;
      
      const normalizedSlug = citySlug
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const { data, error } = await supabase
        .from('city_agent_counts')
        .select('agent_count')
        .eq('city_slug', normalizedSlug)
        .single();

      if (error || !data) {
        console.log(`No cached count for city: ${normalizedSlug}`);
        return 0;
      }

      return data.agent_count;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hour client-side cache
    enabled: !!citySlug,
  });
}

// Get all city counts (useful for state/admin pages)
export function useAllCityAgentCounts() {
  return useQuery({
    queryKey: ['agent-counts-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('city_agent_counts')
        .select('*')
        .order('agent_count', { ascending: false });

      if (error) {
        console.error('Error fetching city counts:', error);
        return [];
      }

      return data as CityAgentCount[];
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hour client-side cache
  });
}

// Get total agents across all cities
export function useTotalAgentCount() {
  return useQuery({
    queryKey: ['agent-count-total'],
    queryFn: async () => {
      // Query directly from professionals for accurate live count
      const { count, error } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .gte('review_stars_rating', 4.8)
        .gte('num_total_reviews', 50);

      if (error || count === null) {
        return 460; // Fallback to known total
      }

      return count;
    },
    staleTime: 1000 * 60 * 60 * 24,
  });
}
