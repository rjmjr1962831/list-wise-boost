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

  const hasCategories = bundles.some(b => b.category);

  const BundleCard = ({ bundle }: { bundle: CityBundle }) => {
    const isAdded = isBundleAdded(bundle);
    return (
      <div
        className={cn(
          'rounded-lg border p-4 transition-colors',
          isAdded ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white">{bundle.name}</h4>
            <span className="text-xs text-slate-500">
              {bundle.cityIds.length} {bundle.cityIds.length === 1 ? 'city' : 'cities'}
            </span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            {bundle.cityNames?.join(', ') || bundle.description}
          </p>
          <Button
            variant={isAdded ? 'outline' : 'default'}
            size="sm"
            disabled={isAdded}
            onClick={() => onAddBundle(bundle.id, bundle.cityIds)}
            className={cn("mt-2", isAdded && "border-emerald-500/30 text-emerald-400")}
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
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-white/10">
        <h3 className="font-semibold text-white">Quick Add Bundles</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
          Free
        </span>
      </div>

      {hasCategories ? (
        <div className="divide-y divide-white/10">
          {groupedBundles.map(({ category, bundles: categoryBundles }) => (
            <div key={category} className="p-4">
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                {CATEGORY_LABELS[category]}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryBundles.map((bundle) => (
                  <BundleCard key={bundle.id} bundle={bundle} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {bundles.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      )}

      {bundles.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">
          No bundles available
        </div>
      )}
    </div>
  );
}
