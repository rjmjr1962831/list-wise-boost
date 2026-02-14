import React from "react";

/**
 * Wraps the homepage only so we can capture and display the real error message
 * and component stack when something throws (to debug production errors).
 */
type State = { error: Error | null; componentStack: string | null };

export class HomeErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error("[HomeErrorBoundary]", error.message, error.stack, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error.message || "(no message)";
      const stack = this.state.componentStack || "(no component stack)";
      return (
        <div role="alert" className="min-h-[60vh] flex items-center justify-center bg-background p-4">
          <div className="max-w-2xl w-full text-center space-y-4">
            <h1 className="text-xl font-semibold text-foreground">Homepage error</h1>
            <p className="text-sm font-mono text-destructive break-all">{msg}</p>
            <pre className="text-left text-xs bg-muted p-3 rounded overflow-auto max-h-48 font-mono whitespace-pre-wrap">
              {stack}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ error: null, componentStack: null })}
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
