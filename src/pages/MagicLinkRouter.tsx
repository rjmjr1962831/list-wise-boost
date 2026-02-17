import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Handles magic link clicks: /dashboard/:token
 * 
 * Flow:
 * 1. Look up professional by dashboard_token
 * 2. If approved: create session, redirect to /agent/dashboard
 * 3. If not approved: redirect to /funnel/:verification_token
 * 4. If not found: show error
 */
export default function MagicLinkRouter() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No token provided");
      return;
    }
    handleMagicLink(token);
  }, [token]);

  const handleMagicLink = async (dashboardToken: string) => {
    try {
      // Look up professional by dashboard_token
      const { data: professional, error: fetchError } = await supabase
        .from("professionals")
        .select("id, name, verification_token, funnel_status, active")
        .eq("dashboard_token", dashboardToken)
        .maybeSingle();

      if (fetchError || !professional) {
        setError("Invalid or expired link. Please contact support.");
        return;
      }

      if (!professional.active) {
        setError("This profile is no longer active.");
        return;
      }

      // If agent is approved, create a session and send to dashboard
      if (professional.funnel_status === "approved") {
        const { data: sessionData, error: sessionError } =
          await supabase.functions.invoke("create-session-from-token", {
            body: { token: professional.id },
          });

        if (sessionError || !sessionData?.success) {
          console.error("[MagicLinkRouter] Session creation failed:", sessionError || sessionData?.error);
          setError("Unable to create session. Please try logging in.");
          return;
        }

        // Store session and redirect to dashboard
        localStorage.setItem("agent_session_token", sessionData.sessionToken);
        navigate("/agent/dashboard", { replace: true });
        return;
      }

      // Not approved yet, send to funnel
      const funnelToken = professional.verification_token || professional.id;
      navigate(`/funnel/${funnelToken}`, { replace: true });

    } catch (err) {
      console.error("[MagicLinkRouter] Unexpected error:", err);
      setError("Something went wrong. Please try again.");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold mb-4">Link Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <a
            href="https://www.top10lists.us"
            className="inline-block px-6 py-3 bg-primary text-white rounded-lg"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    </div>
  );
}
