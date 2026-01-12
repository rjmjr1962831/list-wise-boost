import { useState, useRef, useEffect } from 'react';
import { Search, User, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLocationSearch, LocationSearchResult } from '@/hooks/useLocationSearch';
import { useAgentNameSearch, AgentSearchResult } from '@/hooks/useAgentNameSearch';
import { AgentLookupModal } from '@/components/AgentLookupModal';

interface NeighborhoodSearchRowProps {
  neighborhoodName?: string;
  cityName?: string;
  className?: string;
  locationInputRef?: React.RefObject<HTMLInputElement>;
  agentInputRef?: React.RefObject<HTMLInputElement>;
}

export function NeighborhoodSearchRow({
  neighborhoodName,
  cityName,
  className,
  locationInputRef: externalLocationRef,
  agentInputRef: externalAgentRef,
}: NeighborhoodSearchRowProps) {
  // Location search state
  const [locationValue, setLocationValue] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationSelectedIndex, setLocationSelectedIndex] = useState(0);
  const internalLocationRef = useRef<HTMLInputElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const locationInputRef = externalLocationRef || internalLocationRef;
  
  const { 
    results: locationResults, 
    isSearching: isLocationSearching, 
    error: locationError, 
    search: searchLocation, 
    navigateToNeighborhood, 
    clearResults: clearLocationResults 
  } = useLocationSearch();

  // Agent search state
  const [agentValue, setAgentValue] = useState('');
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [agentSelectedIndex, setAgentSelectedIndex] = useState(0);
  const internalAgentRef = useRef<HTMLInputElement>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const agentInputRef = externalAgentRef || internalAgentRef;

  const {
    results: agentResults,
    isSearching: isAgentSearching,
    error: agentError,
    selectedAgent,
    setSelectedAgent,
    search: searchAgent,
    navigateToAgent,
    clearResults: clearAgentResults,
  } = useAgentNameSearch();

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
      setLocationSelectedIndex(0);
    }
  }, [locationResults, locationValue]);

  // Debounced agent search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (agentValue.trim().length >= 2) {
        searchAgent(agentValue);
      } else {
        clearAgentResults();
        setShowAgentDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [agentValue, searchAgent, clearAgentResults]);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (!showLocationDropdown || locationResults.length === 0) {
      if (e.key === 'Enter' && locationValue.trim().length >= 2) {
        e.preventDefault();
        searchLocation(locationValue);
        setShowLocationDropdown(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setLocationSelectedIndex(prev => Math.min(prev + 1, locationResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setLocationSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (locationResults[locationSelectedIndex]) {
          navigateToNeighborhood(locationResults[locationSelectedIndex], locationSelectedIndex + 1);
          setShowLocationDropdown(false);
          setLocationValue('');
        }
        break;
      case 'Escape':
        setShowLocationDropdown(false);
        break;
    }
  };

  const handleAgentKeyDown = (e: React.KeyboardEvent) => {
    if (!showAgentDropdown || agentResults.length === 0) {
      if (e.key === 'Enter' && agentValue.trim().length >= 2) {
        e.preventDefault();
        searchAgent(agentValue);
        setShowAgentDropdown(true);
      }
      return;
    }

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
        break;
    }
  };

  const handleAgentSelect = (agent: AgentSearchResult) => {
    if (agent.canonical_slug && agent.state_slug) {
      navigateToAgent(agent);
    } else {
      setSelectedAgent(agent);
    }
    setShowAgentDropdown(false);
    setAgentValue('');
  };

  return (
    <>
      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
        {/* Location Search */}
        <div className="relative" ref={locationDropdownRef}>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              ref={locationInputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value)}
              onKeyDown={handleLocationKeyDown}
              onFocus={() => locationResults.length > 0 && setShowLocationDropdown(true)}
              placeholder="Search by ZIP code or neighborhood"
              className="pl-12 pr-4 py-5"
              aria-label="Search by ZIP code or neighborhood"
            />
            {isLocationSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {showLocationDropdown && (locationResults.length > 0 || locationError) && (
            <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {locationError ? (
                <div className="p-3 text-sm text-destructive">{locationError}</div>
              ) : (
                locationResults.map((result, index) => (
                  <button
                    key={result.neighborhood_id}
                    onClick={() => {
                      navigateToNeighborhood(result, index + 1);
                      setShowLocationDropdown(false);
                      setLocationValue('');
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2.5 hover:bg-accent focus:bg-accent focus:outline-none border-b border-border last:border-b-0 transition-colors",
                      locationSelectedIndex === index && "bg-accent"
                    )}
                  >
                    <p className="font-medium text-foreground text-sm">{result.neighborhood}</p>
                    <p className="text-xs text-muted-foreground">{result.city_area}, {result.state}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Agent Name Search */}
        <div className="relative" ref={agentDropdownRef}>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              ref={agentInputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={agentValue}
              onChange={(e) => setAgentValue(e.target.value)}
              onKeyDown={handleAgentKeyDown}
              onFocus={() => agentResults.length > 0 && setShowAgentDropdown(true)}
              placeholder="Search agent name"
              className="pl-12 pr-4 py-5"
              aria-label="Search agent name"
            />
            {isAgentSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {showAgentDropdown && (agentResults.length > 0 || agentError) && (
            <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {agentError ? (
                <div className="p-3 text-sm text-destructive">{agentError}</div>
              ) : (
                agentResults.map((agent, index) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAgentSelect(agent)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 hover:bg-accent focus:bg-accent focus:outline-none border-b border-border last:border-b-0 transition-colors",
                      agentSelectedIndex === index && "bg-accent"
                    )}
                  >
                    <p className="font-medium text-foreground text-sm">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.company && `${agent.company} • `}
                      {agent.years_experience && `${agent.years_experience} yrs exp`}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agent Lookup Modal */}
      <AgentLookupModal
        agent={selectedAgent}
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
      />
    </>
  );
}
