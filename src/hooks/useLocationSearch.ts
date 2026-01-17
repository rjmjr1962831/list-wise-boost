import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export interface LocationSearchResult {
  search_type: 'zip' | 'text';
  result_type: 'neighborhood' | 'city';
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
  primary_zip: string | null;
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

  const search = async (term: string): Promise<LocationSearchResult[]> => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return [];
    }

    if (/^\d+$/.test(term) && term.length !== 5) {
      setError('ZIP codes must be 5 digits');
      setResults([]);
      return [];
    }

    setIsSearching(true);
    setError(null);

    try {
      const { data, error: searchError } = await supabase
        .rpc('search_location', { search_term: term.trim() });

      if (searchError) throw searchError;

      if (!data || data.length === 0) {
        const errorMsg = term.match(/^\d{5}$/) 
          ? `No neighborhoods found for ZIP ${term}`
          : `No results found matching "${term}"`;
        setError(errorMsg);
        setResults([]);
        return [];
      } else {
        const typedData = data as LocationSearchResult[];
        setResults(typedData);
        setError(null);
        trackSearch(typedData[0]?.search_type || 'text', typedData.length, term);
        return typedData;
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      setResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const buildUrl = (result: LocationSearchResult): string => {
    const state = STATE_MAPPING[result.state] || result.state.toLowerCase();
    
    // City result - navigate to city landing page
    if (result.result_type === 'city') {
      return `/${state}/${result.city_area_slug}`;
    }
    
    // Neighborhood result
    const city = result.city_area_slug;
    const neighborhood = result.neighborhood_slug;
    const zip = result.primary_zip;
    
    // Use 5-segment URL with ZIP when available
    if (zip) {
      return `/${state}/${city}/${zip}/${neighborhood}/top10realestateagents`;
    }
    // Fallback to 4-segment (will trigger redirect to canonical 5-segment URL)
    return `/${state}/${city}/${neighborhood}/top10realestateagents`;
  };

  const navigateToResult = (result: LocationSearchResult, selectedRank?: number) => {
    const url = buildUrl(result);
    trackNavigation(result, selectedRank || results.indexOf(result) + 1);
    navigate(url);
  };

  // Keep backward compatibility
  const navigateToNeighborhood = navigateToResult;
  const buildNeighborhoodUrl = buildUrl;

  const handleSubmit = async (term: string) => {
    let searchResults = results;
    
    if (searchResults.length === 0) {
      searchResults = await search(term);
    }

    // Auto-navigate ONLY for single result
    if (searchResults.length === 1) {
      navigateToResult(searchResults[0], 1);
    }
    // For 2+ results, let dropdown stay open for user selection
  };

  const clearResults = () => {
    setResults([]);
    setError(null);
  };

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
        (window as any).gtag('event', 'location_selected', {
          result_type: result.result_type,
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
    navigateToResult,
    navigateToNeighborhood,
    handleSubmit,
    clearResults,
    buildUrl,
    buildNeighborhoodUrl
  };
};
