import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export interface LocationSearchResult {
  search_type: 'zip' | 'text';
  neighborhood_id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  tier: string;
  median_home_value: number;
  is_primary: boolean;
  match_score: number;
}

// State abbreviation to URL slug mapping
// Uses existing pattern from stateSlugMapping.ts
const STATE_MAPPING: Record<string, string> = {
  'AZ': 'arizona',
  'CA': 'california',
  'TX': 'texas',
  'FL': 'florida',
  'NY': 'new-york',
  'CO': 'colorado'
};

export const useLocationSearch = () => {
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const search = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }

    // Client-side ZIP validation
    if (/^\d+$/.test(term)) {
      if (term.length !== 5) {
        setError('ZIP codes must be 5 digits');
        setResults([]);
        return;
      }
    }

    setIsSearching(true);
    setError(null);

    try {
      const { data, error: searchError } = await supabase
        .rpc('search_location', { search_term: term.trim() });

      if (searchError) throw searchError;

      if (!data || data.length === 0) {
        setError(term.match(/^\d{5}$/) 
          ? `No neighborhoods found for ZIP ${term}`
          : `No neighborhoods found matching "${term}"`
        );
        setResults([]);
      } else {
        // Cast the data to our expected type
        const typedResults = data as LocationSearchResult[];
        setResults(typedResults);
        setError(null);
        
        // Track search analytics
        const searchType = typedResults[0]?.search_type === 'zip' ? 'zip' : 'text';
        trackSearch(searchType, typedResults.length, term);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const buildNeighborhoodUrl = (result: LocationSearchResult): string => {
    // Map state abbreviation to URL slug (AZ to arizona)
    const state = STATE_MAPPING[result.state] || result.state.toLowerCase();
    const city = result.city_area_slug;
    const neighborhood = result.neighborhood_slug;
    
    // URL pattern: /{state}/{city}/{neighborhood}/top10realestateagents
    // Example: /arizona/phoenix/arcadia/top10realestateagents
    return `/${state}/${city}/${neighborhood}/top10realestateagents`;
  };

  const navigateToNeighborhood = (result: LocationSearchResult, selectedRank?: number) => {
    const url = buildNeighborhoodUrl(result);
    
    // Track navigation analytics
    trackNavigation(result, selectedRank || results.indexOf(result) + 1);
    
    navigate(url);
  };

  const handleSubmit = (term: string) => {
    if (results.length === 0) {
      search(term);
      return;
    }

    // Auto-routing logic based on result count and search type
    if (results.length === 1) {
      // Single result: navigate directly (no dropdown needed)
      navigateToNeighborhood(results[0], 1);
    } else if (results.length <= 3 && results[0].search_type === 'zip') {
      // ZIP with 2-3 results: navigate to primary (highest median_home_value)
      const primary = results.find(r => r.is_primary) || results[0];
      navigateToNeighborhood(primary, 1);
    } else {
      // 4+ results OR text search: user must choose from dropdown
      // Dropdown stays open for user selection
      // Example: ZIP 85018 returns 6 neighborhoods (show dropdown)
      return;
    }
  };

  const clearResults = () => {
    setResults([]);
    setError(null);
  };

  // Analytics tracking functions
  const trackSearch = (searchType: 'zip' | 'text', resultCount: number, term: string) => {
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'search', {
          search_type: searchType,
          search_term: term,
          result_count: resultCount,
          disambiguation_shown: resultCount >= 4
        });
      }
    } catch (e) {
      console.error('Analytics tracking error:', e);
    }
  };

  const trackNavigation = (result: LocationSearchResult, selectedRank: number) => {
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'neighborhood_selected', {
          neighborhood: result.neighborhood,
          city_area: result.city_area,
          state: result.state,
          search_type: result.search_type,
          selected_rank: selectedRank,
          is_primary: result.is_primary,
          tier: result.tier
        });
      }
    } catch (e) {
      console.error('Analytics tracking error:', e);
    }
  };

  return {
    results,
    isSearching,
    error,
    search,
    navigateToNeighborhood,
    handleSubmit,
    clearResults,
    buildNeighborhoodUrl
  };
};
