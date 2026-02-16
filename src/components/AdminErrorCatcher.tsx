import React from "react";
import { Link } from "react-router-dom";

type Props = { children: React.ReactNode };

type State = { error: Error | null };

/** Catches errors in admin tree and shows message + stack so we can fix the real cause. */
export class AdminErrorCatcher extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[AdminErrorCatcher]", error);
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      const text = `${e.message}\n\n${e.stack ?? ""}`;
      return (
        <div className="min-h-screen bg-background p-6 font-sans">
          <h1 className="text-xl font-bold text-red-600 mb-4">Admin failed to load</h1>
          <p className="text-sm text-muted-foreground mb-2">Copy this entire block and send it so we can fix the issue:</p>
          <textarea
            readOnly
            className="w-full h-56 p-3 text-xs font-mono bg-muted border rounded overflow-auto"
            value={text}
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded border border-border hover:bg-accent"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <Link to="/" className="px-4 py-2 rounded border border-border hover:bg-accent inline-block">
              Go home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
