import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, X, MapPin, User, Phone, ChevronDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureItem {
  label: string;
  free: boolean;
  expanded: boolean;
}

const features: FeatureItem[] = [
  // Free features (Step 1: Editorial Qualification)
  { label: 'Editorial profile in one primary city', free: true, expanded: true },
  { label: 'Verified license display', free: true, expanded: true },
  { label: 'AI indexing eligibility', free: true, expanded: true },
  { label: 'Public profile page', free: true, expanded: true },
  // Expanded visibility features (Step 2: Optional)
  { label: 'Coverage in additional cities', free: false, expanded: true },
  { label: 'Enhanced profile distribution', free: false, expanded: true },
  { label: 'Multi-city discovery contexts', free: false, expanded: true },
  { label: 'Video introduction support', free: false, expanded: true },
  { label: 'Ongoing indexing optimization', free: false, expanded: true },
];

interface FreeVsPremiumProps {
  onSelectFree?: () => void;
}

export function FreeVsPremium({ onSelectFree }: FreeVsPremiumProps) {
  const [showContact, setShowContact] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleDone = () => {
    setPopoverOpen(false);
    if (onSelectFree) {
      onSelectFree();
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header with Step Explanation */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Two Steps, Two Separate Things</h3>
        <p className="text-sm text-muted-foreground">
          Editorial qualification is always free. Expanded visibility is optional and discounted for early adopters.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1: Free Editorial Qualification */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">Step 1</Badge>
              <span className="text-xs text-muted-foreground">Always Free</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Editorial Qualification</CardTitle>
                <p className="text-xs text-muted-foreground">Merit-based inclusion</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {features.filter(f => f.free).map((feature) => (
              <div 
                key={feature.label}
                className="flex items-center gap-2 text-sm"
              >
                <Check className="h-4 w-4 text-muted-foreground" />
                <span>{feature.label}</span>
              </div>
            ))}
            
            {/* Show what's NOT included */}
            {features.filter(f => !f.free).map((feature) => (
              <div 
                key={feature.label}
                className="flex items-center gap-2 text-sm text-muted-foreground/50"
              >
                <X className="h-4 w-4 text-muted-foreground/30" />
                <span>{feature.label}</span>
              </div>
            ))}
            
            <div className="pt-4 border-t mt-4 space-y-3">
              <div>
                <p className="text-2xl font-bold text-foreground">$0</p>
                <p className="text-xs text-muted-foreground">Always included for qualified agents</p>
              </div>
              {onSelectFree && (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full"
                    >
                      Continue with Free Listing
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4 bg-background" align="center">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground text-center">
                        Your editorial profile will remain active in your primary city at no cost.
                      </p>
                      <Button 
                        className="w-full"
                        onClick={handleDone}
                      >
                        Confirm Free Listing
                      </Button>
                      
                      <Collapsible open={showContact} onOpenChange={setShowContact}>
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full justify-between"
                          >
                            Have Questions?
                            <ChevronDown className={cn(
                              "h-4 w-4 transition-transform",
                              showContact && "rotate-180"
                            )} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="p-3 rounded-lg bg-muted text-center space-y-2">
                            <p className="text-sm text-muted-foreground">Call or text us at</p>
                            <a 
                              href="tel:6027599600" 
                              className="flex items-center justify-center gap-2 text-lg font-semibold text-primary hover:underline"
                            >
                              <Phone className="h-4 w-4" />
                              (602) 759-9600
                            </a>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Expanded Visibility (Optional, Discounted) */}
        <Card className="border-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary to-accent" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-accent text-accent-foreground text-xs">Step 2</Badge>
              <Badge variant="outline" className="text-xs border-accent/30 text-accent">Early Adopter Discount</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Expanded Visibility</CardTitle>
                <p className="text-xs text-muted-foreground">Optional distribution upgrade</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Extend where and how often your profile appears across additional Arizona markets.
            </p>
            {features.filter(f => f.expanded && !f.free).map((feature) => (
              <div 
                key={feature.label}
                className="flex items-center gap-2 text-sm"
              >
                <Check className="h-4 w-4 text-primary" />
                <span>{feature.label}</span>
              </div>
            ))}
            
            <div className="pt-4 border-t mt-4">
              {/* Anchored Pricing */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm text-muted-foreground line-through">$58</span>
                <Badge variant="secondary" className="text-xs bg-accent/10 text-accent">50% off</Badge>
              </div>
              <p className="text-2xl font-bold text-foreground">
                $29<span className="text-sm font-normal text-muted-foreground">/mo per city</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Rate locked while subscription active
              </p>
            </div>
            
            {/* Down arrow indicator */}
            <div className="flex justify-center mt-4 pt-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Select cities below</span>
                <ChevronDown className="h-5 w-5 text-muted-foreground animate-bounce" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Editorial Independence Notice */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          Expanded Visibility affects distribution scope only. It does not affect editorial inclusion, ranking methodology, or review outcomes.
        </p>
      </div>
    </div>
  );
}