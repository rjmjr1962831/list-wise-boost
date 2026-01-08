import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { NeighborhoodSuggestion } from '@/types/neighborhoodPricing';

interface UseNeighborhoodSearchOptions {
  state: string;
  cityArea?: string;
  debounceMs?: number;
}

interface UseNeighborhoodSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  suggestions: NeighborhoodSuggestion[];
  isSearching: boolean;
  error: string | null;
  message: string | null;
  clearSuggestions: () => void;
}

export function useNeighborhoodSearch(options: UseNeighborhoodSearchOptions): UseNeighborhoodSearchReturn {
  const { state, cityArea, debounceMs = 300 } = options;
  
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NeighborhoodSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const searchNeighborhoods = useCallback(async (searchQuery: string) => {
    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    // Skip search if query is too short
    if (searchQuery.length < 2) {
      setSuggestions([]);
      setMessage(null);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);
    setMessage(null);

    abortController.current = new AbortController();

    try {
      const { data, error: fnError } = await supabase.functions.invoke('validate-neighborhood', {
        body: {
          input_string: searchQuery,
          state,
          city_area: cityArea,
          limit: 10
        }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setSuggestions(data.suggestions || []);
      setMessage(data.message || null);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Request was cancelled
      }
      console.error('[useNeighborhoodSearch] Error:', err);
      setError(err.message || 'Failed to search neighborhoods');
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, [state, cityArea]);

  // Debounced search effect
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchNeighborhoods(query);
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, debounceMs, searchNeighborhoods]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setMessage(null);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isSearching,
    error,
    message,
    clearSuggestions
  };
}
