import { useState } from 'react';
import { Star, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { useZillowReviews } from '@/hooks/useZillowReviews';
import { Skeleton } from './ui/skeleton';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';

interface ZillowReviewsSectionProps {
  zuid?: string;
  agentName?: string;
  market?: string;
}

export const ZillowReviewsSection = ({ zuid, agentName, market }: ZillowReviewsSectionProps) => {
  const { reviews, loading, error } = useZillowReviews(zuid ?? null, agentName ?? null, market ?? null);
  const { trackEvent } = useGA4Tracking();
  const [expanded, setExpanded] = useState(false);

  const handleZillowLinkClick = () => {
    trackEvent('press_mention_click', {
      agent_name: agentName || 'Unknown',
      source: 'Zillow Reviews',
      market: market || '',
    });
  };

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t">
        <h4 className="text-lg font-semibold mb-3">Zillow Reviews</h4>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error || !reviews || reviews.reviews.length === 0) {
    const zillowProfileUrl = zuid ? `https://www.zillow.com/profile/${zuid}` : undefined;
    const googleZillowSearchUrl = agentName
      ? `https://www.google.com/search?q=${encodeURIComponent(`${agentName} ${market ?? ''} Zillow reviews`)}`
      : undefined;
    const linkUrl = zillowProfileUrl ?? googleZillowSearchUrl;

    if (!linkUrl) return null;

    return (
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold">Zillow Reviews</h4>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleZillowLinkClick}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            aria-label="View all reviews on Zillow"
          >
            View all <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <Button variant="outline" size="sm" asChild className="w-full">
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2"
            onClick={handleZillowLinkClick}
          >
            Find more reviews
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    );
  }

  
  const initialCount = Math.min(2, reviews.reviews.length);
  const expandedCount = reviews.reviews.length;
  const displayedReviews = expanded ? reviews.reviews : reviews.reviews.slice(0, initialCount);
  const moreCount = Math.max(0, expandedCount - initialCount);
  const remaining = Math.max(0, (reviews.totalReviews || 0) - reviews.reviews.length);
  const zillowProfileUrl = reviews.profileUrl || (zuid ? `https://www.zillow.com/profile/${zuid}` : undefined);
  const googleZillowSearchUrl = agentName
    ? `https://www.google.com/search?q=${encodeURIComponent(`${agentName} ${market ?? ''} Zillow reviews`)}`
    : undefined;
  const linkUrl = zillowProfileUrl ?? googleZillowSearchUrl;
  const linkLabel = zillowProfileUrl ? `Read All Zillow Reviews${remaining > 0 ? ` (${remaining} more)` : ''}` : 'Find more reviews';

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold">Zillow Reviews</h4>
        <div className="flex items-center gap-3">
          {reviews.averageRating > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.round(reviews.averageRating)
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                ({reviews.totalReviews} reviews)
              </span>
            </div>
          )}
          {linkUrl && (
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleZillowLinkClick}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              aria-label="View all reviews on Zillow"
            >
              View all
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        {displayedReviews.map((review, idx) => (
          <div
            key={idx}
            className="bg-muted/30 rounded-lg p-4 border border-border/50"
            itemProp="review"
            itemScope
            itemType="https://schema.org/Review"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-sm" itemProp="author">
                  {review.reviewerName}
                </p>
                {review.reviewDate && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(review.reviewDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                )}
              </div>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      i < review.rating
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground'
                    }`}
                  />
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed" itemProp="reviewBody">
              {review.reviewText}
            </p>
            <meta itemProp="reviewRating" itemScope itemType="https://schema.org/Rating" content={review.rating.toString()} />
          </div>
        ))}
      </div>
      {moreCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => {
            if (!expanded) {
              trackEvent('reviews_expand', {
                agent_name: agentName || 'Unknown',
                market: market || '',
              });
            }
            setExpanded(!expanded);
          }}
        >
          <span className="flex items-center justify-center gap-2">
            {expanded ? (
              <>
                Show fewer <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Show more reviews ({moreCount}) <ChevronDown className="h-4 w-4" />
              </>
            )}
          </span>
        </Button>
      )}
      {linkUrl && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="mt-4 w-full"
        >
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2"
            onClick={handleZillowLinkClick}
          >
            {linkLabel}
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
};
