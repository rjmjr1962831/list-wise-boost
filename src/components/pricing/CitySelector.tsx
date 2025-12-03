import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { ARIZONA_CITIES, CityPricingData, getNonPremiumCities } from '@/data/arizonaCityPricing';
import { cn } from '@/lib/utils';

interface CitySelectorProps {
  selectedCityIds: string[];
  onToggle: (cityId: string) => void;
  disabled?: boolean;
}

type Region = CityPricingData['region'];

const REGION_ORDER: Region[] = [
  'Phoenix Metro',
  'East Valley', 
  'West Valley',
  'Northern Arizona',
  'Southern Arizona',
];

export function CitySelector({ selectedCityIds, onToggle, disabled }: CitySelectorProps) {
  const [expandedRegions, setExpandedRegions] = useState<Set<Region>>(new Set(['Phoenix Metro', 'East Valley']));
  
  const nonPremiumCities = getNonPremiumCities();
  
  // Group cities by region
  const citiesByRegion = REGION_ORDER.reduce((acc, region) => {
    acc[region] = nonPremiumCities.filter(c => c.region === region);
    return acc;
  }, {} as Record<Region, CityPricingData[]>);

  const toggleRegion = (region: Region) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedRegions(new Set(REGION_ORDER));
  const collapseAll = () => setExpandedRegions(new Set());

  const getTierColor = (tier: CityPricingData['tier']) => {
    switch (tier) {
      case 'Major Market': return 'bg-primary/10 text-primary';
      case 'Suburban': return 'bg-accent/10 text-accent';
      case 'Growth': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'Emerging': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Entry': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Select Individual Cities</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {disabled && (
        <p className="text-sm text-muted-foreground italic">
          Switch to "Build Your Own" to select individual cities
        </p>
      )}

      <div className="space-y-2">
        {REGION_ORDER.map(region => {
          const cities = citiesByRegion[region];
          if (!cities || cities.length === 0) return null;
          
          const isExpanded = expandedRegions.has(region);
          const selectedCount = cities.filter(c => selectedCityIds.includes(c.id)).length;

          return (
            <Collapsible
              key={region}
              open={isExpanded}
              onOpenChange={() => toggleRegion(region)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{region}</span>
                  <Badge variant="secondary" className="text-xs">
                    {cities.length} cities
                  </Badge>
                </div>
                {selectedCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground">
                    {selectedCount} selected
                  </Badge>
                )}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                  {cities.map(city => {
                    const isSelected = selectedCityIds.includes(city.id);
                    return (
                      <Label
                        key={city.id}
                        htmlFor={`city-${city.id}`}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/30'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`city-${city.id}`}
                            checked={isSelected}
                            onCheckedChange={() => onToggle(city.id)}
                          />
                          <span className="text-sm font-medium">{city.cityName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={cn('text-xs', getTierColor(city.tier))}>
                            {city.tier}
                          </Badge>
                          <span className="text-sm font-semibold text-primary">
                            ${city.earlyAdopterPrice}
                          </span>
                        </div>
                      </Label>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
