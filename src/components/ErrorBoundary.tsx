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
    console.error("ErrorBoundary caught an error:", error, info);
    
    // Don't send alerts for chunk loading errors - they're expected during deployments
    // and are already handled by the reload logic in main.tsx
    if (this.isChunkLoadError(error)) {
      console.log("Chunk loading error detected - skipping alert (handled by reload logic)");
      // Trigger a page reload to get fresh chunks
      const hasReloaded = sessionStorage.getItem('chunk-reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk-reload', 'true');
        window.location.reload();
      }
      return;
    }
    
    // Never send alert from production origin (avoids CORS); also skip when build-time prod flag set
    const isProdBuild = import.meta.env.VITE_IS_PRODUCTION === "1" || import.meta.env.VITE_IS_PRODUCTION === "true";
    const isProdHost = typeof window !== "undefined" && /^(\w+\.)?top10lists\.us$/i.test(window.location.hostname) && !window.location.hostname.includes("staging");
    if (!this.state.alertSent && !isProdBuild && !isProdHost) {
      this.sendErrorAlert(error, info);
    }
  }

  sendErrorAlert = async (error: Error, info: React.ErrorInfo) => {
    try {
      await supabase.functions.invoke('send-frontend-error-alert', {
        body: {
          errorMessage: error.message,
          errorStack: error.stack,
          componentStack: info.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      });
      this.setState({ alertSent: true });
      console.log("Error alert email sent");
    } catch (alertError) {
      console.error("Failed to send error alert:", alertError);
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, alertSent: false });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const msg = this.state.error.message || "(no message)";
      const isProduction = import.meta.env.VITE_IS_PRODUCTION === "1" || import.meta.env.VITE_IS_PRODUCTION === "true";
      return (
        <div role="alert" className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground">An unexpected error occurred while rendering this page.</p>
            <pre className="text-left text-xs bg-muted p-3 rounded overflow-auto max-h-32 font-mono">{msg}</pre>
            {!isProduction && <p className="text-sm text-muted-foreground">An alert has been sent to the admin.</p>}
            <button 
              onClick={this.handleRetry} 
              className="px-4 py-2 rounded border border-border hover:bg-accent"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
