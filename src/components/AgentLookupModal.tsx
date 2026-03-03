import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Shield, MapPin, Briefcase, Clock, Phone, Mail, Globe, ExternalLink } from 'lucide-react';
import { AgentSearchResult } from '@/hooks/useAgentNameSearch';
import { Link } from 'react-router-dom';
import { floorReviews } from '@/utils/floorDisplay';

interface AgentLookupModalProps {
  agent: AgentSearchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentLookupModal({ agent, open, onOpenChange }: AgentLookupModalProps) {
  if (!agent) return null;

  const hasProfilePage = agent.canonical_slug && agent.state_slug;
  const initials = agent.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">Agent Details</DialogTitle>
          <DialogDescription className="sr-only">
            Information about {agent.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with photo and basic info */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={agent.image_url || undefined} alt={agent.name} />
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-foreground truncate">{agent.name}</h3>
              {agent.company && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {agent.company}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {agent.license_verified_at && (
                  <Badge variant="secondary" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    License Verified
                  </Badge>
                )}
                {agent.review_stars_rating && agent.review_stars_rating >= 4.5 && (
                  <Badge variant="outline" className="text-xs">
                    <Star className="h-3 w-3 mr-1 fill-amber-400 text-amber-400" />
                    {agent.review_stars_rating.toFixed(1)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            {agent.license_number && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">License #</p>
                <p className="font-medium text-foreground mt-1">{agent.license_number}</p>
                {agent.license_status && (
                  <Badge variant={agent.license_status.toLowerCase() === 'active' ? 'default' : 'secondary'} className="mt-1 text-xs">
                    {agent.license_status}
                  </Badge>
                )}
              </div>
            )}

            {agent.years_experience && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Experience
                </p>
                <p className="font-medium text-foreground mt-1">{agent.years_experience} years</p>
              </div>
            )}

            {agent.num_total_reviews && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  Reviews
                </p>
                <p className="font-medium text-foreground mt-1">{floorReviews(agent.num_total_reviews) ?? agent.num_total_reviews} reviews</p>
              </div>
            )}

            {agent.served_cities && agent.served_cities.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Service Areas
                </p>
                <p className="font-medium text-foreground mt-1 text-sm">
                  {agent.served_cities.slice(0, 3).join(', ')}
                  {agent.served_cities.length > 3 && ` +${agent.served_cities.length - 3} more`}
                </p>
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            {agent.phone && (
              <a 
                href={`tel:${agent.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4" />
                {agent.phone}
              </a>
            )}
            {agent.email && (
              <a 
                href={`mailto:${agent.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                {agent.email}
              </a>
            )}
            {agent.website && (
              <a 
                href={agent.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Globe className="h-4 w-4" />
                Visit Website
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {hasProfilePage ? (
              <Button asChild className="flex-1">
                <Link to={`/${agent.state_slug}/agents/${agent.canonical_slug}`}>
                  View Full Profile
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" disabled>
                Profile Coming Soon
              </Button>
            )}
            <Button variant="secondary" className="flex-1">
              Request Review
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
