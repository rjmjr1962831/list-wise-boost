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

  const profileUrl = agent.stateSlug && agent.canonicalSlug 
    ? generateCanonicalAgentUrl(agent.stateSlug, agent.canonicalSlug)
    : null;

  const content = (
    <div className="space-y-6">
      {/* Header with Avatar */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={agent.imageUrl || undefined} alt={agent.name} />
          <AvatarFallback className="text-lg bg-primary/10">
            {getInitials(agent.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold truncate group-hover:text-primary transition-colors">{agent.name}</h2>
            {profileUrl && (
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            )}
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
      </div>

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

      {/* Footer Note */}
      <p className="text-xs text-muted-foreground text-center pt-2">
        {profileUrl ? 'Click anywhere to view full profile' : 'Listing status updates automatically as public data changes.'}
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Agent Details</DialogTitle>
        </DialogHeader>

        {profileUrl ? (
          <Link 
            to={profileUrl}
            className="block group rounded-lg hover:bg-accent/30 transition-colors -m-2 p-2 cursor-pointer"
          >
            {content}
          </Link>
        ) : (
          content
        )}
      </DialogContent>
    </Dialog>
  );
}
