import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export interface AgentSearchResult {
  id: string;
  name: string;
  company: string | null;
  years_experience: number | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  license_number: string | null;
  license_status: string | null;
  license_verified_at: string | null;
  canonical_slug: string | null;
  state_slug: string | null;
  image_url: string | null;
  served_cities: string[] | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}

interface UseAgentNameSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: AgentSearchResult[];
  isSearching: boolean;
  error: string | null;
  selectedAgent: AgentSearchResult | null;
  setSelectedAgent: (agent: AgentSearchResult | null) => void;
  search: (term: string) => Promise<void>;
  navigateToAgent: (agent: AgentSearchResult) => void;
  clearResults: () => void;
}

export function useAgentNameSearch(): UseAgentNameSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AgentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentSearchResult | null>(null);
  const navigate = useNavigate();
  const abortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (term: string) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setError(null);

    try {
      const searchTerm = term.trim();
      
      // Search by name using ilike for partial matching
      const { data, error: searchError } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          company,
          years_experience,
          review_stars_rating,
          num_total_reviews,
          license_number,
          license_status,
          license_verified_at,
          canonical_slug,
          state_slug,
          image_url,
          served_cities,
          email,
          phone,
          website
        `)
        .eq('active', true)
        .ilike('name', `%${searchTerm}%`)
        .order('num_total_reviews', { ascending: false, nullsFirst: false })
        .limit(20);

      if (searchError) throw searchError;

      if (!data || data.length === 0) {
        setError(`No agents found matching "${searchTerm}"`);
        setResults([]);
      } else {
        setResults(data);
        setError(null);
        
        // If only one result, auto-select it
        if (data.length === 1) {
          setSelectedAgent(data[0]);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[AgentNameSearch] Error:', err);
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const navigateToAgent = useCallback((agent: AgentSearchResult) => {
    if (agent.canonical_slug && agent.state_slug) {
      navigate(`/${agent.state_slug}/agents/${agent.canonical_slug}`);
    } else {
      // Show agent in modal/lookup view instead
      setSelectedAgent(agent);
    }
  }, [navigate]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setSelectedAgent(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    selectedAgent,
    setSelectedAgent,
    search,
    navigateToAgent,
    clearResults,
  };
}
