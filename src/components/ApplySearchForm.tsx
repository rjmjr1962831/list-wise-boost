import { useState, useEffect, useRef } from 'react';
import { UserPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
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

  const handleApply = () => {
    if (!selectedState && !selectedCity) {
      toast.error('Please select a state or city');
      return;
    }

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

  return (
    <div className="w-full max-w-4xl mx-auto bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Want to be considered for Top10 status?</h3>
      </div>
      
      <div className="grid md:grid-cols-3 gap-4">
        {/* State Input */}
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
                          setSelectedCity('');
                          setCityInput('');
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

        {/* City Input */}
        <div className={cn("relative", cityOpen && "mb-64 md:mb-0")} ref={cityDropdownRef}>
          <Input
            placeholder="Enter City or ZIP"
            value={cityInput}
            onChange={(e) => {
              const value = e.target.value;
              setCityInput(value);
              
              if (/^\d{5}$/.test(value)) {
                const zipResult = findCityByZip(value);
                
                if (zipResult) {
                  toast.success(`Found ${zipResult.city}, ${zipResult.state} for zip ${value}`);
                  setSelectedState(zipResult.state);
                  setStateInput(zipResult.state);
                  
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
                setCityOpen(true);
                
                if (selectedState && value) {
                  const filtered = cities.filter(c => 
                    c.state === selectedState && 
                    c.name.toLowerCase().includes(value.toLowerCase())
                  );
                  setFilteredCities(filtered);
                } else if (!selectedState && value) {
                  toast.info('Select a state first or enter a 5-digit ZIP code');
                }
              }
            }}
            onFocus={() => setCityOpen(true)}
            className="bg-background"
          />
          {cityOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-[100] rounded-md border-2 bg-popover shadow-xl max-h-60 overflow-auto">
              <Command>
                <CommandList>
                  <CommandEmpty>No city found.</CommandEmpty>
                  <CommandGroup>
                    {filteredCities.slice(0, 10).map((city) => (
                      <CommandItem
                        key={city.id}
                        value={city.id}
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
                        {city.name}, {city.state}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
        </div>

        {/* Apply Button */}
        <Button 
          onClick={handleApply} 
          className="w-full md:w-auto bg-primary hover:bg-primary/90"
          disabled={!selectedState && !selectedCity}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Apply to be Listed
        </Button>
      </div>
    </div>
  );
};
