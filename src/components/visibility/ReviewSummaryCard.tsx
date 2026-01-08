import { AlertCircle, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TierBadge } from './TierBadge';
import type { SelectedNeighborhood, QuoteCartResponse } from '@/types/neighborhoodPricing';

interface ReviewSummaryCardProps {
  selectedCities: Set<string>;
  cityNames: Map<string, string>;
  selectedNeighborhoods: SelectedNeighborhood[];
  serverQuote?: QuoteCartResponse;
  isLoadingQuote: boolean;
  quoteError?: string;
  onRetry?: () => void;
}

export function ReviewSummaryCard({
  selectedCities,
  cityNames,
  selectedNeighborhoods,
  serverQuote,
  isLoadingQuote,
  quoteError,
  onRetry,
}: ReviewSummaryCardProps) {
  const cityList = Array.from(selectedCities).map(
    (id) => cityNames.get(id) || id
  );

  // Calculate client-side subtotal
  const clientSubtotal = selectedNeighborhoods.reduce(
    (sum, n) => sum + n.price_monthly,
    0
  );

  // Check if server price differs
  const serverTotal = serverQuote?.total_monthly ?? clientSubtotal;
  const hasPriceDiscrepancy =
    serverQuote && Math.abs(serverQuote.total_monthly - clientSubtotal) > 0.01;

  const annualPrice = serverQuote?.total_annual ?? serverTotal * 10;

  return (
    <div className="rounded-lg border bg-card">
      {/* Cities Section */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-semibold">Cities</h4>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            Free
          </span>
        </div>

        {cityList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cities selected</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {cityList.map((name) => (
              <span
                key={name}
                className="text-sm bg-muted px-3 py-1 rounded-full"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Neighborhoods Section */}
      <div className="p-4 border-b">
        <h4 className="font-semibold mb-3">Neighborhoods</h4>

        {quoteError && (
          <div className="flex items-center gap-2 p-3 mb-3 rounded-md bg-destructive/10 text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{quoteError}</span>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="ml-auto"
              >
                Retry
              </Button>
            )}
          </div>
        )}

        {selectedNeighborhoods.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No neighborhoods selected
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Neighborhood</th>
                  <th className="pb-2 font-medium">City</th>
                  <th className="pb-2 font-medium">Tier</th>
                  <th className="pb-2 font-medium text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {(serverQuote?.items ?? selectedNeighborhoods).map((item) => {
                  const isServerItem = 'final_price_monthly' in item;
                  const neighborhood = isServerItem
                    ? item.neighborhood
                    : item.neighborhood;
                  const cityArea = isServerItem ? item.city_area : item.city_area;
                  const tier = isServerItem ? item.tier : item.tier_at_selection;
                  const price = isServerItem
                    ? item.final_price_monthly
                    : item.price_monthly;

                  return (
                    <tr key={isServerItem ? item.neighborhood_id : item.id} className="border-b">
                      <td className="py-2">{neighborhood}</td>
                      <td className="py-2 text-muted-foreground">{cityArea}</td>
                      <td className="py-2">
                        <TierBadge tier={tier} size="sm" />
                      </td>
                      <td className="py-2 text-right">
                        {isLoadingQuote ? (
                          <div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" />
                        ) : (
                          `$${price}/mo`
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 font-medium">
                    Monthly Total
                  </td>
                  <td className="pt-3 text-right font-semibold">
                    {isLoadingQuote ? (
                      <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                    ) : (
                      `$${serverTotal}`
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {hasPriceDiscrepancy && !isLoadingQuote && (
          <div className="flex items-center gap-2 mt-3 p-2 rounded bg-blue-50 text-blue-700 text-sm">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>Pricing updated to reflect current rates</span>
          </div>
        )}
      </div>

      {/* Annual Option Section */}
      {selectedNeighborhoods.length > 0 && (
        <div className="p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Annual subscription</p>
              <p className="text-sm text-muted-foreground">
                2 months free (pay for 10, get 12)
              </p>
            </div>
            <div className="text-right">
              {isLoadingQuote ? (
                <div className="h-6 w-20 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <p className="font-semibold text-lg">${annualPrice}/year</p>
                  <p className="text-sm text-green-600">
                    Save ${serverTotal * 2}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
