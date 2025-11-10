import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { ReactNode } from "react";

interface CollapsibleHeaderProps {
  isOpen: boolean;
  children: ReactNode;
  ariaLabel?: string;
}

export const CollapsibleHeader = ({ 
  isOpen, 
  children, 
  ariaLabel = "Toggle section" 
}: CollapsibleHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-6 relative">
      {children}
      <CollapsibleTrigger asChild>
        <Button 
          variant="outline" 
          size="lg" 
          className="h-12 w-12 rounded-full border-2 border-primary hover:bg-primary hover:text-primary-foreground"
        >
          <ChevronDown className={`h-7 w-7 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          <span className="sr-only">{ariaLabel}</span>
        </Button>
      </CollapsibleTrigger>
    </div>
  );
};
