import { Calendar, RefreshCw } from "lucide-react";
import { formatLastUpdated } from "@/utils/structuredData";

interface LastUpdatedBannerProps {
  lastUpdated: string;
  className?: string;
}

/**
 * Freshness indicator showing when rankings were last updated
 * Includes hidden machine-readable dateTime for crawlers
 */
export const LastUpdatedBanner = ({ lastUpdated, className = "" }: LastUpdatedBannerProps) => {
  const displayDate = formatLastUpdated(lastUpdated);
  
  return (
    <div 
      className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}
      itemScope 
      itemType="https://schema.org/Dataset"
    >
      <Calendar className="h-4 w-4" />
      <span>Last updated: </span>
      <time 
        dateTime={lastUpdated} 
        itemProp="dateModified"
        className="font-medium text-foreground"
      >
        {displayDate}
      </time>
      <span className="hidden sm:inline text-muted-foreground/70">•</span>
      <span className="hidden sm:flex items-center gap-1 text-muted-foreground/70">
        <RefreshCw className="h-3 w-3" />
        Rankings updated weekly
      </span>
    </div>
  );
};
