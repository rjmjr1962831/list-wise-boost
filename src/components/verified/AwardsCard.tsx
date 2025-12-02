import { Award as AwardIcon, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from './VerifiedBadge';
import { Award } from '@/types/verifiedAgent';

interface AwardsCardProps {
  awards: Award[];
}

function AwardItem({ award }: { award: Award }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
        <AwardIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{award.name}</span>
          <Badge variant="outline" className="text-xs">
            {award.year}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
          <span>{award.issuingOrganization}</span>
          {award.issuingOrgUrl && (
            <a 
              href={award.issuingOrgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
              title={`Visit ${award.issuingOrganization}`}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        
        {award.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {award.description}
          </p>
        )}
        
        <div className="mt-2">
          <VerifiedBadge 
            verifiedAt={award.verifiedAt}
            sourceName={award.issuingOrganization}
            variant="compact"
          />
        </div>
      </div>
    </div>
  );
}

export function AwardsCard({ awards }: AwardsCardProps) {
  if (!awards || awards.length === 0) return null;

  return (
    <Card className="bg-amber-50/30 dark:bg-amber-950/10 border-amber-200/30 dark:border-amber-800/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AwardIcon className="h-5 w-5 text-amber-500" />
          Awards & Recognition
          <Badge variant="secondary" className="ml-auto">
            {awards.length} award{awards.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {awards.map((award, index) => (
            <AwardItem key={`${award.name}-${award.year}-${index}`} award={award} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
