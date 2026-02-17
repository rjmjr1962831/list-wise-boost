import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * BULLETPROOF Magic Link Handler: /dashboard/:token
 * 
 * This is the ONLY entry point for agents clicking their dashboard link.
 * It must ALWAYS work. No login required. No stored credentials needed.
 * The magic link IS the authentication.
 * 
 * Flow:
 * 1. Look up professional by dashboard_token
 * 2. If approved: create session, store in localStorage, hard redirect
 * 3. If not approved: redirect to funnel
 * 4. On ANY error: show clear message with retry
 */
export default function MagicLinkRouter() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Verifying your link...");

  useEffect(() => {
    if (!token) {
      setError("No token provided in the link.");
      return;
    }

    // Clear any stale session before creating a new one
    localStorage.removeItem("agent_session_token");

    handleMagicLink(token);
  }, [token]);

  const handleMagicLink = async (dashboardToken: string) => {
    try {
      // Step 1: Look up professional
      setStatus("Looking up your profile...");
      
      const { data: professional, error: fetchError } = await supabase
        .from("professionals")
        .select("id, name, verification_token, funnel_status, active")
        .eq("dashboard_token", dashboardToken)
        .maybeSingle();

      if (fetchError) {
        console.error("[MagicLink] Lookup error:", fetchError);
        setError("We could not verify your link. Please try again or contact support.");
        return;
      }

      if (!professional) {
        setError("This link is not recognized. It may have been replaced with a new one. Please check your latest email from Top10Lists.");
        return;
      }

      if (!professional.active) {
        setError("This profile is no longer active. Please contact support if you believe this is an error.");
        return;
      }

      // Step 2: Not approved yet? Send to funnel.
      if (professional.funnel_status !== "approved") {
        const funnelToken = professional.verification_token || professional.id;
        setStatus("Redirecting to your profile setup...");
        window.location.href = `/funnel/${funnelToken}`;
        return;
      }

      // Step 3: Create session (approved agents)
      setStatus(`Welcome back, ${professional.name.split(" ")[0]}! Loading your dashboard...`);

      const { data: sessionData, error: sessionError } =
        await supabase.functions.invoke("create-session-from-token", {
          body: { token: professional.id },
        });

      if (sessionError || !sessionData?.success) {
        console.error("[MagicLink] Session error:", sessionError || sessionData?.error);
        
        // Retry once
        setStatus("Retrying...");
        await new Promise((r) => setTimeout(r, 1000));
        
        const { data: retry, error: retryErr } =
          await supabase.functions.invoke("create-session-from-token", {
            body: { token: professional.id },
          });

        if (retryErr || !retry?.success) {
          console.error("[MagicLink] Retry failed:", retryErr || retry?.error);
          setError("We had trouble creating your session. Please try clicking your link again, or contact support.");
          return;
        }

        // Retry succeeded
        localStorage.setItem("agent_session_token", retry.sessionToken);
        // Hard redirect to avoid React state issues
        window.location.href = "/agent/dashboard";
        return;
      }

      // Step 4: Store session and hard redirect
      localStorage.setItem("agent_session_token", sessionData.sessionToken);
      
      // Use window.location.href for a FULL page load
      // This guarantees AgentDashboard reads the fresh localStorage value
      window.location.href = "/agent/dashboard";

    } catch (err) {
      console.error("[MagicLink] Unexpected error:", err);
      setError("Something unexpected happened. Please try clicking your link again.");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md mx-auto p-8 border rounded-xl bg-card shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl">!</span>
          </div>
          <h1 className="text-xl font-bold mb-3">Link Issue</h1>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setError(null);
                setStatus("Retrying...");
                if (token) handleMagicLink(token);
              }}
              className="w-full px-6 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
            <a
              href="mailto:support@top10lists.us"
              className="block w-full px-6 py-3 border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground text-sm">{status}</p>
      </div>
    </div>
  );
}
