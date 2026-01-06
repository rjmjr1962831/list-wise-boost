import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, X, MapPin, User, Phone, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureItem {
  label: string;
  free: boolean;
  expanded: boolean;
}

const features: FeatureItem[] = [
  // Free features
  { label: 'Editorial profile in one primary city', free: true, expanded: true },
  { label: 'Verified license display', free: true, expanded: true },
  { label: 'AI indexing eligibility', free: true, expanded: true },
  { label: 'Public profile page', free: true, expanded: true },
  // Expanded visibility features
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
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Free Listing vs Expanded Visibility</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Free Tier */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Free Listing</CardTitle>
                <p className="text-xs text-muted-foreground">Always included</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {features.map((feature) => (
              <div 
                key={feature.label}
                className={cn(
                  'flex items-center gap-2 text-sm',
                  !feature.free && 'text-muted-foreground/50'
                )}
              >
                {feature.free ? (
                  <Check className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/30" />
                )}
                <span>{feature.label}</span>
              </div>
            ))}
            
            <div className="pt-3 border-t mt-3 space-y-3">
              <div>
                <p className="text-2xl font-bold">$0</p>
                <p className="text-xs text-muted-foreground">Always included</p>
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
                      <Button 
                        className="w-full"
                        onClick={handleDone}
                      >
                        Confirm
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

        {/* Expanded Visibility */}
        <Card className="border-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary to-accent" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Expanded Visibility</CardTitle>
                  <p className="text-xs text-muted-foreground">Optional</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-2">
              Optional tools to extend your presence across additional cities and comparison views.
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
            
            <div className="pt-3 border-t mt-3">
              <p className="text-sm text-muted-foreground">Starting at</p>
              <p className="text-2xl font-bold">$29<span className="text-sm font-normal text-muted-foreground">/mo per city</span></p>
            </div>
            
            {/* Down arrow indicator */}
            <div className="flex justify-center mt-6">
              <ChevronDown className="h-6 w-6 text-muted-foreground animate-bounce" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}