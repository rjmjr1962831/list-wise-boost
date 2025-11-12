import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ProfessionalCard } from "./ProfessionalCard";
import { CollapsibleHeader } from "./CollapsibleHeader";
import { ListSection, Professional } from "@/types/professional";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";

interface CollapsibleListSectionProps {
  section: ListSection;
  defaultOpen?: boolean;
  schemaType?: string;
  market?: string;
  stateAbbr?: string;
  citySlug?: string;
  categorySlug?: string;
  onContactClick?: (professional: Professional) => void;
  quizCompleted?: boolean;
}

export const CollapsibleListSection = ({ 
  section, 
  defaultOpen = false,
  schemaType = "Person",
  market = "",
  stateAbbr,
  citySlug,
  categorySlug,
  onContactClick,
  quizCompleted = true
}: CollapsibleListSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { trackEvent } = useGA4Tracking();

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      trackEvent('agent_card_expand', {
        agent_name: section.title,
        market,
        agent_type: section.title
      });
    }
  };

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
    <Collapsible open={isOpen} onOpenChange={handleToggle} className="agent-card" data-agent-name={section.title} data-market={market} data-agent-type={section.title}>
      <CollapsibleHeader isOpen={isOpen} ariaLabel={`Toggle ${section.title}`}>
        {/* Decorative accent */}
        <div className={`absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-16 bg-gradient-to-b ${getGradientClass(section.accentColor)} rounded-full`} />
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            {section.title}
            <Badge variant="secondary" className="text-sm">Top {section.items.length}</Badge>
          </h2>
          <p className="text-muted-foreground">{section.description}</p>
        </div>
      </CollapsibleHeader>
      
      {/* Content always in DOM for SEO, visibility controlled by CSS */}
      <CollapsibleContent className="space-y-6">
        {section.items.map((professional) => (
          <ProfessionalCard 
            key={professional.rank} 
            professional={professional}
            accentColor={section.accentColor}
            schemaType={schemaType}
            market={market}
            stateAbbr={stateAbbr}
            agentType={section.title}
            citySlug={citySlug}
            categorySlug={categorySlug}
            onContactClick={() => onContactClick?.(professional)}
            quizCompleted={quizCompleted}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
