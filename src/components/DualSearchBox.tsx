import { useState, useRef, useEffect } from 'react';
import { User, MapPin, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLocationSearch } from '@/hooks/useLocationSearch';
import { useStateAgentSearch, StateAgentSearchResult } from '@/hooks/useStateAgentSearch';
import { AgentLookupModal } from '@/components/AgentLookupModal';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// US States list
const US_STATES = [
  { abbr: 'AZ', name: 'Arizona', slug: 'arizona' },
  { abbr: 'CA', name: 'California', slug: 'california' },
  { abbr: 'CO', name: 'Colorado', slug: 'colorado' },
  { abbr: 'FL', name: 'Florida', slug: 'florida' },
  { abbr: 'NV', name: 'Nevada', slug: 'nevada' },
  { abbr: 'TX', name: 'Texas', slug: 'texas' },
];

interface DualSearchBoxProps {
  locationPlaceholder?: string;
  agentPlaceholder?: string;
  className?: string;
  defaultState?: string;
}

export const DualSearchBox = ({ 
  locationPlaceholder = "Search by ZIP code or neighborhood",
  agentPlaceholder = "Search agent name",
  className,
  defaultState = 'arizona'
}: DualSearchBoxProps) => {
  const navigate = useNavigate();
  
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
    navigateToNeighborhood, 
    clearResults: clearLocationResults 
  } = useLocationSearch();

  // Agent search state with state selector
  const [selectedState, setSelectedState] = useState(defaultState);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [agentValue, setAgentValue] = useState('');
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [agentSelectedIndex, setAgentSelectedIndex] = useState(0);
  const agentInputRef = useRef<HTMLInputElement>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const stateDropdownRef = useRef<HTMLDivElement>(null);

  const {
    results: agentResults,
    isSearching: isAgentSearching,
    error: agentError,
    selectedAgent,
    setSelectedAgent,
    search: searchAgent,
    clearResults: clearAgentResults,
  } = useStateAgentSearch();

  // Get current state display
  const currentStateDisplay = US_STATES.find(s => s.slug === selectedState)?.abbr || 'AZ';

  // Debounced location search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationValue.trim().length >= 2) {
        searchLocation(locationValue);
      } else {
        clearLocationResults();
        setShowLocationDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [locationValue, searchLocation, clearLocationResults]);

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

  // Debounced agent search - includes state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (agentValue.trim().length >= 2) {
        searchAgent(agentValue, selectedState);
      } else {
        clearAgentResults();
        setShowAgentDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [agentValue, selectedState, searchAgent, clearAgentResults]);

  // Auto-open agent dropdown when results arrive
  useEffect(() => {
    if (agentResults.length > 0 && agentValue.trim().length >= 2) {
      setShowAgentDropdown(true);
      setAgentSelectedIndex(0);
    }
  }, [agentResults, agentValue]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setShowAgentDropdown(false);
      }
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target as Node)) {
        setShowStateDropdown(false);
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

  // Scroll selected agent into view
  useEffect(() => {
    const selectedElement = agentDropdownRef.current?.querySelector(`[data-agent-index="${agentSelectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [agentSelectedIndex]);

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
            navigateToNeighborhood(locationResults[locationSelectedIndex], locationSelectedIndex + 1);
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

  const handleAgentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (!showAgentDropdown || agentResults.length === 0)) {
      e.preventDefault();
      setShowAgentDropdown(true);
      searchAgent(agentValue, selectedState);
      return;
    }

    if (!showAgentDropdown || agentResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setAgentSelectedIndex(prev => Math.min(prev + 1, agentResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setAgentSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (agentResults[agentSelectedIndex]) {
          handleAgentSelect(agentResults[agentSelectedIndex]);
        }
        break;
      case 'Escape':
        setShowAgentDropdown(false);
        agentInputRef.current?.blur();
        break;
    }
  };

  const handleAgentSelect = (agent: StateAgentSearchResult) => {
    if (agent.canonicalSlug && agent.stateSlug) {
      navigate(`/${agent.stateSlug}/agents/${agent.canonicalSlug}`);
    } else {
      // For non-listed agents, open the modal
      setSelectedAgent(agent);
    }
    setShowAgentDropdown(false);
    setAgentValue('');
  };

  // Convert StateAgentSearchResult to the format expected by AgentLookupModal
  const modalAgent = selectedAgent ? {
    id: selectedAgent.id,
    name: selectedAgent.name,
    company: selectedAgent.company,
    years_experience: selectedAgent.yearsExperience,
    review_stars_rating: selectedAgent.rating,
    num_total_reviews: selectedAgent.reviewCount,
    license_number: selectedAgent.licenseNumber,
    license_status: selectedAgent.licenseStatus,
    license_verified_at: null,
    canonical_slug: selectedAgent.canonicalSlug,
    state_slug: selectedAgent.stateSlug,
    image_url: selectedAgent.imageUrl,
    served_cities: null,
    email: null,
    phone: null,
    website: null,
  } : null;

  return (
    <>
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
              placeholder={locationPlaceholder}
              className="pl-12 pr-4 py-6 text-lg"
              aria-label="Search by ZIP code or neighborhood"
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
                    key={result.neighborhood_id}
                    data-location-index={index}
                    onClick={() => {
                      navigateToNeighborhood(result, index + 1);
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
                        <p className="text-sm text-muted-foreground truncate">
                          {result.city_area}, {result.state}
                        </p>
                      </div>
                      {result.is_primary && (
                        <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded whitespace-nowrap flex-shrink-0">
                          Primary
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Agent Name Search with State Selector */}
        <div className="relative flex gap-2" ref={agentDropdownRef}>
          {/* State Selector */}
          <div className="relative" ref={stateDropdownRef}>
            <button
              type="button"
              onClick={() => setShowStateDropdown(!showStateDropdown)}
              className="flex items-center gap-1 px-3 py-3 h-full bg-muted border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors min-w-[70px] justify-center"
            >
              {currentStateDisplay}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            
            {showStateDropdown && (
              <div className="absolute z-50 top-full mt-1 left-0 bg-background border border-border rounded-lg shadow-lg min-w-[140px]">
                {US_STATES.map((state) => (
                  <button
                    key={state.slug}
                    onClick={() => {
                      setSelectedState(state.slug);
                      setShowStateDropdown(false);
                      // Re-search with new state if there's a query
                      if (agentValue.trim().length >= 2) {
                        searchAgent(agentValue, state.slug);
                      }
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg",
                      selectedState === state.slug && "bg-accent font-medium"
                    )}
                  >
                    {state.abbr} - {state.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Agent Name Input */}
          <div className="relative flex-1">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              ref={agentInputRef}
              type="text"
              value={agentValue}
              onChange={(e) => setAgentValue(e.target.value)}
              onKeyDown={handleAgentKeyDown}
              onFocus={() => agentResults.length > 0 && setShowAgentDropdown(true)}
              placeholder={agentPlaceholder}
              className="pl-12 pr-4 py-6 text-lg"
              aria-label="Search agent name"
              aria-autocomplete="list"
              aria-controls="agent-results"
              aria-expanded={showAgentDropdown}
            />
            {isAgentSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {showAgentDropdown && (agentResults.length > 0 || agentError) && (
            <div 
              id="agent-results"
              className="absolute z-50 left-0 right-0 top-full mt-2 bg-background border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto"
              role="listbox"
            >
              {agentError ? (
                <div className="p-4 text-sm text-destructive">{agentError}</div>
              ) : (
                agentResults.map((agent, index) => (
                  <button
                    key={agent.id}
                    data-agent-index={index}
                    onClick={() => handleAgentSelect(agent)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-accent focus:bg-accent focus:outline-none border-b border-border last:border-b-0 transition-colors",
                      agentSelectedIndex === index && "bg-accent"
                    )}
                    role="option"
                    aria-selected={agentSelectedIndex === index}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {agent.firstName} {agent.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {agent.company && `${agent.company}`}
                          {agent.company && agent.yearsExperience && ' • '}
                          {agent.yearsExperience && `${agent.yearsExperience} yrs`}
                          {!agent.isListed && <span className="ml-2 text-xs text-muted-foreground/70">(Not Listed)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {agent.isNeighborhoodExpert && (
                          <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded whitespace-nowrap">
                            Expert
                          </span>
                        )}
                        {agent.rating && (
                          <span className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded whitespace-nowrap">
                            ★ {agent.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agent Lookup Modal */}
      <AgentLookupModal
        agent={modalAgent}
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
      />
    </>
  );
};
