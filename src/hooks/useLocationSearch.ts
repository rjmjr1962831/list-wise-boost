import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export interface LocationSearchResult {
  result_type: 'neighborhood' | 'city';
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  primary_zip: string | null;
  state: string;
  tier: string;
  median_home_value: number | null;
  match_score: number;
  city_id: string | null;
}

const STATE_MAPPING: Record<string, string> = {
  'AZ': 'arizona',
  'Arizona': 'arizona',
  'CA': 'california',
  'California': 'california',
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

  const search = useCallback(async (term: string): Promise<LocationSearchResult[]> => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return [];
    }

    if (/^\d+$/.test(term) && term.length !== 5) {
      setError('ZIP codes must be 5 digits');
      setResults([]);
      return [];
    }

    const trimmedTerm = term.trim();
    const searchType: 'zip' | 'text' = /^\d{5}$/.test(trimmedTerm) ? 'zip' : 'text';

    setIsSearching(true);
    setError(null);

    try {
      const { data, error: searchError } = await supabase
        .rpc('search_location', { search_term: trimmedTerm });

      if (searchError) throw searchError;

      if (!data || data.length === 0) {
        const errorMsg = searchType === 'zip'
          ? `No listings in ZIP ${trimmedTerm} yet. Try a city or neighborhood name.`
          : `No results found matching "${trimmedTerm}"`;
        setError(errorMsg);
        setResults([]);
        return [];
      }

      const typedData = data as LocationSearchResult[];
      setResults(typedData);
      setError(null);
      trackSearch(searchType, typedData.length, trimmedTerm);
      return typedData;
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      setResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const buildUrl = useCallback((result: LocationSearchResult): string => {
    const state = STATE_MAPPING[result.state] || result.state.toLowerCase();

    // City result - navigate to city landing page
    if (result.result_type === 'city') {
      return `/${state}/${result.city_area_slug}`;
    }

    // Neighborhood result - navigate to neighborhood expert page (shows neighborhood data + experts)
    const city = result.city_area_slug;
    const neighborhood = result.neighborhood_slug;
    const zip = result.primary_zip;

    // Use 5-segment URL with ZIP when available - top10realestateagents shows neighborhood experts page
    if (zip) {
      return `/${state}/${city}/${zip}/${neighborhood}/top10realestateagents`;
    }
    // Fallback to 4-segment format
    return `/${state}/${city}/${neighborhood}/top10realestateagents`;
  }, []);

  const trackSearch = useCallback((searchType: 'zip' | 'text', resultCount: number, term: string) => {
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
  }, []);

  const trackNavigation = useCallback((result: LocationSearchResult, selectedRank: number) => {
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'location_selected', {
          result_type: result.result_type,
          neighborhood: result.neighborhood,
          city_area: result.city_area,
          state: result.state,
          selected_rank: selectedRank,
          tier: result.tier
        });
      }
    } catch (e) {
      console.error('Analytics tracking error:', e);
    }
  }, []);

  const navigateToResult = useCallback((result: LocationSearchResult, selectedRank?: number) => {
    const url = buildUrl(result);
    trackNavigation(result, selectedRank || results.indexOf(result) + 1);
    navigate(url);
  }, [buildUrl, navigate, results, trackNavigation]);

  // Keep backward compatibility
  const navigateToNeighborhood = navigateToResult;
  const buildNeighborhoodUrl = buildUrl;

  const handleSubmit = useCallback(async (term: string) => {
    let searchResults = results;

    if (searchResults.length === 0) {
      searchResults = await search(term);
    }

    // Auto-navigate ONLY for single result
    if (searchResults.length === 1) {
      navigateToResult(searchResults[0], 1);
    }
    // For 2+ results, let dropdown stay open for user selection
  }, [navigateToResult, results, search]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isSearching,
    error,
    search,
    navigateToResult,
    navigateToNeighborhood,
    handleSubmit,
    clearResults,
    buildUrl,
    buildNeighborhoodUrl
  };
};
