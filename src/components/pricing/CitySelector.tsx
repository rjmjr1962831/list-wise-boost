import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, MapPin, Lock } from 'lucide-react';
import { ARIZONA_CITIES, CityPricingData, getNonPremiumCities, Region } from '@/data/arizonaCityPricing';
import { cn } from '@/lib/utils';

interface CitySelectorProps {
  selectedCityIds: string[];
  onToggle: (cityId: string) => void;
  disabled?: boolean;
  packageCoveredCityIds?: string[]; // Cities covered by selected packages
}

const REGION_ORDER: Region[] = [
  'East Valley', 
  'West Valley',
  'North Valley',
  'Phoenix Central',
  'Northern Arizona',
  'Southern Arizona',
];

export function CitySelector({ 
  selectedCityIds, 
  onToggle, 
  disabled,
  packageCoveredCityIds = [] 
}: CitySelectorProps) {
  const [expandedRegions, setExpandedRegions] = useState<Set<Region>>(new Set());
  
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
    <div className="space-y-4">
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

      {packageCoveredCityIds.length > 0 && !disabled && (
        <p className="text-sm text-muted-foreground italic flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Cities included in your selected packages are already covered and shown as locked
        </p>
      )}

      <div className="space-y-2">
        {REGION_ORDER.map(region => {
          const cities = citiesByRegion[region];
          if (!cities || cities.length === 0) return null;
          
          const isExpanded = expandedRegions.has(region);
          const availableCities = cities.filter(c => !packageCoveredCityIds.includes(c.id));
          const coveredCities = cities.filter(c => packageCoveredCityIds.includes(c.id));
          const selectedCount = availableCities.filter(c => selectedCityIds.includes(c.id)).length;

          return (
            <Collapsible
              key={region}
              open={isExpanded}
              onOpenChange={() => toggleRegion(region)}
            >
              <CollapsibleTrigger asChild>
                <button 
                  type="button"
                  className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    )}
                    <span className="font-medium text-foreground">{region}</span>
                    <Badge variant="secondary" className="text-xs">
                      {availableCities.length} available
                    </Badge>
                    {coveredCities.length > 0 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {coveredCities.length} in package
                      </Badge>
                    )}
                  </div>
                  {selectedCount > 0 && (
                    <Badge className="bg-primary text-primary-foreground">
                      {selectedCount} selected
                    </Badge>
                  )}
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                  {/* Show covered cities first (disabled) */}
                  {coveredCities.map(city => (
                    <div
                      key={city.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">{city.cityName}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        In package
                      </Badge>
                    </div>
                  ))}
                  
                  {/* Show available cities */}
                  {availableCities.map(city => {
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
                            disabled={disabled}
                          />
                          <span className="text-sm font-medium">{city.cityName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm line-through text-muted-foreground">
                            ${city.retailPrice}
                          </span>
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
