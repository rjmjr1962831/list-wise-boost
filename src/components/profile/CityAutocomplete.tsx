import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface City {
  id: string;
  name: string;
  state: string;
  slug?: string;
}

interface CityAutocompleteProps {
  cities: City[];
  value: string;
  onValueChange: (cityId: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CityAutocomplete({
  cities,
  value,
  onValueChange,
  placeholder = "Start typing a city name...",
  className,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  
  const selectedCity = cities.find((city) => city.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full max-w-md justify-between", className)}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedCity ? (
              <>
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                {selectedCity.name}, {selectedCity.state}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50 bg-popover border border-border shadow-lg" align="start">
        <Command>
          <CommandInput placeholder="Search cities..." />
          <CommandList>
            <CommandEmpty>No city found.</CommandEmpty>
            <CommandGroup>
              {cities.map((city) => (
                <CommandItem
                  key={city.id}
                  value={`${city.name} ${city.state}`}
                  onSelect={() => {
                    onValueChange(city.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === city.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                  {city.name}, {city.state}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
