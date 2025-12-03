import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Crown, AlertCircle } from 'lucide-react';
import { getPremiumCities, CityPricingData } from '@/data/arizonaCityPricing';
import { PriceDisplay } from './PriceDisplay';
import { cn } from '@/lib/utils';

interface PremiumAddonsProps {
  selectedCityIds: string[];
  onToggle: (cityId: string) => void;
}

export function PremiumAddons({ selectedCityIds, onToggle }: PremiumAddonsProps) {
  const premiumCities = getPremiumCities();
  
  // Group by tier
  const luxuryCities = premiumCities.filter(c => c.tier === 'Luxury');
  const premiumTierCities = premiumCities.filter(c => c.tier === 'Premium');

  const renderCity = (city: CityPricingData) => {
    const isSelected = selectedCityIds.includes(city.id);
    const spotsLow = city.spotsRemaining <= 5;

    return (
      <Label
        key={city.id}
        htmlFor={`premium-${city.id}`}
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all',
          isSelected
            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <Checkbox
          id={`premium-${city.id}`}
          checked={isSelected}
          onCheckedChange={() => onToggle(city.id)}
          className="mt-1"
        />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{city.cityName}</span>
              {city.tier === 'Luxury' && (
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0">
                  <Crown className="h-3 w-3 mr-1" />
                  Luxury
                </Badge>
              )}
            </div>
            <PriceDisplay 
              retailPrice={city.retailPrice} 
              earlyAdopterPrice={city.earlyAdopterPrice}
              size="sm"
            />
          </div>
          
          {spotsLow && (
            <div className="flex items-center gap-1 text-destructive text-xs">
              <AlertCircle className="h-3 w-3" />
              <span>Only {city.spotsRemaining} spots remaining</span>
            </div>
          )}
        </div>
      </Label>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-500" />
        <h3 className="text-lg font-semibold text-foreground">Premium Markets</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Add high-value markets to reach luxury buyers. These are not included in packages.
      </p>
      
      {luxuryCities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Luxury Tier</p>
          <div className="space-y-2">
            {luxuryCities.map(renderCity)}
          </div>
        </div>
      )}

      {premiumTierCities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary uppercase tracking-wide">Premium Tier</p>
          <div className="space-y-2">
            {premiumTierCities.map(renderCity)}
          </div>
        </div>
      )}
    </div>
  );
}
