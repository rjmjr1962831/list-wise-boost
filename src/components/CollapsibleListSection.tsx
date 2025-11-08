import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ProfessionalCard } from "./ProfessionalCard";
import { ListSection } from "@/types/professional";

interface CollapsibleListSectionProps {
  section: ListSection;
  defaultOpen?: boolean;
  schemaType?: string;
}

export const CollapsibleListSection = ({ 
  section, 
  defaultOpen = false,
  schemaType = "Person"
}: CollapsibleListSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getGradientClass = (color: string) => {
    const gradients: Record<string, string> = {
      primary: "from-primary to-turquoise",
      "sunset-orange": "from-sunset-orange to-terracotta",
      terracotta: "from-terracotta to-desert-sand",
      turquoise: "from-turquoise to-primary",
      "cactus-green": "from-cactus-green to-turquoise"
    };
    return gradients[color] || gradients.primary;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between mb-6 relative">
        {/* Decorative accent */}
        <div className={`absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-16 bg-gradient-to-b ${getGradientClass(section.accentColor)} rounded-full`} />
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            {section.title}
            <Badge variant="secondary" className="text-sm">Top {section.items.length}</Badge>
          </h2>
          <p className="text-muted-foreground">{section.description}</p>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-9 p-0">
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            <span className="sr-only">Toggle {section.title}</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      
      <CollapsibleContent className="space-y-6">
        {section.items.map((professional) => (
          <ProfessionalCard 
            key={professional.rank} 
            professional={professional}
            accentColor={section.accentColor}
            schemaType={schemaType}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
