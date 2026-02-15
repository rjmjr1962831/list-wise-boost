import React from "react";
import { supabase } from "@/integrations/supabase/client";

type Props = { children: React.ReactNode };

type State = { hasError: boolean; error?: Error; alertSent: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, alertSent: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  // Check if error is a chunk loading error (expected during deployments)
  isChunkLoadError = (error: Error): boolean => {
    const message = error.message || '';
    return (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('ChunkLoadError') ||
      message.includes('Loading CSS chunk')
    );
  };

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      console.error("ErrorBoundary caught an error:", error, info);
    } catch (_) {}

    if (this.isChunkLoadError(error)) {
      try {
        const hasReloaded = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("chunk-reload") : null;
        if (!hasReloaded && typeof window !== "undefined") {
          sessionStorage.setItem("chunk-reload", "true");
          window.location.reload();
        }
      } catch (_) {}
      return;
    }

    try {
      const isProdBuild = import.meta.env.VITE_IS_PRODUCTION === "1" || import.meta.env.VITE_IS_PRODUCTION === "true";
      let isProdHost = false;
      if (typeof window !== "undefined" && window.location && window.location.hostname) {
        isProdHost = /^(\w+\.)?top10lists\.us$/i.test(window.location.hostname) && !window.location.hostname.includes("staging");
      }
      if (!this.state.alertSent && !isProdBuild && !isProdHost) {
        this.sendErrorAlert(error, info);
      }
    } catch (_) {}
  }

  sendErrorAlert = async (error: Error, info: React.ErrorInfo) => {
    try {
      let url = "";
      let userAgent = "";
      if (typeof window !== "undefined") {
        try { url = window.location?.href ?? ""; } catch (_) {}
        try { userAgent = typeof navigator !== "undefined" ? navigator.userAgent ?? "" : ""; } catch (_) {}
      }
      await supabase.functions.invoke("send-frontend-error-alert", {
        body: {
          errorMessage: error.message,
          errorStack: error.stack,
          componentStack: info.componentStack,
          url,
          userAgent,
          timestamp: new Date().toISOString(),
        },
      });
      this.setState({ alertSent: true });
    } catch (_) {}
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, alertSent: false });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      let msg = "(no message)";
      try {
        msg = (this.state.error && typeof this.state.error === "object" && "message" in this.state.error)
          ? String((this.state.error as Error).message)
          : String(this.state.error);
      } catch (_) {}
      let isProdHost = false;
      try {
        if (typeof window !== "undefined" && window.location?.hostname)
          isProdHost = /^(\w+\.)?top10lists\.us$/i.test(window.location.hostname) && !window.location.hostname.includes("staging");
      } catch (_) {}
      const isProdBuild = import.meta.env.VITE_IS_PRODUCTION === "1" || import.meta.env.VITE_IS_PRODUCTION === "true";
      const showAlertSent = !isProdBuild && !isProdHost;
      return (
        <div role="alert" className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground">An unexpected error occurred while rendering this page.</p>
            <pre className="text-left text-xs bg-muted p-3 rounded overflow-auto max-h-32 font-mono" id="error-boundary-msg">{msg}</pre>
            <p className="text-xs text-muted-foreground">If your browser shows &quot;SES&quot; or &quot;lockdown&quot; in the console, try a private/incognito window or disable that extension.</p>
            {showAlertSent && <p className="text-sm text-muted-foreground">An alert has been sent to the admin.</p>}
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => {
                  try {
                    const el = document.getElementById("error-boundary-msg");
                    if (el?.textContent) navigator.clipboard?.writeText(el.textContent);
                  } catch (_) {}
                }}
                className="px-4 py-2 rounded border border-border hover:bg-accent text-sm"
              >
                Copy error
              </button>
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 rounded border border-border hover:bg-accent"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
