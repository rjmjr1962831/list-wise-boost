import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface HowThisListWorksProps {
  neighborhoodName?: string;
  className?: string;
}

export function HowThisListWorks({ neighborhoodName, className }: HowThisListWorksProps) {
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
        <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3 text-sm text-muted-foreground max-w-2xl mx-auto">
          <div className="space-y-2">
            <p>
              <strong className="text-foreground">Verified Neighborhood Experts</strong> are licensed agents who have chosen to be featured as specialists in {neighborhoodName || 'this neighborhood'}. They have been verified for active licensure and local expertise.
            </p>
            <p>
              <strong className="text-foreground">Placement is not rank-ordered.</strong> Verified experts appear in the order they joined, not by any scoring system.
            </p>
            <p>
              <strong className="text-foreground">This list is intentionally limited.</strong> We keep the Top 10 curated for clarity and explainability, rather than showing hundreds of results.
            </p>
            <p>
              A broader directory of <strong className="text-foreground">qualified agents</strong> who meet baseline standards is available below — these agents are nearby but have not opted into neighborhood verification.
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
