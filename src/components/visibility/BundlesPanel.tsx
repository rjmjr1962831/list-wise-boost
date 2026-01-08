import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CityBundle {
  id: string;
  name: string;
  description?: string;
  cityIds: string[];
}

interface BundlesPanelProps {
  bundles: CityBundle[];
  selectedCities: Set<string>;
  onAddBundle: (bundleId: string, cityIds: string[]) => void;
}

export function BundlesPanel({
  bundles,
  selectedCities,
  onAddBundle,
}: BundlesPanelProps) {
  const isBundleAdded = (bundle: CityBundle) => {
    return bundle.cityIds.every((id) => selectedCities.has(id));
  };

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <h3 className="font-semibold">Quick Add Bundles</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
          Free
        </span>
      </div>

      {/* Bundle grid */}
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
                <h4 className="font-medium">{bundle.name}</h4>
                {bundle.description && (
                  <p className="text-sm text-muted-foreground">
                    {bundle.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {bundle.cityIds.length} cities
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

      {bundles.length === 0 && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No bundles available
        </div>
      )}
    </div>
  );
}
