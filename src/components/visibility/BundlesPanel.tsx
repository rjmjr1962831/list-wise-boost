import { useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface CityBundle {
  id: string;
  name: string;
  description?: string;
  category?: string;
  cityIds: string[];
  cityNames?: string[];
}

interface BundlesPanelProps {
  bundles: CityBundle[];
  selectedCities: Set<string>;
  onAddBundle: (bundleId: string, cityIds: string[]) => void;
  onToggleCity?: (cityId: string) => void;
  categoryLabels?: Record<string, string>;
  categoryOrder?: string[];
}

export function BundlesPanel({
  bundles,
  selectedCities,
  onAddBundle,
  onToggleCity,
  categoryLabels,
  categoryOrder,
}: BundlesPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleBundle = (id: string) => {
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Group bundles by category
  const hasCategories = bundles.some(b => b.category);
  const order = categoryOrder ?? [...new Set(bundles.map(b => b.category).filter(Boolean))] as string[];
  const labels = categoryLabels ?? {};

  const groupedBundles = order.reduce((acc, category) => {
    const categoryBundles = bundles.filter(b => b.category === category);
    if (categoryBundles.length > 0) {
      acc.push({ category, bundles: categoryBundles });
    }
    return acc;
  }, [] as { category: string; bundles: CityBundle[] }[]);

  // Count selected cities in a category
  const categorySelectedCount = (categoryBundles: CityBundle[]) => {
    let count = 0;
    for (const b of categoryBundles) {
      for (const id of b.cityIds) {
        if (selectedCities.has(id)) count++;
      }
    }
    return count;
  };

  // Count selected cities in a bundle
  const bundleSelectedCount = (bundle: CityBundle) => {
    return bundle.cityIds.filter(id => selectedCities.has(id)).length;
  };

  if (!hasCategories) {
    // Flat list fallback (Arizona-style with Add buttons)
    return (
      <div className="flex justify-center">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Bundle</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Cities</th>
              <th className="text-center px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((bundle) => {
              const isAdded = bundle.cityIds.every(id => selectedCities.has(id));
              const isOpen = expandedBundles.has(bundle.id);
              return (
                <>
                  <tr key={bundle.id} className={cn('border-b border-white/5', isAdded && 'bg-emerald-500/10')}>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => toggleBundle(bundle.id)}
                        className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-primary"
                      >
                        {isOpen
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        }
                        {bundle.name}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-center text-muted-foreground">{bundle.cityIds.length}</td>
                    <td className="px-4 py-2 text-center">
                      <Button
                        variant={isAdded ? 'outline' : 'default'}
                        size="sm"
                        disabled={isAdded}
                        onClick={() => onAddBundle(bundle.id, bundle.cityIds)}
                        className={cn(isAdded && 'border-emerald-500/30 text-emerald-400')}
                      >
                        {isAdded ? <><Check className="w-4 h-4 mr-1" /> Added</> : 'Add'}
                      </Button>
                    </td>
                  </tr>
                  {isOpen && bundle.cityNames && (
                    <tr key={`${bundle.id}-cities`} className="border-b border-white/5">
                      <td colSpan={3} className="px-4 pb-2 pt-0">
                        <p className="text-xs text-muted-foreground pl-5">
                          {bundle.cityNames.join(', ')}
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        {bundles.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">No bundles available</div>
        )}
      </div>
    );
  }

  // Hierarchical: Category → Bundle → Individual cities
  return (
    <div className="space-y-1">
      {groupedBundles.map(({ category, bundles: categoryBundles }) => {
        const catOpen = expandedCategories.has(category);
        const catSelected = categorySelectedCount(categoryBundles);
        const catTotal = categoryBundles.reduce((s, b) => s + b.cityIds.length, 0);
        const isSingleBundle = categoryBundles.length === 1;
        // For single-bundle categories, use the bundle name as header and show cities directly
        const displayLabel = isSingleBundle ? categoryBundles[0].name : (labels[category] || category);

        return (
          <div key={category} className="border border-white/10 rounded-lg overflow-hidden">
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                {catOpen
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                }
                <span className="font-semibold text-sm">{displayLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                {catSelected > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                    {catSelected} selected
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{catTotal} cities</span>
              </div>
            </button>

            {catOpen && isSingleBundle && (
              /* Single bundle: show cities directly under the category header */
              <div className="border-t border-white/10 px-4 pl-10 pb-3 pt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {categoryBundles[0].cityIds.map((cityId, i) => {
                  const cityName = categoryBundles[0].cityNames?.[i] || cityId;
                  const isSelected = selectedCities.has(cityId);
                  return (
                    <label
                      key={cityId}
                      className="flex items-center gap-2 cursor-pointer text-sm hover:text-primary transition-colors"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {
                          if (onToggleCity) {
                            onToggleCity(cityId);
                          } else {
                            onAddBundle(categoryBundles[0].id, [cityId]);
                          }
                        }}
                      />
                      <span className={cn(isSelected && 'text-emerald-400 font-medium')}>
                        {cityName}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Sub-bundles (multi-bundle categories) */}
            {catOpen && !isSingleBundle && (
              <div className="border-t border-white/10">
                {categoryBundles.map((bundle) => {
                  const bundleOpen = expandedBundles.has(bundle.id);
                  const bSelected = bundleSelectedCount(bundle);

                  return (
                    <div key={bundle.id} className="border-b border-white/5 last:border-b-0">
                      {/* Bundle header */}
                      <button
                        type="button"
                        onClick={() => toggleBundle(bundle.id)}
                        className="w-full flex items-center justify-between px-4 py-2 pl-8 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {bundleOpen
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          }
                          <span className="text-sm font-medium">{bundle.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {bSelected > 0 && (
                            <span className="text-xs text-emerald-400 font-medium">{bSelected}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{bundle.cityIds.length}</span>
                        </div>
                      </button>

                      {/* Individual city checkboxes */}
                      {bundleOpen && bundle.cityNames && (
                        <div className="px-4 pl-14 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                          {bundle.cityIds.map((cityId, i) => {
                            const cityName = bundle.cityNames![i] || cityId;
                            const isSelected = selectedCities.has(cityId);
                            return (
                              <label
                                key={cityId}
                                className="flex items-center gap-2 cursor-pointer text-sm hover:text-primary transition-colors"
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => {
                                    if (onToggleCity) {
                                      onToggleCity(cityId);
                                    } else {
                                      onAddBundle(bundle.id, [cityId]);
                                    }
                                  }}
                                />
                                <span className={cn(isSelected && 'text-emerald-400 font-medium')}>
                                  {cityName}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {bundles.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">No bundles available</div>
      )}
    </div>
  );
}
