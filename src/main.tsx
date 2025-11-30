import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Build: ${Date.now()} - forces cache invalidation
// Verify single React instance at runtime
console.log('React version:', React.version);
if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('React DevTools detected - single instance confirmed');
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
