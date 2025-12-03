import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Wrench } from 'lucide-react';
import { REGIONAL_PACKAGES } from '@/data/arizonaPackages';
import { PriceDisplay } from './PriceDisplay';
import { SelectionMode } from '@/hooks/usePricingCalculator';
import { cn } from '@/lib/utils';

interface PackageSelectorProps {
  mode: SelectionMode;
  selectedPackageId: string | null;
  onModeChange: (mode: SelectionMode) => void;
  onPackageSelect: (packageId: string | null) => void;
}

export function PackageSelector({
  mode,
  selectedPackageId,
  onModeChange,
  onPackageSelect,
}: PackageSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Choose Your Coverage</h3>
      
      <RadioGroup 
        value={mode === 'build-your-own' ? 'build-your-own' : (selectedPackageId || '')}
        onValueChange={(value) => {
          if (value === 'build-your-own') {
            onModeChange('build-your-own');
          } else {
            onModeChange('package');
            onPackageSelect(value);
          }
        }}
        className="space-y-3"
      >
        {/* Regional Packages */}
        {REGIONAL_PACKAGES.map((pkg) => (
          <Label
            key={pkg.id}
            htmlFor={pkg.id}
            className={cn(
              'flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all',
              selectedPackageId === pkg.id && mode === 'package'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            <RadioGroupItem value={pkg.id} id={pkg.id} className="mt-1" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{pkg.name}</span>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Save ${pkg.savings}/mo
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{pkg.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {pkg.includedCityIds.length} cities included
                </span>
                <PriceDisplay 
                  retailPrice={pkg.retailTotal} 
                  earlyAdopterPrice={pkg.earlyAdopterPrice}
                  size="sm"
                />
              </div>
              {pkg.excludedPremiumCities.length > 0 && (
                <p className="text-xs text-muted-foreground italic">
                  * Excludes premium markets: {pkg.excludedPremiumCities.map(c => 
                    c.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  ).join(', ')}
                </p>
              )}
            </div>
          </Label>
        ))}

        {/* Build Your Own Option */}
        <Label
          htmlFor="build-your-own"
          className={cn(
            'flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all',
            mode === 'build-your-own'
              ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
              : 'border-border hover:border-accent/50 hover:bg-muted/50'
          )}
        >
          <RadioGroupItem value="build-your-own" id="build-your-own" className="mt-1" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-accent" />
              <span className="font-semibold">Build Your Own</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Select individual cities to create a custom coverage area
            </p>
          </div>
        </Label>
      </RadioGroup>
    </div>
  );
}
