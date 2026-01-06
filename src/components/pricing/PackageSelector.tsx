import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Package, Wrench, Circle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { REGIONAL_PACKAGES, getPackageCities } from '@/data/arizonaPackages';
import { PriceDisplay } from './PriceDisplay';
import { SelectionMode } from '@/hooks/usePricingCalculator';
import { cn } from '@/lib/utils';

interface PackageSelectorProps {
  mode: SelectionMode;
  selectedPackageId: string | null;
  selectedPackageIds?: string[]; // Support multi-select
  onModeChange: (mode: SelectionMode) => void;
  onPackageSelect: (packageId: string | null) => void;
  onTogglePackage?: (packageId: string) => void; // New multi-select handler
  packageCoveredCityIds?: string[]; // Cities already covered by packages
}

export function PackageSelector({
  mode,
  selectedPackageId,
  selectedPackageIds = [],
  onModeChange,
  onPackageSelect,
  onTogglePackage,
  packageCoveredCityIds = [],
}: PackageSelectorProps) {
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  
  // Use multi-select if available, otherwise fall back to single select
  const isPackageSelected = (packageId: string) => {
    if (selectedPackageIds.length > 0) {
      return selectedPackageIds.includes(packageId);
    }
    return selectedPackageId === packageId && mode === 'package';
  };

  const handlePackageClick = (packageId: string) => {
    if (onTogglePackage) {
      onTogglePackage(packageId);
    } else {
      // Legacy single-select behavior
      if (mode === 'package' && selectedPackageId === packageId) {
        onPackageSelect(null);
      } else {
        onModeChange('package');
        onPackageSelect(packageId);
      }
    }
  };

  const handleBuildYourOwnClick = () => {
    if (mode === 'build-your-own') {
      onModeChange('package');
      onPackageSelect(null);
    } else {
      onModeChange('build-your-own');
    }
  };

  const togglePackageExpand = (e: React.MouseEvent, packageId: string) => {
    e.stopPropagation();
    setExpandedPackages(prev => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      
      <div className="space-y-3">
        {/* Regional Packages */}
        {REGIONAL_PACKAGES.map((pkg) => {
          const isSelected = isPackageSelected(pkg.id);
          const isExpanded = expandedPackages.has(pkg.id);
          const packageCities = getPackageCities(pkg.id);
          
          return (
            <div key={pkg.id} className="space-y-0">
              <div
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
                      Early Adopter: ${pkg.earlyAdopterPrice}/mo
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {pkg.includedCityIds.length} cities • ${pkg.alaCarteTotal} if bought separately
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => togglePackageExpand(e, pkg.id)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Hide cities
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-3 w-3 mr-1" />
                            Show all cities
                          </>
                        )}
                      </Button>
                    </div>
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
              
              {/* Expanded city list */}
              <Collapsible open={isExpanded}>
                <CollapsibleContent>
                  <div className="ml-8 mt-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Cities included in {pkg.name}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {packageCities.map(city => (
                        <Badge 
                          key={city.id} 
                          variant="secondary" 
                          className="text-xs bg-background"
                        >
                          {city.cityName}
                          <span className="ml-1 text-muted-foreground">
                            ${city.earlyAdopterPrice}/mo
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}

        {/* Build Your Own Section Header */}
        <div className="pt-4 mt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-4 w-4 text-accent" />
            <span className="font-semibold text-foreground">Build Your Own</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Select individual cities below to create a custom coverage area
          </p>
        </div>
      </div>
    </div>
  );
}
