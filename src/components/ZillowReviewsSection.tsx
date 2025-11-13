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
    return null;
  }

  const [expanded] = useState(true);
  const initialCount = reviews.reviews.length;
  const expandedCount = reviews.reviews.length;
  const displayedReviews = reviews.reviews;
  const moreCount = 0;
  const remaining = Math.max(0, (reviews.totalReviews || 0) - reviews.reviews.length);
  const zillowProfileUrl = zuid ? `https://www.zillow.com/profile/${zuid}` : undefined;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold">Zillow Reviews</h4>
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
      {zillowProfileUrl && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="mt-4 w-full"
        >
          <a
            href={zillowProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2"
            onClick={handleZillowLinkClick}
          >
            Read All Zillow Reviews{remaining > 0 ? ` (${remaining} more)` : ''}
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
};
