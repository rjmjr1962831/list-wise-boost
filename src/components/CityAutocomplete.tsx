import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import arizonaCompleteData from '@/data/arizonaComplete.json';

interface City {
  city: string;
  population: number;
  region: string;
  neighborhoods?: Array<{
    name: string;
    zip_codes: string[];
  }>;
}

interface CityAutocompleteProps {
  value: string;
  onValueChange: (cityName: string) => void;
  placeholder?: string;
  className?: string;
}

// Extract all cities from metros and other_cities
const allArizonaCities: City[] = [
  ...arizonaCompleteData.metros.flatMap((metro: any) => metro.cities),
  ...arizonaCompleteData.other_cities.cities
].sort((a, b) => a.city.localeCompare(b.city));

export function CityAutocomplete({ 
  value, 
  onValueChange, 
  placeholder = "Start typing the city...",
  className 
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (inputValue) {
      const filtered = allArizonaCities.filter(city =>
        city.city.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredCities(filtered.slice(0, 10)); // Limit to 10 results
    } else {
      setFilteredCities([]);
    }
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCity = (cityName: string) => {
    setInputValue(cityName);
    onValueChange(cityName);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <Input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full"
      />
      
      {open && filteredCities.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
          <Command className="rounded-md border-0">
            <CommandList>
              {filteredCities.length === 0 && inputValue && (
                <CommandEmpty>No cities found.</CommandEmpty>
              )}
              <CommandGroup>
                {filteredCities.map((city) => (
                  <CommandItem
                    key={city.city}
                    value={city.city}
                    onSelect={() => handleSelectCity(city.city)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === city.city ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{city.city}</span>
                      <span className="text-xs text-muted-foreground">
                        Population: {city.population.toLocaleString()} • {city.region}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
