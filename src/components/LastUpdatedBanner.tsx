import { Calendar, RefreshCw } from "lucide-react";

interface LastUpdatedBannerProps {
  lastUpdated?: string;
  date?: string; // Alias for lastUpdated
  className?: string;
}

/**
 * Freshness indicator showing when rankings were last updated
 * Includes hidden machine-readable dateTime for crawlers
 */
export const LastUpdatedBanner = ({ lastUpdated, date, className = "" }: LastUpdatedBannerProps) => {
  const isoDate = lastUpdated || date || new Date().toISOString();
  
  const formatted = new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  return (
    <div 
      className={`last-updated-banner flex items-center gap-2 text-sm bg-muted/50 border border-border/50 rounded-md px-4 py-2 ${className}`}
    >
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">Rankings verified and updated: </span>
      <time 
        dateTime={isoDate} 
        itemProp="dateModified"
        className="font-medium text-foreground"
      >
        {formatted}
      </time>
      <span className="update-frequency text-muted-foreground/70 hidden sm:inline"> • Updated daily</span>
      <RefreshCw className="h-3 w-3 text-muted-foreground/70 hidden sm:inline ml-1" />
    </div>
  );
};

// Also export as default for backward compatibility
export default LastUpdatedBanner;
