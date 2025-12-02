import { Newspaper, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from './VerifiedBadge';
import { PressMention } from '@/types/verifiedAgent';
import { formatVerificationDate } from '@/config/dataSources';

interface PressMentionsCardProps {
  mentions: PressMention[];
}

const outletTypeBadges: Record<string, { label: string; className: string }> = {
  newspaper: { label: 'News', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  magazine: { label: 'Magazine', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  tv: { label: 'TV', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  online: { label: 'Online', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  trade: { label: 'Trade', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

function MentionItem({ mention }: { mention: PressMention }) {
  const badgeInfo = outletTypeBadges[mention.outletType] || outletTypeBadges.online;

  return (
    <div className="py-3 border-b border-border/30 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-sm">{mention.outlet}</span>
            <Badge variant="secondary" className={badgeInfo.className}>
              {badgeInfo.label}
            </Badge>
          </div>
          
          <a 
            href={mention.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline line-clamp-2 flex items-center gap-1"
          >
            {mention.title}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
          
          {mention.excerpt && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
              "{mention.excerpt}"
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span>Published: {formatVerificationDate(mention.publishedAt)}</span>
        {mention.author && <span>By {mention.author}</span>}
        <VerifiedBadge 
          verifiedAt={mention.verifiedAt}
          sourceName={mention.outlet}
          variant="compact"
        />
      </div>
    </div>
  );
}

export function PressMentionsCard({ mentions }: PressMentionsCardProps) {
  if (!mentions || mentions.length === 0) return null;

  return (
    <Card className="bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-800/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="h-5 w-5 text-primary" />
          Press & Media Coverage
          <Badge variant="secondary" className="ml-auto">
            {mentions.length} mention{mentions.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {mentions.map((mention, index) => (
            <MentionItem key={`${mention.url}-${index}`} mention={mention} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
