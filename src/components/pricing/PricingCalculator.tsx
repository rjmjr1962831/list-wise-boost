import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Sparkles, ArrowRight, Clock, CreditCard, Receipt } from 'lucide-react';
import { PricingCalculatorResult } from '@/hooks/usePricingCalculator';
import { cn } from '@/lib/utils';

interface PricingCalculatorProps {
  calculator: PricingCalculatorResult;
  onCheckout: () => void;
  isLoading?: boolean;
}

// Generate Stripe line items preview based on selection
function getStripeLineItems(calculator: PricingCalculatorResult) {
  const items: { name: string; price: number }[] = [];
  
  // If package selected, add as single line item
  if (calculator.selectedPackage) {
    items.push({
      name: `${calculator.selectedPackage.name} Package`,
      price: calculator.selectedPackage.earlyAdopterPrice,
    });
    
    // Get premium cities NOT in package
    const packageCityIds = calculator.selectedPackage.includedCityIds || [];
    calculator.state.selectedPremiumCityIds
      .filter(cityId => !packageCityIds.includes(cityId))
      .forEach(cityId => {
        const city = calculator.selectedCities.find(c => c.id === cityId);
        if (city) {
          items.push({
            name: `${city.cityName} (Premium Add-on)`,
            price: city.earlyAdopterPrice,
          });
        }
      });
  } else if (calculator.state.mode === 'build-your-own') {
    // À la carte cities
    calculator.state.selectedAlaCarte.forEach(cityId => {
      const city = calculator.selectedCities.find(c => c.id === cityId);
      if (city) {
        items.push({
          name: city.cityName,
          price: city.earlyAdopterPrice,
        });
      }
    });
  }
  
  return items;
}

export function PricingCalculator({ calculator, onCheckout, isLoading }: PricingCalculatorProps) {
  const { lineItems, monthlyTotal, retailTotal, totalSavings, cityCount, removeCity, suggestions } = calculator;
  
  const stripeLineItems = getStripeLineItems(calculator);

  return (
    <Card className="sticky top-4 border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-3 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">Your Selection</span>
          {cityCount > 0 && (
            <Badge className="bg-primary text-primary-foreground">
              {cityCount} {cityCount === 1 ? 'city' : 'cities'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {lineItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Select a package or cities to get started
          </p>
        ) : (
          <>
            {/* Line Items */}
            <div className="space-y-2">
              {lineItems.map((item, index) => (
                <div 
                  key={`${item.type}-${item.cityId || index}`}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="line-through">${item.retailPrice}</span>
                      {' → '}
                      <span className="text-primary font-medium">${item.price}/mo</span>
                    </p>
                  </div>
                  {item.cityId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeCity(item.cityId!)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Retail price</span>
                <span className="line-through text-muted-foreground">${retailTotal}/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Early Adopter discount</span>
                <span className="text-primary font-medium">-${totalSavings}/mo</span>
              </div>
              <Separator />
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">Monthly Total</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-primary">${monthlyTotal}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
              </div>
            </div>

            {/* Stripe Checkout Preview */}
            {stripeLineItems.length > 0 && (
              <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Stripe Checkout Preview
                  </span>
                </div>
                <div className="space-y-1">
                  {stripeLineItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-foreground">{item.name}</span>
                      <span className="font-medium">${item.price}/mo</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total on Stripe</span>
                  <span>${stripeLineItems.reduce((sum, item) => sum + item.price, 0)}/mo</span>
                </div>
              </div>
            )}

            {/* Commitment Notice */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Billed monthly</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">3-month minimum commitment</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pay ${monthlyTotal}/month for at least 3 months. Cancel anytime after.
              </p>
            </div>

            {/* Savings Badge */}
            {totalSavings > 0 && (
              <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  You're saving ${totalSavings}/mo with Early Adopter pricing!
                </span>
              </div>
            )}
          </>
        )}

        {/* Smart Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Suggested additions
            </p>
            {suggestions.map(suggestion => (
              <button
                key={suggestion.cityId}
                onClick={() => calculator.toggleAlaCarteCity(suggestion.cityId)}
                className="w-full flex items-center justify-between p-2 rounded-lg border border-dashed border-primary/30 hover:bg-primary/5 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium">{suggestion.cityName}</p>
                  <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-primary" />
              </button>
            ))}
          </div>
        )}

        {/* CTA Button */}
        <Button
          className="w-full gradient-button"
          size="lg"
          onClick={onCheckout}
          disabled={lineItems.length === 0 || isLoading}
        >
          {isLoading ? 'Processing...' : 'Secure My Premium Placement'}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Secure checkout powered by Stripe
        </p>
      </CardContent>
    </Card>
  );
}
