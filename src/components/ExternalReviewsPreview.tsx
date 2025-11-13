import { ExternalLink, Star } from 'lucide-react';
import { useExternalReviews } from '@/hooks/useExternalReviews';
import { Skeleton } from './ui/skeleton';

export function ExternalReviewsPreview({
  agentName,
  company,
  market,
}: {
  agentName: string;
  company?: string | null;
  market?: string | null;
}) {
  const { data, loading } = useExternalReviews({ agentName, company, market });

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t">
        <h4 className="text-lg font-semibold mb-3">Reviews from the web</h4>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  const reviews = data?.reviews?.slice(0, 2) || [];
  if (reviews.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold">Reviews from the web</h4>
        <div className="text-xs text-muted-foreground">{data?.sources?.join(' • ')}</div>
      </div>
      <div className="space-y-4">
        {reviews.map((r, idx) => (
          <article key={idx} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {r.reviewerName || 'Reviewer'}
                <span className="ml-2 text-xs text-muted-foreground">{r.source}</span>
              </div>
              {typeof r.rating === 'number' && r.rating > 0 && (
                <div className="flex items-center gap-1 text-primary">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="text-sm font-medium">{r.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            {r.reviewDate && (
              <div className="text-xs text-muted-foreground mt-1">{r.reviewDate}</div>
            )}
            <p className="mt-2 text-sm leading-relaxed">{r.reviewText}</p>
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View source <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
