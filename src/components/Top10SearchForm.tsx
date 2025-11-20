import { useState, useEffect, useRef } from 'react';
import { Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import arizonaMetrosData from '@/data/arizonaMetros.json';

interface Neighborhood {
  name: string;
  zip_codes: string[];
}

interface ArizonaCity {
  city: string;
  population: number;
  region: string;
  neighborhoods: Neighborhood[];
}

const arizonaCities: ArizonaCity[] = arizonaMetrosData.metros.flatMap((metro: any) => metro.cities);

export const Top10SearchForm = () => {
  const navigate = useNavigate();
  const { trackEvent } = useGA4Tracking();
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [filteredCities, setFilteredCities] = useState<ArizonaCity[]>(arizonaCities);
  const [cityOpen, setCityOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [availableNeighborhoods, setAvailableNeighborhoods] = useState<Neighborhood[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<Set<string>>(new Set());
  const [selectAllNeighborhoods, setSelectAllNeighborhoods] = useState(false);
  const selectedState = 'Arizona'; // Fixed to Arizona

  useEffect(() => {
    // Update neighborhoods when city changes
    if (selectedCity) {
      const city = arizonaCities.find(c => c.city === selectedCity);
      if (city) {
        setAvailableNeighborhoods(city.neighborhoods);
        setSelectedNeighborhoods(new Set());
        setSelectAllNeighborhoods(false);
      }
    } else {
      setAvailableNeighborhoods([]);
      setSelectedNeighborhoods(new Set());
      setSelectAllNeighborhoods(false);
    }
  }, [selectedCity]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setCityOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!selectedCity) {
      toast.error('Please select a city');
      return;
    }

    // Track search form submission
    trackEvent('search_form_submit', {
      state: 'Arizona',
      city: selectedCity,
      search_type: 'top10_search'
    } as any);

    // For now, navigate to a default route (you'll need to update this based on your routing)
    toast.info('Search functionality coming soon');
  };

  const handleCityInputChange = (value: string) => {
    setCityInput(value);
    setCityOpen(true);
    
    if (value) {
      const filtered = arizonaCities.filter(c => 
        c.city.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCities(filtered);
    } else {
      setFilteredCities(arizonaCities);
    }
  };

  const handleToggleAllNeighborhoods = () => {
    if (selectAllNeighborhoods) {
      setSelectedNeighborhoods(new Set());
      setSelectAllNeighborhoods(false);
    } else {
      const allNames = new Set(availableNeighborhoods.map(n => n.name));
      setSelectedNeighborhoods(allNames);
      setSelectAllNeighborhoods(true);
    }
  };

  const handleToggleNeighborhood = (name: string) => {
    const newSelected = new Set(selectedNeighborhoods);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedNeighborhoods(newSelected);
    setSelectAllNeighborhoods(newSelected.size === availableNeighborhoods.length);
  };

  if (isSearching) {
    return (
      <div className="w-full flex items-center justify-center py-8">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden="true" />
          <span>Searching…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl px-6 pt-2 pb-6 shadow-lg relative z-10">
      <div className="flex items-center gap-2 mb-1">
        <Search className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Find your top10 Real estate agents in Arizona</h3>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className={cn("relative", cityOpen && "mb-64 md:mb-0")} ref={cityDropdownRef}>
          <Input
            placeholder="Select City"
            value={cityInput}
            onChange={(e) => handleCityInputChange(e.target.value)}
            onFocus={() => setCityOpen(true)}
            className="bg-background"
          />
          {cityOpen && filteredCities.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-[200] rounded-md border-2 bg-popover shadow-xl max-h-60 overflow-auto">
              <Command>
                <CommandList>
                  <CommandEmpty>No city found.</CommandEmpty>
                  <CommandGroup>
                    {filteredCities.map((city) => (
                      <CommandItem
                        key={city.city}
                        value={city.city}
                        onSelect={() => {
                          setSelectedCity(city.city);
                          setCityInput(city.city);
                          setCityOpen(false);
                          
                          trackEvent('search_city_select', {
                            state: 'Arizona',
                            city: city.city,
                            search_type: 'top10_search'
                          });
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCity === city.city ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {city.city}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
        </div>

        <Button 
          onClick={handleSearch} 
          className="w-full"
          disabled={!selectedCity}
        >
          <Search className="h-4 w-4 mr-2" />
          Find Top 10
        </Button>
      </div>

      {/* Neighborhoods Section */}
      {availableNeighborhoods.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold mb-3">Select Neighborhoods (Optional)</h4>
          
          {/* Select All Checkbox */}
          <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg border mb-3">
            <Checkbox
              id="select-all-neighborhoods"
              checked={selectAllNeighborhoods}
              onCheckedChange={handleToggleAllNeighborhoods}
              className="h-5 w-5"
            />
            <label
              htmlFor="select-all-neighborhoods"
              className="text-sm font-medium cursor-pointer flex-1"
            >
              Select All Neighborhoods
            </label>
          </div>

          {/* Neighborhood List */}
          <ScrollArea className="h-[200px] rounded-md border p-3">
            <div className="space-y-2">
              {availableNeighborhoods.map((neighborhood) => (
                <div
                  key={neighborhood.name}
                  className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md transition-colors"
                >
                  <Checkbox
                    id={neighborhood.name}
                    checked={selectedNeighborhoods.has(neighborhood.name)}
                    onCheckedChange={() => handleToggleNeighborhood(neighborhood.name)}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor={neighborhood.name}
                    className="text-sm cursor-pointer flex-1"
                  >
                    <span className="font-medium">{neighborhood.name}</span>
                    <span className="text-muted-foreground ml-2">
                      ({neighborhood.zip_codes.length} zip code{neighborhood.zip_codes.length !== 1 ? 's' : ''})
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
