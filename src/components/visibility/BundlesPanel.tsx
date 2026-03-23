import { useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  categoryLabels?: Record<string, string>;
  categoryOrder?: string[];
}

export function BundlesPanel({
  bundles,
  selectedCities,
  onAddBundle,
  categoryLabels,
  categoryOrder,
}: BundlesPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isBundleAdded = (bundle: CityBundle) => {
    return bundle.cityIds.every((id) => selectedCities.has(id));
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

  const renderBundleRows = (bundle: CityBundle) => {
    const isAdded = isBundleAdded(bundle);
    const isOpen = expanded.has(bundle.id);
    const hasCities = bundle.cityNames && bundle.cityNames.length > 0;

    return (
      <>
        <tr key={bundle.id} className={cn('border-b border-white/5', isAdded && 'bg-emerald-500/10')}>
          <td className="px-4 py-2">
            <button
              type="button"
              onClick={() => hasCities && toggleExpand(bundle.id)}
              className={cn('flex items-center gap-1.5 font-medium', hasCities && 'cursor-pointer hover:text-primary')}
            >
              {hasCities && (
                isOpen
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
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
        {isOpen && hasCities && (
          <tr key={`${bundle.id}-cities`} className="border-b border-white/5">
            <td colSpan={3} className="px-4 pb-2 pt-0">
              <p className="text-xs text-muted-foreground pl-5">
                {bundle.cityNames!.join(', ')}
              </p>
            </td>
          </tr>
        )}
      </>
    );
  };

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
          {hasCategories && groupedBundles.map(({ category, bundles: categoryBundles }) => (
            <>
              <tr key={`cat-${category}`}>
                <td colSpan={3} className="px-4 pt-4 pb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {labels[category] || category}
                </td>
              </tr>
              {categoryBundles.map((bundle) => renderBundleRows(bundle))}
            </>
          ))}
          {!hasCategories && bundles.map((bundle) => renderBundleRows(bundle))}
        </tbody>
      </table>

      {bundles.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">
          No bundles available
        </div>
      )}
    </div>
  );
}
