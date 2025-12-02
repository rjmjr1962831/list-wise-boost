import { Star, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { VerifiedBadge } from './VerifiedBadge';
import { AggregatedRating, PlatformReview } from '@/types/verifiedAgent';
import { formatVerificationDate, getRelativeTime } from '@/config/dataSources';

interface ReviewsCardProps {
  rating: AggregatedRating;
}

const platformLogos: Record<string, string> = {
  google: '🔵',
  zillow: '🏠',
  redfin: '🔴',
  'realtor.com': '🏡',
  yelp: '⭐',
};

function PlatformRow({ review }: { review: PlatformReview }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-lg">{platformLogos[review.platform] || '📊'}</span>
        <span className="font-medium">{review.platformName}</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-semibold">{review.rating.toFixed(1)}</span>
        </div>
        
        <span className="text-sm text-muted-foreground">
          {review.reviewCount} reviews
        </span>
        
        {review.profileUrl && (
          <a 
            href={review.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary"
            title={`View ${review.platformName} profile`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

export function ReviewsCard({ rating }: ReviewsCardProps) {
  // Calculate percentage for visual display (out of 5 stars)
  const ratingPercentage = (rating.weightedAverage / 5) * 100;

  return (
    <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          Reviews & Ratings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aggregated Rating */}
        <div className="flex items-center gap-4 p-3 bg-background/60 rounded-lg">
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {rating.weightedAverage.toFixed(1)}
            </div>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star}
                  className={`h-4 w-4 ${
                    star <= Math.round(rating.weightedAverage)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
          </div>
          
          <div className="flex-1">
            <Progress value={ratingPercentage} className="h-2 bg-amber-100 dark:bg-amber-900/30" />
            <p className="text-sm text-muted-foreground mt-1">
              {rating.totalReviews.toLocaleString()} total reviews across {rating.platformBreakdown.length} platforms
            </p>
          </div>
        </div>

        {/* Platform Breakdown */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Platform Breakdown</h4>
          {rating.platformBreakdown.map((review) => (
            <div key={review.platform}>
              <PlatformRow review={review} />
              <div className="pl-8 pb-2 flex items-center gap-3 text-xs text-muted-foreground">
                {review.lastReviewDate && (
                  <span>Last review: {getRelativeTime(review.lastReviewDate)}</span>
                )}
                <VerifiedBadge 
                  verifiedAt={review.verifiedAt}
                  sourceName={review.platformName}
                  variant="compact"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Last Calculated */}
        <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
          Weighted average calculated: {formatVerificationDate(rating.lastCalculated)}
        </div>
      </CardContent>
    </Card>
  );
}
