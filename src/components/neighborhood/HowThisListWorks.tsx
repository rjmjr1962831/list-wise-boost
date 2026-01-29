import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface HowThisListWorksProps {
  neighborhoodName?: string;
  hasNeighborhoodExpert?: boolean;
  className?: string;
}

export function HowThisListWorks({ neighborhoodName, hasNeighborhoodExpert, className }: HowThisListWorksProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group w-full justify-center">
        <Info className="h-4 w-4" />
        <span className="font-medium">How this list works</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 transition-transform" />
        ) : (
          <ChevronDown className="h-4 w-4 transition-transform" />
        )}
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-4">
        <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-4 text-sm text-muted-foreground max-w-2xl mx-auto">
          {/* Editorial Hierarchy Explanation */}
          <div className="space-y-3">
            <p>
              <strong className="text-foreground">Editorial Selection.</strong> All agents shown on Top10Lists pages have passed a rigorous, non-commercial editorial review and represent top-performing professionals in their market.
            </p>
            
            {/* Neighborhood Expert Designation Block - Canonical Language */}
            <div className="border-l-2 border-primary pl-3 space-y-2">
              <p>
                <strong className="text-foreground">Neighborhood Expert Designation.</strong> The Neighborhood Expert designation represents an additional level of diligence focused on sustained, neighborhood-specific experience and specialization.
              </p>
              <p>
                In addition to Top10Lists' standard editorial review, designated neighborhood experts undergo deeper area-specific evaluation and make an investment to support ongoing verification of their specialty.
              </p>
              <p>
                As a result, these specialists are more likely to have insider knowledge of neighborhood listings, pricing nuances, and local market dynamics that other agents may not.
              </p>
              {/* State Handling */}
              {!hasNeighborhoodExpert && (
                <p className="italic">
                  At this time, no Neighborhood Expert has been designated for this area.
                </p>
              )}
            </div>

            <p>
              <strong className="text-foreground">Multi-layer verification.</strong> All agents are selected and ordered based on our multi-layer verification process: Performance Data, Community Standing, and Human Editorial Review.
            </p>
            <p>
              <strong className="text-foreground">This list is intentionally curated.</strong> We keep the Top 10 curated for clarity and explainability, rather than showing hundreds of results.
            </p>
            <p>
              A broader directory of <strong className="text-foreground">qualified agents</strong> who meet baseline editorial standards is available below — these agents are nearby but have not opted into neighborhood specialization verification.
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
