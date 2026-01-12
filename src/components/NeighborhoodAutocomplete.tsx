import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface NeighborhoodResult {
  neighborhood: string;
  neighborhood_slug: string;
  tier: string;
}

interface NeighborhoodAutocompleteProps {
  state: string;
  cityArea: string;
  value: string;
  onValueChange: (neighborhood: string, slug: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Map full state name to abbreviation
const stateAbbreviations: Record<string, string> = {
  'Arizona': 'AZ',
  // Add more as needed
};

export function NeighborhoodAutocomplete({
  state,
  cityArea,
  value,
  onValueChange,
  placeholder = "Neighborhood (optional)",
  className,
  disabled = false
}: NeighborhoodAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Clear input when city changes
  useEffect(() => {
    if (!cityArea) {
      setInputValue('');
      setNeighborhoods([]);
    }
  }, [cityArea]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchNeighborhoods = async (searchText: string) => {
    // Require both state and cityArea for search
    if (!state || !cityArea) {
      console.log('[NeighborhoodAutocomplete] Missing state or cityArea:', { state, cityArea });
      setNeighborhoods([]);
      return;
    }

    setIsLoading(true);
    
    try {
      const stateAbbr = stateAbbreviations[state] || state;
      
      console.log('[NeighborhoodAutocomplete] Searching:', { 
        state, 
        stateAbbr, 
        cityArea, 
        searchText 
      });
      
      // Query neighborhood_catalog with fuzzy matching
      let query = supabase
        .from('neighborhood_catalog')
        .select('neighborhood, neighborhood_slug, tier, city_area')
        .eq('state', stateAbbr)
        .eq('is_active', true);

      // Match city_area - try exact match or check if it's part of the metro
      // city_area values are: "Phoenix", "Scottsdale", "Mesa", "Other Arizona"
      query = query.ilike('city_area', `%${cityArea}%`);

      if (searchText) {
        query = query.ilike('neighborhood', `%${searchText}%`);
      }

      const { data, error } = await query
        .order('neighborhood')
        .limit(10);

      console.log('[NeighborhoodAutocomplete] Results:', { 
        count: data?.length || 0, 
        error: error?.message,
        data 
      });

      if (error) {
        console.error('Neighborhood search error:', error);
        setNeighborhoods([]);
      } else {
        setNeighborhoods(data || []);
      }
    } catch (err) {
      console.error('Neighborhood search exception:', err);
      setNeighborhoods([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setOpen(true);

    // Debounce the search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchNeighborhoods(value);
    }, 200);
  };

  const handleSelectNeighborhood = (neighborhood: string, slug: string) => {
    setInputValue(neighborhood);
    onValueChange(neighborhood, slug);
    setOpen(false);
  };

  const handleFocus = () => {
    if (!disabled && cityArea) {
      setOpen(true);
      searchNeighborhoods(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <Input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          "w-full",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      
      {open && !disabled && cityArea && (
        <div className="absolute z-[200] w-full mt-1 bg-background border rounded-md shadow-lg">
          <Command className="rounded-md border-0">
            <CommandList>
              {isLoading ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  Searching...
                </div>
              ) : neighborhoods.length === 0 && inputValue ? (
                <CommandEmpty>No neighborhoods found.</CommandEmpty>
              ) : neighborhoods.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  Type to search neighborhoods
                </div>
              ) : (
                <CommandGroup>
                  {neighborhoods.map((n) => (
                    <CommandItem
                      key={n.neighborhood_slug}
                      value={n.neighborhood}
                      onSelect={() => handleSelectNeighborhood(n.neighborhood, n.neighborhood_slug)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === n.neighborhood ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{n.neighborhood}</span>
                        <span className="text-xs text-muted-foreground">
                          {n.tier} tier
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
