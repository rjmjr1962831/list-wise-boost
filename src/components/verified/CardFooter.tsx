import { Clock, Database, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DataSourceLog } from '@/types/verifiedAgent';
import { formatVerificationDate, getDataSource } from '@/config/dataSources';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface CardFooterProps {
  cardCreatedAt: string;
  cardUpdatedAt: string;
  dataSources: DataSourceLog[];
  className?: string;
}

export function CardFooter({ 
  cardCreatedAt, 
  cardUpdatedAt, 
  dataSources,
  className 
}: CardFooterProps) {
  return (
    <div className={`border-t border-border/50 pt-4 mt-6 space-y-3 ${className}`}>
      {/* Last Updated */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Card last updated: {formatVerificationDate(cardUpdatedAt)}</span>
      </div>

      {/* Data Sources */}
      {dataSources && dataSources.length > 0 && (
        <div className="flex items-start gap-2">
          <Database className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex flex-wrap gap-1.5">
            {dataSources.map((source) => {
              const sourceInfo = getDataSource(source.sourceId);
              return (
                <HoverCard key={source.sourceId}>
                  <HoverCardTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="text-xs cursor-help hover:bg-muted"
                    >
                      {source.sourceName}
                    </Badge>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-64">
                    <div className="space-y-1">
                      <p className="font-medium">{source.sourceName}</p>
                      <p className="text-xs text-muted-foreground">
                        Last fetched: {formatVerificationDate(source.lastFetchedAt)}
                      </p>
                      {source.fieldsUpdated.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Fields: {source.fieldsUpdated.join(', ')}
                        </p>
                      )}
                      {sourceInfo && (
                        <p className="text-xs capitalize text-muted-foreground">
                          Type: {sourceInfo.type}
                        </p>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Transparency Statement */}
      <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <p>
          All data on this card is independently verified from authoritative sources. 
          Review counts, ratings, and credentials are checked against original platforms 
          and licensing boards. Card created {formatVerificationDate(cardCreatedAt)}.
        </p>
      </div>

      {/* Source Attribution */}
      <div className="text-center text-xs text-muted-foreground">
        Source: <a href="https://www.top10lists.us" className="text-primary hover:underline">Top10Lists.us</a>
      </div>
    </div>
  );
}
