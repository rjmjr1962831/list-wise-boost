import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TierBadge, getTierPrice } from './TierBadge';
import { useNeighborhoodSearch } from '@/hooks/useNeighborhoodSearch';
import { useNeighborhoodPricing } from '@/hooks/useNeighborhoodPricing';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SelectedNeighborhood, NeighborhoodSuggestion } from '@/types/neighborhoodPricing';

interface NeighborhoodsPanelProps {
  state: string;
  selectedCities?: Set<string>;
  selectedNeighborhoods: SelectedNeighborhood[];
  onAdd: (neighborhood: SelectedNeighborhood) => void;
  onRemove: (neighborhoodId: string) => void;
  onPendingChange?: (isPending: boolean) => void;
  pricingConfigVersion?: string;
}

export function NeighborhoodsPanel({
  state,
  selectedNeighborhoods,
  onAdd,
  onRemove,
  onPendingChange,
}: NeighborhoodsPanelProps) {
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [zipResults, setZipResults] = useState<NeighborhoodSuggestion[]>([]);
  const [isSearchingZip, setIsSearchingZip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const {
    query,
    setQuery,
    suggestions,
    isSearching,
    message,
    clearSuggestions,
  } = useNeighborhoodSearch({ state });

  const { computePrice, isComputing } = useNeighborhoodPricing();

  // Detect if query is a ZIP code
  const isZipQuery = /^\d{5}$/.test(query.trim());

  // Handle ZIP code search
  useEffect(() => {
    const searchZip = async () => {
      if (!isZipQuery) {
        setZipResults([]);
        return;
      }

      setIsSearchingZip(true);
      try {
        const { data, error } = await supabase
          .from('neighborhood_catalog')
          .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, tier, zips, lat, lon, median_home_value')
          .contains('zips', [query.trim()])
          .eq('is_active', true)
          .eq('state', state)
          .order('median_home_value', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          // Convert to NeighborhoodSuggestion format
          const formatted: NeighborhoodSuggestion[] = data.map(n => ({
            id: n.id,
            neighborhood: n.neighborhood,
            neighborhood_slug: n.neighborhood_slug,
            city_area: n.city_area,
            city_area_slug: n.city_area_slug,
            state: n.state,
            tier: n.tier as 'Main' | 'Prime' | 'Luxury',
            zips: n.zips || [],
            lat: n.lat,
            lon: n.lon
          }));
          setZipResults(formatted);
        } else {
          setZipResults([]);
          toast.info(`No neighborhoods found for ZIP ${query.trim()}`);
        }
      } catch (err) {
        console.error('ZIP search error:', err);
        setZipResults([]);
      } finally {
        setIsSearchingZip(false);
      }
    };

    searchZip();
  }, [query, isZipQuery, state]);

  // Determine which results to show (ZIP results or name search results)
  const displaySuggestions = isZipQuery ? zipResults : suggestions;
  const isCurrentlySearching = isZipQuery ? isSearchingZip : isSearching;

  // Show dropdown when there are suggestions or searching
  useEffect(() => {
    if (displaySuggestions.length > 0 || isCurrentlySearching || message) {
      setIsOpen(true);
    }
  }, [displaySuggestions, isCurrentlySearching, message]);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIndex(-1);
  }, [displaySuggestions]);

  const handleSelect = useCallback(
    async (suggestion: NeighborhoodSuggestion) => {
      // Check for duplicate
      if (selectedNeighborhoods.some((n) => n.id === suggestion.id)) {
        return;
      }

      // Signal pending IMMEDIATELY before async work
      onPendingChange?.(true);
      toast.loading(`Adding ${suggestion.neighborhood}...`, { id: 'adding-neighborhood' });

      try {
        // Get price from server
        const priceResponse = await computePrice(suggestion.id);
        
        const selected: SelectedNeighborhood = {
          id: suggestion.id,
          neighborhood: suggestion.neighborhood,
          city_area: suggestion.city_area,
          state: suggestion.state,
          tier_at_selection: suggestion.tier,
          price_monthly: priceResponse?.final_price ?? getTierPrice(suggestion.tier),
          price_source: priceResponse?.price_source ?? 'tier_prices',
        };

        onAdd(selected);
        toast.dismiss('adding-neighborhood');
        toast.success(`Added ${suggestion.neighborhood}`);
      } catch (error) {
        console.error('Error getting price:', error);
        toast.dismiss('adding-neighborhood');
        toast.error(`Failed to add ${suggestion.neighborhood}`);
        // Fallback to tier price
        const selected: SelectedNeighborhood = {
          id: suggestion.id,
          neighborhood: suggestion.neighborhood,
          city_area: suggestion.city_area,
          state: suggestion.state,
          tier_at_selection: suggestion.tier,
          price_monthly: getTierPrice(suggestion.tier),
          price_source: 'tier_prices',
        };
        onAdd(selected);
      } finally {
        onPendingChange?.(false);
        setQuery('');
        clearSuggestions();
        setIsOpen(false);
      }
    },
    [selectedNeighborhoods, onAdd, setQuery, clearSuggestions, computePrice, onPendingChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || displaySuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < displaySuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < displaySuggestions.length) {
          handleSelect(displaySuggestions[highlightIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        clearSuggestions();
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const subtotal = selectedNeighborhoods.reduce(
    (sum, n) => sum + n.price_monthly,
    0
  );

  return (
    <div className="rounded-lg border bg-card">
      {/* Header with tier legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 border-b">
        <h3 className="font-semibold">Select Your Neighborhoods</h3>
        <div className="flex items-center gap-2 text-xs">
          <TierBadge tier="Main" showPrice size="sm" />
          <TierBadge tier="Prime" showPrice size="sm" />
          <TierBadge tier="Luxury" showPrice size="sm" />
        </div>
      </div>

      {/* Search input */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search neighborhoods... select as many as you like"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => displaySuggestions.length > 0 && setIsOpen(true)}
            className="pl-9"
          />

          {/* Dropdown */}
          {isOpen && (query.length >= 2 || message) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-64 overflow-hidden">
              {isCurrentlySearching && (
                <div className="p-3 text-sm text-muted-foreground">
                  Searching{isZipQuery ? ` ZIP ${query}` : ''}...
                </div>
              )}

              {!isCurrentlySearching && message && !isZipQuery && (
                <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  {message}
                </div>
              )}

              {!isCurrentlySearching && displaySuggestions.length > 0 && (
                <ul ref={listRef} className="max-h-64 overflow-y-auto">
                  {displaySuggestions.map((suggestion, index) => {
                    const isDuplicate = selectedNeighborhoods.some(
                      (n) => n.id === suggestion.id
                    );

                    return (
                      <li
                        key={suggestion.id}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 cursor-pointer',
                          highlightIndex === index && 'bg-accent',
                          isDuplicate && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => !isDuplicate && handleSelect(suggestion)}
                        onMouseEnter={() => setHighlightIndex(index)}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {suggestion.neighborhood}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {suggestion.city_area}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TierBadge tier={suggestion.tier} size="sm" />
                          <span className="text-sm font-medium">
                            ${getTierPrice(suggestion.tier)}/mo
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selected neighborhoods list */}
      <div className="divide-y">
        {selectedNeighborhoods.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No neighborhoods selected
          </div>
        ) : (
          selectedNeighborhoods.map((neighborhood) => (
            <div
              key={neighborhood.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {neighborhood.neighborhood}
                </span>
                <span className="text-xs text-muted-foreground">
                  {neighborhood.city_area}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <TierBadge tier={neighborhood.tier_at_selection} size="sm" />
                <span className="text-sm font-medium">
                  ${neighborhood.price_monthly}/mo
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onRemove(neighborhood.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer with count and subtotal */}
      {selectedNeighborhoods.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
          <span className="text-sm text-muted-foreground">
            {selectedNeighborhoods.length} neighborhood
            {selectedNeighborhoods.length !== 1 ? 's' : ''}
          </span>
          <span className="text-sm font-semibold">${subtotal}/mo</span>
        </div>
      )}

      {isComputing && (
        <div className="px-4 py-2 text-xs text-muted-foreground">
          Calculating price...
        </div>
      )}
    </div>
  );
}
