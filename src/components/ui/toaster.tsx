import React from "react";

// Minimal no-op Toaster to avoid hook/runtime issues.
// Toast logic is handled via the `toast` helper; this component
// just satisfies layout imports without using React hooks.
export function Toaster() {
  return null;
}
