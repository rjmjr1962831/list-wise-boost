import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TierBadge } from './TierBadge';
import { cn } from '@/lib/utils';
import type { SelectedNeighborhood } from '@/types/neighborhoodPricing';

interface CoverageSummaryFooterProps {
  selectedCities: Set<string>;
  cityNames: Map<string, string>;
  selectedNeighborhoods: SelectedNeighborhood[];
  subtotalMonthly: number;
  onContinue: () => void;
  isLoading?: boolean;
}

export function CoverageSummaryFooter({
  selectedCities,
  cityNames,
  selectedNeighborhoods,
  subtotalMonthly,
  onContinue,
  isLoading = false,
}: CoverageSummaryFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const cityCount = selectedCities.size;
  const neighborhoodCount = selectedNeighborhoods.length;
  const hasSelections = cityCount > 0 || neighborhoodCount > 0;

  const cityList = Array.from(selectedCities).map(
    (id) => cityNames.get(id) || id
  );

  return (
    <>
      {/* Overlay when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Footer */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 transition-all duration-300',
          isExpanded && 'rounded-t-xl'
        )}
      >
        {/* Expanded drawer content */}
        {isExpanded && (
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Your Coverage</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cities */}
            <div className="p-4 border-b">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-medium">Cities</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  Free
                </span>
              </div>
              {cityList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No cities selected
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {cityList.map((name) => (
                    <span
                      key={name}
                      className="text-xs bg-muted px-2 py-1 rounded"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Neighborhoods */}
            <div className="p-4">
              <h4 className="text-sm font-medium mb-2">Neighborhoods</h4>
              {selectedNeighborhoods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No neighborhoods selected
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedNeighborhoods.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{n.neighborhood}</span>
                        <TierBadge tier={n.tier_at_selection} size="sm" />
                      </div>
                      <span className="text-sm">${n.price_monthly}/mo</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Monthly total</span>
                    <span className="font-semibold">${subtotalMonthly}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed bar */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer"
          onClick={(e) => {
            // Don't expand if clicking the button
            if ((e.target as HTMLElement).closest('button')) return;
            setIsExpanded(!isExpanded);
          }}
        >
          <div className="text-sm">
            <span className="font-medium">{cityCount} cities</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-medium">{neighborhoodCount} neighborhoods</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-semibold">
              {subtotalMonthly === 0 ? 'Free' : `$${subtotalMonthly}/mo`}
            </span>
            <Button
              size="sm"
              disabled={!hasSelections || isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onContinue();
              }}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Review'
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
