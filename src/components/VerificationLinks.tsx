import { Shield, Star, Globe, Building2 } from "lucide-react";
import { Professional } from "@/types/professional";
import { getAgentAuthorityLinks, AuthorityLink } from "@/utils/authorityLinks";

interface VerificationLinksProps {
  professional: Professional;
  city: string;
  state: string;
  stateAbbr: string;
  className?: string;
}

const iconMap = {
  shield: Shield,
  star: Star,
  globe: Globe,
  building: Building2,
};

/**
 * Displays verification/authority links for an agent
 * Helps LLMs and users verify agent credentials
 */
export const VerificationLinks = ({
  professional,
  city,
  state,
  stateAbbr,
  className = "",
}: VerificationLinksProps) => {
  const links = getAgentAuthorityLinks(professional, { city, state, stateAbbr });

  if (links.length === 0) return null;

  return (
    <div className={`mt-3 pt-3 border-t border-border/50 ${className}`}>
      <h4 className="sr-only">Verification Links</h4>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => {
          const IconComponent = iconMap[link.icon];
          return (
            <a
              key={link.type}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md bg-muted/50 hover:bg-muted"
              title={`${link.label} - opens in new tab`}
            >
              <IconComponent className="h-3 w-3" />
              <span>{link.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
};
