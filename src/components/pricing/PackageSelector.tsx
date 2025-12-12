import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Wrench, Circle, CheckCircle2 } from 'lucide-react';
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
  
  const handlePackageClick = (packageId: string) => {
    if (mode === 'package' && selectedPackageId === packageId) {
      // Deselect if already selected
      onPackageSelect(null);
    } else {
      onModeChange('package');
      onPackageSelect(packageId);
    }
  };

  const handleBuildYourOwnClick = () => {
    if (mode === 'build-your-own') {
      // Deselect - go back to no selection
      onModeChange('package');
      onPackageSelect(null);
    } else {
      onModeChange('build-your-own');
    }
  };

  return (
    <div className="space-y-4">
      
      <div className="space-y-3">
        {/* Regional Packages */}
        {REGIONAL_PACKAGES.map((pkg) => {
          const isSelected = selectedPackageId === pkg.id && mode === 'package';
          return (
            <div
              key={pkg.id}
              onClick={() => handlePackageClick(pkg.id)}
              className={cn(
                'flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <div className="mt-1">
                {isSelected ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{pkg.name}</span>
                    {pkg.isPremiumPackage && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">
                        Luxury
                      </Badge>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Early Adopter Discount: ${pkg.earlyAdopterPrice}/mo
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{pkg.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {pkg.includedCityIds.length} cities • <span className="line-through">${pkg.alaCarteTotal}</span> if bought separately
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
            </div>
          );
        })}

        {/* Build Your Own Option */}
        <div
          onClick={handleBuildYourOwnClick}
          className={cn(
            'flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all',
            mode === 'build-your-own'
              ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
              : 'border-border hover:border-accent/50 hover:bg-muted/50'
          )}
        >
          <div className="mt-1">
            {mode === 'build-your-own' ? (
              <CheckCircle2 className="h-4 w-4 text-accent" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-accent" />
              <span className="font-semibold">Build Your Own</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Select individual cities to create a custom coverage area
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
