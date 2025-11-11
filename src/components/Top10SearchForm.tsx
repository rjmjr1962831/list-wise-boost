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
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedState, setSelectedState] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [stateOpen, setStateOpen] = useState(false);
  const [filteredStates, setFilteredStates] = useState<string[]>(ALL_STATES);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (!categoriesError && categoriesData) {
        setCategories(categoriesData);
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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = () => {
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

    // Navigate to the list page
    const url = `/${city.state_slug}/${city.slug}/${category.slug}`;
    console.log('Navigating to:', url);
    navigate(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Want to find a top10?</h3>
      </div>
      
      <div className="grid md:grid-cols-4 gap-4">
        <div className="relative" ref={dropdownRef}>
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
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border bg-background shadow-md max-h-60 overflow-auto">
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

        <Select 
          key={selectedState} 
          value={selectedCity} 
          onValueChange={setSelectedCity}
          disabled={!selectedState}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select City" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {filteredCities.map(city => (
              <SelectItem key={city.id} value={city.id}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select Category" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
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
