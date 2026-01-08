import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TierBadge } from './TierBadge';
import type { SelectedNeighborhood } from '@/types/neighborhoodPricing';

interface CoverageSummaryCardProps {
  selectedCities: Set<string>;
  cityNames: Map<string, string>;
  selectedNeighborhoods: SelectedNeighborhood[];
  subtotalMonthly: number;
  onContinue: () => void;
  isLoading?: boolean;
}

export function CoverageSummaryCard({
  selectedCities,
  cityNames,
  selectedNeighborhoods,
  subtotalMonthly,
  onContinue,
  isLoading = false,
}: CoverageSummaryCardProps) {
  const [showAllCities, setShowAllCities] = useState(false);

  const cityList = Array.from(selectedCities).map(
    (id) => cityNames.get(id) || id
  );
  const hasSelections =
    selectedCities.size > 0 || selectedNeighborhoods.length > 0;

  const displayedCities = showAllCities ? cityList : cityList.slice(0, 3);
  const remainingCount = cityList.length - 3;

  return (
    <div className="sticky top-6 rounded-lg border bg-card shadow-sm">
      {/* Cities Section */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-semibold text-sm">Cities</h4>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            Free
          </span>
        </div>

        {cityList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cities selected</p>
        ) : (
          <div className="space-y-1">
            {displayedCities.map((name) => (
              <p key={name} className="text-sm">
                {name}
              </p>
            ))}
            {remainingCount > 0 && !showAllCities && (
              <button
                onClick={() => setShowAllCities(true)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                +{remainingCount} more
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
            {showAllCities && remainingCount > 0 && (
              <button
                onClick={() => setShowAllCities(false)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Show less
                <ChevronUp className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Neighborhoods Section */}
      <div className="p-4 border-b">
        <h4 className="font-semibold text-sm mb-3">Neighborhoods</h4>

        {selectedNeighborhoods.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No neighborhoods selected
          </p>
        ) : (
          <div className="space-y-2">
            {selectedNeighborhoods.map((n) => (
              <div key={n.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{n.neighborhood}</span>
                  <TierBadge tier={n.tier_at_selection} size="sm" />
                </div>
                <span className="text-sm">${n.price_monthly}/mo</span>
              </div>
            ))}
          </div>
        )}

        {selectedNeighborhoods.length > 0 && (
          <>
            <div className="border-t my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Monthly total</span>
              <span className="text-base font-semibold">${subtotalMonthly}</span>
            </div>
          </>
        )}
      </div>

      {/* CTA Section */}
      <div className="p-4">
        <Button
          className="w-full"
          disabled={!hasSelections || isLoading}
          onClick={onContinue}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            'Review & Continue'
          )}
        </Button>
      </div>
    </div>
  );
}
