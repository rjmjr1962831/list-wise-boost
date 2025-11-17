import React from "react";

type Props = { children: React.ReactNode };

type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    // In case of persistent issues, a hard reload can help resolve duplicate React instances
    // window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="min-h-screen flex items-center justify-center">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="opacity-80">An unexpected error occurred while rendering this page.</p>
            <button onClick={this.handleRetry} className="px-4 py-2 rounded border">
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
