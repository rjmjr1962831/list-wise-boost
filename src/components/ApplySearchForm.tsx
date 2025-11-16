import { useState, useEffect, useRef } from 'react';
import { UserPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { findCityByZip } from '@/data/zipCodeLookup';

interface City {
  id: string;
  name: string;
  state: string;
  state_slug: string;
  slug: string;
}

const ALL_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Puerto Rico', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

export const ApplySearchForm = () => {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLButtonElement>(null);
  const cityDropdownRef = useRef<HTMLButtonElement>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedState, setSelectedState] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [filteredStates, setFilteredStates] = useState<string[]>(ALL_STATES);

  useEffect(() => {
    const fetchCities = async () => {
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .eq('active', true)
        .order('state, name');
      
      if (!citiesError && citiesData) {
        setCities(citiesData);
      }
    };

    fetchCities();
  }, []);

  useEffect(() => {
    if (selectedState) {
      const filtered = cities.filter(city => city.state === selectedState);
      setFilteredCities(filtered);
    } else {
      setFilteredCities(cities);
    }
  }, [selectedState, cities]);

  useEffect(() => {
    const filtered = ALL_STATES.filter(state =>
      state.toLowerCase().includes(stateInput.toLowerCase())
    );
    setFilteredStates(filtered);
  }, [stateInput]);

  const handleApply = () => {
    if (!selectedState && !selectedCity) {
      toast.error('Please select a state or city');
      return;
    }

    // Navigate to apply page with location info
    const params = new URLSearchParams();
    if (selectedCity) {
      const city = cities.find(c => c.id === selectedCity);
      if (city) {
        params.set('city', city.slug);
        params.set('state', city.state_slug);
      }
    } else if (selectedState) {
      const stateSlug = selectedState.toLowerCase().replace(/\s+/g, '-');
      params.set('state', stateSlug);
    }
    
    navigate(`/apply-listing?${params.toString()}`);
  };

  const handleZipCodeSearch = () => {
    const zipMatch = cityInput.match(/\b\d{5}\b/);
    if (zipMatch) {
      const zipCode = zipMatch[0];
      const cityData = findCityByZip(zipCode);
      
      if (cityData) {
        const matchingCity = cities.find(
          c => c.name.toLowerCase() === cityData.city.toLowerCase() && 
               c.state === cityData.state
        );
        
        if (matchingCity) {
          setSelectedCity(matchingCity.id);
          setCityInput(`${matchingCity.name}, ${matchingCity.state}`);
          setSelectedState(matchingCity.state);
          setStateInput(matchingCity.state);
          setCityOpen(false);
          toast.success(`Found ${matchingCity.name}, ${matchingCity.state}`);
        }
      }
    }
  };

  useEffect(() => {
    if (cityInput.match(/\b\d{5}\b/)) {
      handleZipCodeSearch();
    }
  }, [cityInput]);

  return (
    <div className="bg-card rounded-lg shadow-lg p-8 border border-border">
      <h2 className="text-2xl font-bold text-center mb-2 text-foreground">
        Want to be considered for Top10 status?
      </h2>
      <p className="text-center text-muted-foreground mb-6">
        Apply to be featured in your area
      </p>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* State Selector */}
          <Popover open={stateOpen} onOpenChange={setStateOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={dropdownRef}
                variant="outline"
                role="combobox"
                aria-expanded={stateOpen}
                className="w-full justify-between bg-background"
              >
                {selectedState || "Select State"}
                <Check className={cn("ml-2 h-4 w-4", selectedState ? "opacity-100" : "opacity-0")} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <Input
                  placeholder="Search state..."
                  value={stateInput}
                  onChange={(e) => setStateInput(e.target.value)}
                  className="border-0 focus-visible:ring-0"
                />
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
                          setSelectedCity('');
                          setCityInput('');
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedState === state ? "opacity-100" : "opacity-0")} />
                        {state}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* City Selector */}
          <Popover open={cityOpen} onOpenChange={setCityOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={cityDropdownRef}
                variant="outline"
                role="combobox"
                aria-expanded={cityOpen}
                className="w-full justify-between bg-background"
              >
                {selectedCity
                  ? `${cities.find(c => c.id === selectedCity)?.name}, ${cities.find(c => c.id === selectedCity)?.state}`
                  : "Select City or Enter ZIP"}
                <Check className={cn("ml-2 h-4 w-4", selectedCity ? "opacity-100" : "opacity-0")} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <Input
                  placeholder="Search city or ZIP code..."
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  className="border-0 focus-visible:ring-0"
                />
                <CommandList>
                  <CommandEmpty>No city found.</CommandEmpty>
                  <CommandGroup>
                    {filteredCities
                      .filter(city => 
                        city.name.toLowerCase().includes(cityInput.toLowerCase()) ||
                        city.state.toLowerCase().includes(cityInput.toLowerCase())
                      )
                      .slice(0, 50)
                      .map((city) => (
                        <CommandItem
                          key={city.id}
                          value={`${city.name}, ${city.state}`}
                          onSelect={() => {
                            setSelectedCity(city.id);
                            setCityInput(`${city.name}, ${city.state}`);
                            setSelectedState(city.state);
                            setStateInput(city.state);
                            setCityOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedCity === city.id ? "opacity-100" : "opacity-0")} />
                          {city.name}, {city.state}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <Button 
          onClick={handleApply}
          className="w-full"
          size="lg"
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Apply to be Listed
        </Button>
      </div>
    </div>
  );
};
