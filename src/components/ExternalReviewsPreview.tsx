import { ExternalLink, Star } from 'lucide-react';
import { useExternalReviews } from '@/hooks/useExternalReviews';
import { Skeleton } from './ui/skeleton';
import { useState } from 'react';

// Helper function to format relative time (e.g., "5 days ago")
function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;
    
    const diffYears = Math.floor(diffMonths / 12);
    if (diffYears === 1) return '1 year ago';
    return `${diffYears} years ago`;
  } catch {
    return dateString;
  }
}

// Helper function to format review dates without time
function formatReviewDate(dateString: string): string {
  try {
    // Handle ISO format (2024-07-28T11:59:00)
    if (dateString.includes('T')) {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    // Handle MM/DD/YYYY HH:MI:SS format
    if (dateString.includes('/')) {
      const datePart = dateString.split(' ')[0];
      const [month, day, year] = datePart.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    return dateString;
  } catch {
    return dateString;
  }
}

// Helper function to parse review date for sorting
function parseReviewDate(dateString?: string): number {
  if (!dateString) return 0;
  try {
    if (dateString.includes('T')) {
      return new Date(dateString).getTime();
    }
    if (dateString.includes('/')) {
      const datePart = dateString.split(' ')[0];
      const [month, day, year] = datePart.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
    }
    return 0;
  } catch {
    return 0;
  }
}

export function ExternalReviewsPreview({
  agentName,
  company,
  market,
  zillowProfileUrl,
  professionalId,
}: {
  agentName: string;
  company?: string | null;
  market?: string | null;
  zillowProfileUrl?: string | null;
  professionalId?: string;
}) {
  const { data, loading } = useExternalReviews({ agentName, company, market, professionalId });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t">
        <h4 className="text-lg font-semibold mb-3">Recent Reviews</h4>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  // Show all reviews with valid ratings and text, sorted newest first
  const recentReviews = (data?.reviews || [])
    .filter(r => {
      const hasValidRating = r.rating && r.rating >= 1 && r.rating <= 5;
      const hasReviewText = r.reviewText && r.reviewText.trim().length > 0;
      return hasValidRating && hasReviewText;
    })
    .sort((a, b) => {
      const dateA = parseReviewDate(a.reviewDate);
      const dateB = parseReviewDate(b.reviewDate);
      return dateB - dateA; // newest first
    })
    .slice(0, 3);

  if (recentReviews.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold">Recent Reviews</h4>
        <div className="flex flex-col items-end gap-1">
          <div className="text-xs text-muted-foreground">{data?.sources?.join(' • ')}</div>
          {data?.lastFetched && (
            <div className="text-xs text-muted-foreground italic">
              Updated {formatRelativeTime(data.lastFetched)}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {recentReviews.map((r, idx) => {
          const isOpen = !!expanded[idx];
          const reviewText = r.reviewText || '';
          const needsExpansion = reviewText.length > 150;
          
          return (
            <article key={idx} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {r.reviewerName || 'Reviewer'}
                  <span className="ml-2 text-xs text-muted-foreground capitalize">{r.source}</span>
                </div>
                {typeof r.rating === 'number' && r.rating > 0 && (
                  <div className="flex items-center gap-1 text-primary">
                    <Star className="h-4 w-4 fill-current" />
                    <span className="text-sm font-medium">{r.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              {r.reviewDate && (
                <div className="text-xs text-muted-foreground mt-1">{formatReviewDate(r.reviewDate)}</div>
              )}
              <p 
                className="mt-2 text-sm leading-relaxed"
                style={!isOpen && needsExpansion ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                } : {}}
              >
                {reviewText}
              </p>
              <div className="flex items-center justify-between mt-2">
                {needsExpansion && (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline font-medium"
                    onClick={() => setExpanded((prev) => ({ ...prev, [idx]: !isOpen }))}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? 'less' : 'more'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
