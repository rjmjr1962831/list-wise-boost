import React from "react";
import { Route, Navigate } from "react-router-dom";

/**
 * Production-only: admin paths 404. Kept in a separate component so Routes
 * children are a single component (avoids reconciliation issues with fragment + conditional).
 */
export function ProductionAdminRoutes() {
  return (
    <>
      <Route path="/admin/*" element={<Navigate to="/404" replace />} />
      <Route path="/a/bot-analytics" element={<Navigate to="/404" replace />} />
      <Route path="/agent/bot-analytics" element={<Navigate to="/404" replace />} />
      <Route path="/og-preview" element={<Navigate to="/404" replace />} />
      <Route path="/crm" element={<Navigate to="/404" replace />} />
      <Route path="/test-visibility-components" element={<Navigate to="/404" replace />} />
    </>
  );
}
