import { useState, useEffect, useRef } from 'react';
import { Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { findCityByZip } from '@/data/zipCodeLookup';

interface Category {
  id: string;
  name: string;
  plural_name: string;
  slug: string;
}

interface City {
  id: string;
  name: string;
  state: string;
  state_slug: string;
  slug: string;
}

const ALL_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Puerto Rico',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming'
];

export const Top10SearchForm = () => {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedState, setSelectedState] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [filteredStates, setFilteredStates] = useState<string[]>(ALL_STATES);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch only real estate agent category
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .eq('slug', 'top10realestateagents')
        .order('name');
      
      if (!categoriesError && categoriesData) {
        setCategories(categoriesData);
        // Auto-select the category if there's only one
        if (categoriesData.length === 1) {
          setSelectedCategory(categoriesData[0].id);
        }
      }

      // Fetch cities
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .eq('active', true)
        .order('state, name');
      
      if (!citiesError && citiesData) {
        setCities(citiesData);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (selectedState) {
      const filtered = cities.filter(city => city.state === selectedState);
      setFilteredCities(filtered);
      setSelectedCity(''); // Reset city when state changes
    } else {
      setFilteredCities([]);
    }
  }, [selectedState, cities]);

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
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setStateOpen(false);
      }
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setCityOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!selectedState || !selectedCity || !selectedCategory) {
      toast.error('Please select state, city, and category');
      return;
    }

    const city = cities.find(c => c.id === selectedCity);
    const category = categories.find(c => c.id === selectedCategory);

    if (!city) {
      toast.error('City not found. Please try selecting again.');
      return;
    }

    if (!category) {
      toast.error('Category not found. Please try selecting again.');
      return;
    }

    // Show loading animation
    setIsSearching(true);

    // Check if city has professionals data
    const { data: professionalsData, error: profsError } = await supabase
      .from('professionals')
      .select('id, total_sales, current_listings')
      .eq('city_id', city.id)
      .eq('category_id', category.id)
      .limit(1);

    if (!profsError && professionalsData && professionalsData.length === 0) {
      // No data exists, trigger bulk import
      toast.info('Importing agents for this city...', {
        description: 'This will take about 10 seconds'
      });
      
      supabase.functions.invoke('fetch-zillow-agents-bulk', {
        body: {
          city: city.name,
          state: city.state,
          maxPages: 3,
          categoryId: category.id,
          cityId: city.id
        }
      }).then(({ data, error }) => {
        if (error) {
          console.error('Bulk import error:', error);
        } else if (data?.success) {
          console.log('Bulk import triggered:', data.summary);
        }
      });
    }

    // Navigate to the list page
    const url = `/${city.state_slug}/${city.slug}/${category.slug}`;
    console.log('Navigating to:', url);
    navigate(url);
  };

  const handleCityInputChange = async (value: string) => {
    setCityInput(value);
    
    // Check if input looks like a zip code (5 digits) - do this first
    if (/^\d{5}$/.test(value)) {
      const zipResult = findCityByZip(value);
      
      if (zipResult) {
        toast.success(`Found ${zipResult.city}, ${zipResult.state} for zip ${value}`);
        
        // Auto-select the state
        setSelectedState(zipResult.state);
        setStateInput(zipResult.state);
        
        // Find and auto-select the city
        const cityMatch = cities.find(c => 
          c.name === zipResult.city && c.state === zipResult.state
        );
        
        if (cityMatch) {
          setSelectedCity(cityMatch.id);
          setCityInput(cityMatch.name);
          setCityOpen(false);
        } else {
          toast.info(`${zipResult.city} not yet in our database`);
        }
      } else {
        toast.error(`Zip code ${value} not found in our database`);
      }
    } else {
      // Not a complete zip code - show dropdown and filter cities by name
      setCityOpen(true);
      
      if (selectedState && value) {
        const filtered = cities.filter(c => 
          c.state === selectedState && 
          c.name.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredCities(filtered);
      } else if (!selectedState && value) {
        // If no state selected but typing, show message
        toast.info('Select a state first or enter a 5-digit ZIP code');
      }
    }
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
    <div className="w-full max-w-4xl mx-auto bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Want to find a top10?</h3>
      </div>
      
      <div className="grid md:grid-cols-4 gap-4">
        <div className={cn("relative", stateOpen && "mb-64 md:mb-0")} ref={dropdownRef}>
          <Input
            placeholder="Enter State"
            value={stateInput}
            onChange={(e) => {
              setStateInput(e.target.value);
              setStateOpen(true);
            }}
            onFocus={() => setStateOpen(true)}
            className="bg-background"
          />
          {stateOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-[100] rounded-md border-2 bg-popover shadow-xl max-h-60 overflow-auto">
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
                        setSelectedCity(''); // Reset city when state changes
                        setStateOpen(false);
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

        <div className={cn("relative", cityOpen && "mb-64 md:mb-0")} ref={cityDropdownRef}>
          <Input
            placeholder="Select City or Type Zip Code"
            value={cityInput}
            onChange={(e) => handleCityInputChange(e.target.value)}
            onFocus={() => setCityOpen(true)}
            className="bg-background"
          />
          {cityOpen && filteredCities.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-[100] rounded-md border-2 bg-popover shadow-xl max-h-60 overflow-auto">
              <Command>
                <CommandList>
                  <CommandEmpty>No city found.</CommandEmpty>
                  <CommandGroup>
                    {filteredCities.map((city) => (
                      <CommandItem
                        key={city.id}
                        value={city.name}
                        onSelect={() => {
                          setSelectedCity(city.id);
                          setCityInput(city.name);
                          setCityOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCity === city.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {city.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select Category" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-2 shadow-xl z-[100]">
            {categories.map(category => (
              <SelectItem key={category.id} value={category.id}>
                {category.plural_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          onClick={handleSearch} 
          className="w-full"
          disabled={!selectedState || !selectedCity || !selectedCategory}
        >
          <Search className="h-4 w-4 mr-2" />
          Find Top 10
        </Button>
      </div>
    </div>
  );
};
