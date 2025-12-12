import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, X, Sparkles, User, Phone, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureItem {
  label: string;
  premiumLabel?: string;
  free: boolean;
  premium: boolean;
}

const features: FeatureItem[] = [
  // Enabled items first
  { label: 'Basic profile listing', premiumLabel: 'Enhanced profile listing', free: true, premium: true },
  { label: 'Verified license display', free: true, premium: true },
  { label: 'AI search optimization', free: true, premium: true },
  
  { label: 'Video introduction', free: true, premium: true },
  // Premium-only items
  { label: 'Guaranteed Top 10 placement', free: false, premium: true },
  { label: 'Priority position in rankings', free: false, premium: true },
  { label: 'Multi-city coverage', free: false, premium: true },
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
      <h3 className="text-lg font-semibold text-foreground">Free vs Premium Placement</h3>
      
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
                <p className="text-xs text-muted-foreground">Basic visibility</p>
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
                <p className="text-xs text-muted-foreground">Forever free</p>
              </div>
              {onSelectFree && (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full"
                    >
                      I'm ok, I'll stick with the Free offer
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4 bg-background" align="center">
                    <div className="space-y-3">
                      <Button 
                        className="w-full"
                        onClick={handleDone}
                      >
                        I'm Done
                      </Button>
                      
                      <Collapsible open={showContact} onOpenChange={setShowContact}>
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full justify-between"
                          >
                            Let's Talk
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

        {/* Premium Tier */}
        <Card className="border-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary to-accent" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Premium Placement</CardTitle>
                  <p className="text-xs text-muted-foreground">Maximum visibility</p>
                </div>
              </div>
              <Badge className="bg-primary/10 text-primary border-0">Popular</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {features.map((feature) => (
              <div 
                key={feature.label}
                className="flex items-center gap-2 text-sm"
              >
                <Check className={cn(
                  'h-4 w-4',
                  feature.premium && !feature.free ? 'text-primary' : 'text-muted-foreground'
                )} />
                <span className={cn(
                  feature.premium && !feature.free && 'font-medium'
                )}>
                  {feature.premiumLabel || feature.label}
                </span>
              </div>
            ))}
            
            {/* Early adopter benefits */}
            <div className="flex items-center gap-2 text-sm text-accent">
              <Check className="h-4 w-4 text-accent" />
              <span className="font-medium">50% Early Adopter Discount</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-accent">
              <Check className="h-4 w-4 text-accent" />
              <span className="font-medium">No price changes for 24 months</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
