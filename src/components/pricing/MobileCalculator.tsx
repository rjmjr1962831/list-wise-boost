import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ShoppingCart, ChevronUp, X, CreditCard, Clock } from 'lucide-react';
import { PricingCalculatorResult } from '@/hooks/usePricingCalculator';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface MobileCalculatorProps {
  calculator: PricingCalculatorResult;
  onCheckout: () => void;
  isLoading?: boolean;
}

export function MobileCalculator({ calculator, onCheckout, isLoading }: MobileCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { lineItems, monthlyTotal, retailTotal, totalSavings, cityCount, removeCity } = calculator;

  if (cityCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button className="w-full bg-primary text-primary-foreground p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="h-5 w-5" />
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-accent text-accent-foreground text-xs">
                  {cityCount}
                </Badge>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{cityCount} {cityCount === 1 ? 'city' : 'cities'} selected</p>
                <p className="text-xs opacity-80">Tap to view details</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">${monthlyTotal}</span>
              <span className="text-sm opacity-80">/mo</span>
              <ChevronUp className="h-5 w-5" />
            </div>
          </button>
        </SheetTrigger>

        <SheetContent side="bottom" className="h-[80vh] rounded-t-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Your Selection</span>
              <Badge className="bg-primary text-primary-foreground">
                {cityCount} {cityCount === 1 ? 'city' : 'cities'}
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4 overflow-y-auto max-h-[calc(80vh-200px)] pb-20">
            {/* Line Items */}
            <div className="space-y-2">
              {lineItems.map((item, index) => (
                <div 
                  key={`${item.type}-${item.cityId || index}`}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.label}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="line-through">${item.retailPrice}</span>
                      {' → '}
                      <span className="text-primary font-medium">${item.price}/mo</span>
                    </p>
                  </div>
                  {item.cityId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeCity(item.cityId!)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retail price</span>
                <span className="line-through text-muted-foreground">${retailTotal}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Early Adopter discount</span>
                <span className="text-primary font-medium">-${totalSavings}/mo</span>
              </div>
              <Separator />
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">Monthly Total</span>
                <div className="text-right">
                  <span className="text-3xl font-bold text-primary">${monthlyTotal}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </div>
            </div>

            {/* Commitment Notice */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Billed monthly</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">3-month minimum commitment</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Pay ${monthlyTotal}/month for at least 3 months. Cancel anytime after.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
            <Button
              className="w-full gradient-button"
              size="lg"
              onClick={() => {
                setIsOpen(false);
                onCheckout();
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Secure My Premium Placement'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
