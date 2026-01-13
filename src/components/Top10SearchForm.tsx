import { useState, useEffect, useRef } from 'react';
import { Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import { NeighborhoodAutocomplete } from '@/components/NeighborhoodAutocomplete';
import arizonaCompleteData from '@/data/arizonaComplete.json';

interface ArizonaCity {
  city: string;
  population: number;
  region: string;
}

// Extract all cities from the new complete data structure
const arizonaCities: ArizonaCity[] = [
  ...arizonaCompleteData.metros.flatMap((metro: any) => metro.cities),
  ...arizonaCompleteData.other_cities.cities
];

const ALL_STATES = ['Arizona']; // Only Arizona for now

export const Top10SearchForm = () => {
  const navigate = useNavigate();
  const { trackEvent } = useGA4Tracking();
  const stateDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedState, setSelectedState] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [filteredCities, setFilteredCities] = useState<ArizonaCity[]>([]);
  const [filteredStates, setFilteredStates] = useState<string[]>(ALL_STATES);
  const [stateOpen, setStateOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [selectedNeighborhoodSlug, setSelectedNeighborhoodSlug] = useState('');
  const [selectedNeighborhoodZip, setSelectedNeighborhoodZip] = useState('');

  useEffect(() => {
    // Update cities when state changes to Arizona
    if (selectedState === 'Arizona') {
      const sortedCities = [...arizonaCities].sort((a, b) => a.city.localeCompare(b.city));
      setFilteredCities(sortedCities);
    } else {
      setFilteredCities([]);
    }
    setSelectedCity('');
    // Clear neighborhood when state changes
    setSelectedNeighborhood('');
    setSelectedNeighborhoodSlug('');
  }, [selectedState]);

  // Clear neighborhood when city changes
  useEffect(() => {
    setSelectedNeighborhood('');
    setSelectedNeighborhoodSlug('');
    setSelectedNeighborhoodZip('');
  }, [selectedCity]);

  useEffect(() => {
    if (stateInput) {
      const filtered = ALL_STATES.filter(state => 
        state.toLowerCase().includes(stateInput.toLowerCase())
      );
      setFilteredStates(filtered);
    } else {
      setFilteredStates(ALL_STATES);
    }
  }, [stateInput]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(target)) {
        setStateOpen(false);
      }
    };

    // Use both mousedown and touchstart for cross-platform compatibility
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSearch = async () => {
    if (!selectedState || !selectedCity) {
      toast.error('Please select state and city');
      return;
    }

    setIsSearching(true);

    try {
      // Track search form submission
      trackEvent('search_form_submit', {
        state: selectedState,
        city: selectedCity,
        neighborhood: selectedNeighborhood || 'none',
        search_type: 'top10_search'
      } as any);

      // For Arizona cities from the new data, we need to check if they exist in the database
      // If not, we'll show a message that data is being prepared
      const { data: cityData, error: cityError } = await supabase
        .from('cities')
        .select('*')
        .eq('name', selectedCity)
        .eq('state', selectedState)
        .eq('active', true)
        .maybeSingle();

      if (cityError && cityError.code !== 'PGRST116') {
        console.error('Database error:', cityError);
        toast.error('Error searching for city');
        setIsSearching(false);
        return;
      }

      if (!cityData) {
        // City not in database yet - this is expected for new Arizona cities
        toast.info(`${selectedCity}, ${selectedState} data is being prepared`, {
          description: 'We\'re currently building the agent database for this city. Please check back soon!'
        });
        setIsSearching(false);
        return;
      }

      // Get the real estate agents category
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', 'top10realestateagents')
        .eq('active', true)
        .single();

      if (categoryError || !categoryData) {
        toast.error('Category not found');
        setIsSearching(false);
        return;
      }

      // First check if there are cross-linked agents via professional_cities
      const { data: linkedProfs, error: linkedError } = await supabase
        .from('professional_cities')
        .select('id')
        .eq('city_id', cityData.id)
        .eq('active', true)
        .limit(1);

      // If linked agents exist, navigate directly without import
      if (!linkedError && linkedProfs && linkedProfs.length > 0) {
        // Build URL with neighborhood and ZIP when available (5-segment canonical format)
        let url = `/${cityData.state_slug}/${cityData.slug}`;
        if (selectedNeighborhoodSlug && selectedNeighborhoodZip) {
          url += `/${selectedNeighborhoodZip}/${selectedNeighborhoodSlug}`;
        } else if (selectedNeighborhoodSlug) {
          url += `/${selectedNeighborhoodSlug}`;
        }
        url += `/${categoryData.slug}`;
        navigate(url);
        return;
      }

      // Check if professionals exist directly for this city
      const { data: professionalsData, error: profsError } = await supabase
        .from('professionals')
        .select('id')
        .eq('city_id', cityData.id)
        .eq('category_id', categoryData.id)
        .limit(1);

      if (!profsError && professionalsData && professionalsData.length === 0) {
        // No data exists, trigger import
        toast.info('Importing agents for ' + selectedCity + '...');
        
        try {
          const importResult = await supabase.functions.invoke('import-city-agents', {
            body: {
              cityId: cityData.id,
              categoryId: categoryData.id
            }
          });

          if (importResult.error) {
            console.error('Import error:', importResult.error);
          }
        } catch (err) {
          console.error('Import exception:', err);
        }
      }

      // Navigate to the list page with 5-segment URL when ZIP available
      let url = `/${cityData.state_slug}/${cityData.slug}`;
      if (selectedNeighborhoodSlug && selectedNeighborhoodZip) {
        url += `/${selectedNeighborhoodZip}/${selectedNeighborhoodSlug}`;
      } else if (selectedNeighborhoodSlug) {
        url += `/${selectedNeighborhoodSlug}`;
      }
      url += `/${categoryData.slug}`;
      navigate(url);
    } catch (err: any) {
      console.error('Search error:', err);
      toast.error('Search failed: ' + err.message);
      setIsSearching(false);
    }
  };

  const handleNeighborhoodChange = (neighborhood: string, slug: string, primaryZip: string | null) => {
    setSelectedNeighborhood(neighborhood);
    setSelectedNeighborhoodSlug(slug);
    setSelectedNeighborhoodZip(primaryZip || '');
    
    trackEvent('search_neighborhood_select', {
      state: selectedState,
      city: selectedCity,
      neighborhood: neighborhood,
      primary_zip: primaryZip || '',
      search_type: 'top10_search'
    } as any);
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
    <div className="w-full max-w-5xl mx-auto bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl px-6 pt-2 pb-6 shadow-lg relative z-10">
      <div className="flex items-center gap-2 mb-1">
        <Search className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Find your top10 Real estate agents</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* State Selector */}
        <div className={cn("relative", stateOpen && "mb-64 md:mb-0")} ref={stateDropdownRef}>
          <Input
            placeholder="Select State"
            value={stateInput}
            onChange={(e) => {
              setStateInput(e.target.value);
              setStateOpen(true);
            }}
            onFocus={() => setStateOpen(true)}
            className="bg-background"
          />
          {stateOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-[200] rounded-md border-2 bg-popover shadow-xl max-h-60 overflow-auto">
              <Command>
                <CommandList>
                  <CommandEmpty>No state found.</CommandEmpty>
                  <CommandGroup>
                    {filteredStates.map((state) => (
                      <CommandItem
                        key={state}
                        value={state}
                        onSelect={() => {
                          setSelectedState(state);
                          setStateInput(state);
                          setStateOpen(false);
                          
                          trackEvent('search_state_select', {
                            state: state,
                            search_type: 'top10_search'
                          } as any);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedState === state ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {state}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
        </div>

        {/* City Autocomplete */}
        <CityAutocomplete
          value={selectedCity}
          onValueChange={(city) => {
            setSelectedCity(city);
            
            trackEvent('search_city_select', {
              state: selectedState,
              city: city,
              search_type: 'top10_search'
            } as any);
          }}
          placeholder="Start typing the city..."
        />

        {/* Neighborhood Autocomplete */}
        <NeighborhoodAutocomplete
          state={selectedState}
          cityArea={selectedCity}
          value={selectedNeighborhood}
          onValueChange={handleNeighborhoodChange}
          placeholder="Neighborhood (optional)"
          disabled={!selectedCity}
        />

        {/* Search Button */}
        <Button 
          type="button"
          onClick={handleSearch} 
          onTouchEnd={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="w-full"
          disabled={!selectedState || !selectedCity}
        >
          <Search className="h-4 w-4 mr-2" />
          Find Top 10
        </Button>
      </div>
    </div>
  );
};
