import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * /dashboard/:token -> /agent/dashboard?t=:token
 * 
 * This is just a redirect. All auth logic lives in AgentDashboard.
 * Cannot fail. Cannot have race conditions. Cannot have stale cache issues.
 */
export default function MagicLinkRouter() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    if (token) {
      window.location.href = `/agent/dashboard?t=${token}`;
    }
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
      </div>
    </div>
  );
}
