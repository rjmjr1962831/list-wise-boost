import { useState, useRef, useEffect } from 'react';
import { User, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLocationSearch } from '@/hooks/useLocationSearch';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// Available states
const STATES = [
  { abbr: 'AZ', name: 'Arizona', slug: 'arizona' },
  { abbr: 'CA', name: 'California', slug: 'california' },
];

interface DualSearchBoxProps {
  locationPlaceholder?: string;
  agentPlaceholder?: string;
  className?: string;
}

const getResultTypeLabel = (result: { result_type: string; tier?: string }) => {
  if (result.result_type === 'city') return 'City';
  return 'Neighborhood';
};

export const DualSearchBox = ({ 
  locationPlaceholder = "Search by ZIP code or neighborhood",
  agentPlaceholder = "Search agent name",
  className,
}: DualSearchBoxProps) => {
  const navigate = useNavigate();
  
  // State selection
  const [selectedState, setSelectedState] = useState(STATES[0]); // Default to Arizona
  
  // Location search state
  const [locationValue, setLocationValue] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationSelectedIndex, setLocationSelectedIndex] = useState(0);
  const [hasLocationNavigatedWithArrows, setHasLocationNavigatedWithArrows] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  
  const { 
    results: locationResults, 
    isSearching: isLocationSearching, 
    error: locationError, 
    search: searchLocation, 
    navigateToResult, 
    clearResults: clearLocationResults 
  } = useLocationSearch();

  // Agent search state - navigates to AgentLookup page
  const [agentValue, setAgentValue] = useState('');
  const agentInputRef = useRef<HTMLInputElement>(null);

  // Debounced location search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationValue.trim().length >= 2) {
        searchLocation(locationValue, selectedState.name);
      } else {
        clearLocationResults();
        setShowLocationDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [locationValue, selectedState, searchLocation, clearLocationResults]);

  // Auto-open location dropdown when results arrive
  useEffect(() => {
    if (locationResults.length > 0 && locationValue.trim().length >= 2) {
      setShowLocationDropdown(true);
    }
  }, [locationResults, locationValue]);

  // Reset location selection when results change
  useEffect(() => {
    setLocationSelectedIndex(0);
    setHasLocationNavigatedWithArrows(false);
  }, [locationResults]);

  // Click outside handler for location dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected location into view
  useEffect(() => {
    const selectedElement = locationDropdownRef.current?.querySelector(`[data-location-index="${locationSelectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [locationSelectedIndex]);

  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (!showLocationDropdown || locationResults.length === 0)) {
      e.preventDefault();
      setShowLocationDropdown(true);
      searchLocation(locationValue);
      return;
    }

    if (!showLocationDropdown || locationResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHasLocationNavigatedWithArrows(true);
        setLocationSelectedIndex(prev => Math.min(prev + 1, locationResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHasLocationNavigatedWithArrows(true);
        setLocationSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (hasLocationNavigatedWithArrows || locationResults.length === 1) {
          if (locationResults[locationSelectedIndex]) {
            navigateToResult(locationResults[locationSelectedIndex], locationSelectedIndex + 1);
            setShowLocationDropdown(false);
            setLocationValue('');
          }
        }
        break;
      case 'Escape':
        setShowLocationDropdown(false);
        locationInputRef.current?.blur();
        break;
    }
  };

  // Navigate to Check Agent page with search query
  const handleAgentSearch = () => {
    if (agentValue.trim().length >= 2) {
      navigate(`/check-agent?q=${encodeURIComponent(agentValue.trim())}&state=${selectedState.slug}`);
    }
  };

  const handleAgentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAgentSearch();
    }
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-3 w-full", className)}>
      {/* Location/ZIP Search */}
      <div className="relative" ref={locationDropdownRef}>
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            ref={locationInputRef}
            type="text"
            value={locationValue}
            onChange={(e) => setLocationValue(e.target.value)}
            onKeyDown={handleLocationKeyDown}
            onFocus={() => locationResults.length > 0 && setShowLocationDropdown(true)}
            placeholder="Search city, ZIP, or neighborhood"
            className="pl-12 pr-4 py-6 text-lg"
            aria-label="Search by city, ZIP code, or neighborhood"
            aria-autocomplete="list"
            aria-controls="location-results"
            aria-expanded={showLocationDropdown}
          />
          {isLocationSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {showLocationDropdown && (locationResults.length > 0 || locationError) && (
          <div 
            id="location-results"
            className="absolute z-50 w-full mt-2 bg-background border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto"
            role="listbox"
          >
            {locationError ? (
              <div className="p-4 text-sm text-destructive">{locationError}</div>
            ) : (
              locationResults.map((result, index) => (
                <button
                  key={result.result_type === 'city'
                    ? `city-${result.city_id ?? result.city_area_slug}`
                    : `neighborhood-${result.city_area_slug}-${result.neighborhood_slug}-${result.primary_zip ?? ''}`
                  }
                  data-location-index={index}
                  onClick={() => {
                    navigateToResult(result, index + 1);
                    setShowLocationDropdown(false);
                    setLocationValue('');
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-accent focus:bg-accent focus:outline-none border-b border-border last:border-b-0 transition-colors",
                    locationSelectedIndex === index && "bg-accent"
                  )}
                  role="option"
                  aria-selected={locationSelectedIndex === index}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {result.neighborhood}
                      </p>
                      {result.result_type === 'neighborhood' && (
                        <p className="text-sm text-muted-foreground truncate">
                          {result.city_area}, {result.state}
                        </p>
                      )}
                      {result.result_type === 'city' && (
                        <p className="text-sm text-muted-foreground truncate">
                          {result.state}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      "px-2 py-1 text-xs font-medium rounded whitespace-nowrap flex-shrink-0",
                      result.result_type === 'city' 
                        ? "bg-secondary text-secondary-foreground" 
                        : "bg-primary/10 text-primary"
                    )}>
                      {getResultTypeLabel(result)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Agent Name Search - navigates to AgentLookup page */}
      <div className="relative flex gap-2">
        {/* State Selector */}
        <select
          value={selectedState.abbr}
          onChange={(e) => {
            const state = STATES.find(s => s.abbr === e.target.value);
            if (state) setSelectedState(state);
          }}
          className="flex items-center px-3 py-3 h-full bg-muted border border-border rounded-lg text-sm font-medium min-w-[60px] cursor-pointer hover:bg-muted/80"
        >
          {STATES.map(state => (
            <option key={state.abbr} value={state.abbr}>
              {state.abbr}
            </option>
          ))}
        </select>

        {/* Agent Name Input */}
        <div className="relative flex-1">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            ref={agentInputRef}
            type="text"
            value={agentValue}
            onChange={(e) => setAgentValue(e.target.value)}
            onKeyDown={handleAgentKeyDown}
            placeholder={agentPlaceholder}
            className="pl-12 pr-4 py-6 text-lg"
            aria-label="Search agent name"
          />
        </div>
      </div>
    </div>
  );
};
