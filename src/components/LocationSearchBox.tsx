import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLocationSearch } from '@/hooks/useLocationSearch';
import { cn } from '@/lib/utils';

interface LocationSearchBoxProps {
  placeholder?: string;
  className?: string;
}

export const LocationSearchBox = ({ 
  placeholder = "Search by neighborhood or ZIP code",
  className 
}: LocationSearchBoxProps) => {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasUserNavigatedWithArrows, setHasUserNavigatedWithArrows] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { results, isSearching, error, search, navigateToNeighborhood, handleSubmit, clearResults } = useLocationSearch();

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim().length >= 2) {
        search(inputValue);
      } else {
        clearResults();
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Auto-open dropdown when results arrive
  useEffect(() => {
    if (results.length > 0 && inputValue.trim().length >= 2) {
      setShowDropdown(true);
    }
  }, [results, inputValue]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
    setHasUserNavigatedWithArrows(false);
  }, [results]);

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // Enter when dropdown closed or no results
    if (e.key === 'Enter' && (!showDropdown || results.length === 0)) {
      e.preventDefault();
      setShowDropdown(true);
      await handleSubmit(inputValue);
      return;
    }

    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHasUserNavigatedWithArrows(true);
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHasUserNavigatedWithArrows(true);
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        // Only navigate if user selected with arrows OR single result
        if (hasUserNavigatedWithArrows || results.length === 1) {
          if (results[selectedIndex]) {
            navigateToNeighborhood(results[selectedIndex], selectedIndex + 1);
            setShowDropdown(false);
            setInputValue('');
          }
        }
        // Otherwise keep dropdown open
        break;
      case 'Escape':
        setShowDropdown(false);
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const selectedElement = dropdownRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  return (
    <div className={cn("relative w-full max-w-2xl", className)} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="pl-12 pr-4 py-6 text-lg"
          aria-label="Search neighborhoods"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-expanded={showDropdown}
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {showDropdown && (results.length > 0 || error) && (
        <div 
          id="search-results"
          className="absolute z-50 w-full mt-2 bg-background border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto"
          role="listbox"
        >
          {error ? (
            <div className="p-4 text-sm text-destructive">{error}</div>
          ) : (
            results.map((result, index) => (
              <button
                key={result.neighborhood_id}
                data-index={index}
                onClick={() => {
                  navigateToNeighborhood(result, index + 1);
                  setShowDropdown(false);
                  setInputValue('');
                }}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-accent focus:bg-accent focus:outline-none border-b border-border last:border-b-0 transition-colors",
                  selectedIndex === index && "bg-accent"
                )}
                role="option"
                aria-selected={selectedIndex === index}
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
  );
};
