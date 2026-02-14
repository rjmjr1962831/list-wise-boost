import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Handle chunk loading errors from stale deployments
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('Loading chunk')
  ) {
    const hasReloaded = sessionStorage.getItem('chunk-reload');
    if (!hasReloaded) {
      sessionStorage.setItem('chunk-reload', 'true');
      window.location.reload();
    }
    return;
  }
  // Any other uncaught error: show message in root so page isn't blank
  const rootEl = document.getElementById("root");
  if (rootEl && !rootEl.hasChildNodes()) {
    rootEl.innerHTML = [
      '<div style="padding:2rem;font-family:system-ui;max-width:600px;margin:0 auto">',
      '<h1 style="font-size:1.25rem;margin-bottom:1rem">Something went wrong</h1>',
      '<p style="color:#666;margin-bottom:1rem">The page could not load. Try refreshing or check the browser console (F12).</p>',
      '<pre style="font-size:0.75rem;overflow:auto;background:#f5f5f5;padding:1rem">' + (event.message || String(event)) + '</pre>',
      '</div>',
    ].join('');
  }
});

// Clear reload flag on successful load
sessionStorage.removeItem('chunk-reload');

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

// Root error boundary: if anything throws before/during App render, show this instead of blank page
class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[Root] App failed to render:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: "600px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: "1rem" }}>The page could not load. Please try refreshing.</p>
          <pre style={{ fontSize: "0.75rem", overflow: "auto", background: "#f5f5f5", padding: "1rem" }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(root).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
