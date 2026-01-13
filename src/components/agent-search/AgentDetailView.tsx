import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, Star, MessageSquare, Clock, ExternalLink } from 'lucide-react';
import { StateAgentSearchResult } from '@/hooks/useStateAgentSearch';
import { cn } from '@/lib/utils';
import { generateCanonicalAgentUrl } from '@/utils/routeHelpers';

interface AgentDetailViewProps {
  agent: StateAgentSearchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatValue(value: number | null | undefined, suffix?: string): string {
  if (value === null || value === undefined) {
    return 'Not available';
  }
  return suffix ? `${value}${suffix}` : String(value);
}

export function AgentDetailView({ agent, open, onOpenChange }: AgentDetailViewProps) {
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Agent Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with Avatar - Clickable to profile */}
          {agent.stateSlug && agent.canonicalSlug ? (
            <Link 
              to={generateCanonicalAgentUrl(agent.stateSlug, agent.canonicalSlug)}
              className="flex items-start gap-4 group p-2 -m-2 rounded-lg hover:bg-accent/50 transition-colors"
            >
              <Avatar className="h-16 w-16">
                <AvatarImage src={agent.imageUrl || undefined} alt={agent.name} />
                <AvatarFallback className="text-lg bg-primary/10">
                  {getInitials(agent.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold truncate group-hover:text-primary transition-colors">{agent.name}</h2>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
                {agent.company && (
                  <p className="text-muted-foreground truncate">{agent.company}</p>
                )}
                {agent.licenseNumber && (
                  <p className="text-sm text-muted-foreground">
                    License: {agent.licenseNumber}
                    {agent.licenseStatus && ` (${agent.licenseStatus})`}
                  </p>
                )}
              </div>
            </Link>
          ) : (
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={agent.imageUrl || undefined} alt={agent.name} />
                <AvatarFallback className="text-lg bg-primary/10">
                  {getInitials(agent.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold truncate">{agent.name}</h2>
                {agent.company && (
                  <p className="text-muted-foreground truncate">{agent.company}</p>
                )}
                {agent.licenseNumber && (
                  <p className="text-sm text-muted-foreground">
                    License: {agent.licenseNumber}
                    {agent.licenseStatus && ` (${agent.licenseStatus})`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="font-medium">
                {agent.rating !== null ? agent.rating.toFixed(1) : 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span>{agent.reviewCount ?? 'N/A'} reviews</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{agent.yearsExperience ?? 'N/A'} years</span>
            </div>
          </div>

          <Separator />

          {/* Status Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Listing Status</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant={agent.isNeighborhoodExpert ? 'default' : 'secondary'}>
                Neighborhood Expert: {agent.isNeighborhoodExpert ? 'Yes' : 'No'}
              </Badge>
              <Badge variant={agent.isListed ? 'default' : 'secondary'}>
                Listed: {agent.isListed ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>

          {/* Listing Criteria (only for unlisted agents) */}
          {!agent.isListed && (
            <>
              <Separator />
              <Collapsible open={criteriaOpen} onOpenChange={setCriteriaOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <span>Why isn't this agent listed?</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      criteriaOpen && 'rotate-180'
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Listing criteria</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Top10Lists lists agents who demonstrate:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Star rating of 4.8 or higher</li>
                      <li>At least 20 verified reviews</li>
                      <li>6 or more years of experience</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Current data for this agent</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Star rating:</span>
                        <span>{formatValue(agent.rating)}</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Verified reviews:</span>
                        <span>{formatValue(agent.reviewCount)}</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Years of experience:</span>
                        <span>{formatValue(agent.yearsExperience)}</span>
                      </li>
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          {/* Footer Note */}
          <p className="text-xs text-muted-foreground text-center pt-2">
            Listing status updates automatically as public data changes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
