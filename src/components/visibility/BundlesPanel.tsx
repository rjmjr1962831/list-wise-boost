import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BundleCategory } from '@/data/arizonaPackages';

export interface CityBundle {
  id: string;
  name: string;
  description?: string;
  category?: BundleCategory;
  cityIds: string[];
  cityNames?: string[];
}

interface BundlesPanelProps {
  bundles: CityBundle[];
  selectedCities: Set<string>;
  onAddBundle: (bundleId: string, cityIds: string[]) => void;
}

const CATEGORY_LABELS: Record<BundleCategory, string> = {
  'market-type': 'Market-Type Bundles',
  'metro-phoenix': 'Metro Phoenix Coverage',
  'arizona-regional': 'Arizona Regional Coverage',
};

const CATEGORY_ORDER: BundleCategory[] = ['market-type', 'metro-phoenix', 'arizona-regional'];

export function BundlesPanel({
  bundles,
  selectedCities,
  onAddBundle,
}: BundlesPanelProps) {
  const isBundleAdded = (bundle: CityBundle) => {
    return bundle.cityIds.every((id) => selectedCities.has(id));
  };

  // Group bundles by category
  const groupedBundles = CATEGORY_ORDER.reduce((acc, category) => {
    const categoryBundles = bundles.filter(b => b.category === category);
    if (categoryBundles.length > 0) {
      acc.push({ category, bundles: categoryBundles });
    }
    return acc;
  }, [] as { category: BundleCategory; bundles: CityBundle[] }[]);

  // If no categories, show flat list
  const hasCategories = bundles.some(b => b.category);

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <h3 className="font-semibold">Quick Add Bundles</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
          Free
        </span>
      </div>

      {hasCategories ? (
        // Grouped view
        <div className="divide-y">
          {groupedBundles.map(({ category, bundles: categoryBundles }) => (
            <div key={category} className="p-4">
              {/* Category header */}
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                {CATEGORY_LABELS[category]}
              </h4>

              {/* Bundle grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryBundles.map((bundle) => {
                  const isAdded = isBundleAdded(bundle);

                  return (
                    <div
                      key={bundle.id}
                      className={cn(
                        'rounded-lg border p-4 transition-colors',
                        isAdded ? 'bg-muted/50 border-primary/30' : 'bg-background'
                      )}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{bundle.name}</h4>
                          <span className="text-xs text-muted-foreground">
                            {bundle.cityIds.length} {bundle.cityIds.length === 1 ? 'city' : 'cities'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {bundle.cityNames?.join(', ') || bundle.description}
                        </p>
                        <Button
                          variant={isAdded ? 'outline' : 'default'}
                          size="sm"
                          disabled={isAdded}
                          onClick={() => onAddBundle(bundle.id, bundle.cityIds)}
                          className="mt-2"
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Added
                            </>
                          ) : (
                            'Add Bundle'
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat view (fallback)
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {bundles.map((bundle) => {
            const isAdded = isBundleAdded(bundle);

            return (
              <div
                key={bundle.id}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  isAdded ? 'bg-muted/50 border-primary/30' : 'bg-background'
                )}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{bundle.name}</h4>
                    <span className="text-xs text-muted-foreground">
                      {bundle.cityIds.length} cities
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {bundle.cityNames?.join(', ') || bundle.description}
                  </p>
                  <Button
                    variant={isAdded ? 'outline' : 'default'}
                    size="sm"
                    disabled={isAdded}
                    onClick={() => onAddBundle(bundle.id, bundle.cityIds)}
                    className="mt-2"
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Added
                      </>
                    ) : (
                      'Add Bundle'
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bundles.length === 0 && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No bundles available
        </div>
      )}
    </div>
  );
}
