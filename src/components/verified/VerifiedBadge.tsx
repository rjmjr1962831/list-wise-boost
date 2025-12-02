import { CheckCircle, ExternalLink } from 'lucide-react';
import { formatVerificationDate } from '@/config/dataSources';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  verifiedAt: string;
  sourceName: string;
  sourceUrl?: string;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

export function VerifiedBadge({ 
  verifiedAt, 
  sourceName, 
  sourceUrl, 
  variant = 'default',
  className 
}: VerifiedBadgeProps) {
  const formattedDate = formatVerificationDate(verifiedAt);
  
  const content = (
    <>
      <CheckCircle className={cn(
        "text-cactus-green flex-shrink-0",
        variant === 'compact' ? "h-3 w-3" : "h-4 w-4"
      )} />
      <span className={cn(
        "text-muted-foreground",
        variant === 'compact' ? "text-xs" : "text-sm"
      )}>
        {variant === 'inline' ? (
          <>Verified {formattedDate}</>
        ) : (
          <>Verified {formattedDate} via {sourceName}</>
        )}
      </span>
      {sourceUrl && variant !== 'compact' && (
        <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
      )}
    </>
  );

  if (sourceUrl) {
    return (
      <a 
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 hover:text-primary transition-colors",
          className
        )}
        title={`View verification at ${sourceName}`}
      >
        {content}
      </a>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {content}
    </span>
  );
}
