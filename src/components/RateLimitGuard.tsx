import { useRateLimitCheck } from '@/hooks/useRateLimitCheck';

interface RateLimitGuardProps {
  children: React.ReactNode;
}

export const RateLimitGuard = ({ children }: RateLimitGuardProps) => {
  const { isBlocked, rateLimitInfo, isChecking } = useRateLimitCheck();

  // Show nothing while checking (or a loading spinner if desired)
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show blocked message if rate limit exceeded
  if (isBlocked && rateLimitInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center shadow-lg">
          <div className="mb-4 text-5xl">🚫</div>
          <h1 className="text-2xl font-bold mb-4 text-foreground">Rate Limit Exceeded</h1>
          <p className="text-muted-foreground mb-4">
            {rateLimitInfo.message || 'You have exceeded the request limit for this site.'}
          </p>
          {rateLimitInfo.resetInDays !== undefined && (
            <p className="text-sm text-muted-foreground">
              Your limit will reset in approximately {rateLimitInfo.resetInDays} day{rateLimitInfo.resetInDays !== 1 ? 's' : ''}.
            </p>
          )}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Request Count</div>
            <div className="text-2xl font-bold text-foreground">
              {rateLimitInfo.requestCount} / {rateLimitInfo.limit}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render children if allowed
  return <>{children}</>;
};