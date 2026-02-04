import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StateAgentSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  company: string | null;
  licenseNumber: string | null;
  licenseStatus: string | null;
  rating: number | null;
  reviewCount: number | null;
  yearsExperience: number | null;
  isNeighborhoodExpert: boolean;
  isListed: boolean;
  stateSlug: string | null;
  canonicalSlug: string | null;
  imageUrl: string | null;
  verificationToken: string | null;
}

interface UseStateAgentSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: StateAgentSearchResult[];
  isSearching: boolean;
  error: string | null;
  selectedAgent: StateAgentSearchResult | null;
  setSelectedAgent: (agent: StateAgentSearchResult | null) => void;
  search: (searchQuery: string, stateSlug?: string) => Promise<void>;
  clearResults: () => void;
}

function parseFirstLastName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

export function useStateAgentSearch(): UseStateAgentSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StateAgentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<StateAgentSearchResult | null>(null);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (searchQuery: string, stateSlug?: string) => {
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmedQuery = searchQuery.trim();
    
    // Minimum 2 characters
    if (trimmedQuery.length < 2) {
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    // Debounce 300ms
    debounceTimeoutRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();

      try {
        // Query professionals - include ALL agents (not just active)
        let profQueryBuilder = supabase
          .from('professionals')
          .select(`
            id,
            name,
            company,
            license_number,
            license_status,
            review_stars_rating,
            num_total_reviews,
            years_experience,
            active,
            state_slug,
            canonical_slug,
            image_url,
            verification_token
          `)
          .ilike('name', `%${trimmedQuery}%`)
          .limit(100);

        // Filter by state if provided
        if (stateSlug) {
          profQueryBuilder = profQueryBuilder.eq('state_slug', stateSlug);
        }

        // Only query professionals table (no license table for public view)
        const profResult = await profQueryBuilder;

        if (profResult.error) {
          throw profResult.error;
        }

        const professionals = profResult.data || [];

        if (professionals.length === 0) {
          setResults([]);
          setIsSearching(false);
          return;
        }

        // Get professional IDs to check for neighborhood expert status
        const professionalIds = professionals.map(p => p.id);

        // Check for active neighborhood subscriptions
        const { data: subscriptions } = await supabase
          .from('agent_neighborhood_subscriptions')
          .select('professional_id')
          .in('professional_id', professionalIds)
          .eq('is_active', true);

        const expertIds = new Set(subscriptions?.map(s => s.professional_id) || []);

        // Transform professionals results - ONLY show agents in professionals table
        const transformedResults: StateAgentSearchResult[] = professionals.map(p => {
          const { firstName, lastName } = parseFirstLastName(p.name);
          return {
            id: p.id,
            firstName,
            lastName,
            name: p.name,
            company: p.company,
            licenseNumber: p.license_number,
            licenseStatus: p.license_status,
            rating: p.review_stars_rating,
            reviewCount: p.num_total_reviews,
            yearsExperience: p.years_experience,
            isNeighborhoodExpert: expertIds.has(p.id),
            isListed: p.active === true,
            stateSlug: p.state_slug,
            canonicalSlug: p.canonical_slug,
            imageUrl: p.image_url,
            verificationToken: p.verification_token,
          };
        });

        // Sort alphabetically by last name then first name
        transformedResults.sort((a, b) => {
          const lastNameCompare = a.lastName.localeCompare(b.lastName);
          if (lastNameCompare !== 0) return lastNameCompare;
          return a.firstName.localeCompare(b.firstName);
        });

        setResults(transformedResults);
        setIsSearching(false);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Agent search error:', err);
        setError('An error occurred while searching. Please try again.');
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const clearResults = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setSelectedAgent(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
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
    clearResults,
  };
}
