/**
 * Wraps AdminRoutes in Routes so it can be mounted as the element for admin paths.
 * ErrorBoundary catches admin-only crashes so the rest of the app stays up.
 */
import { Routes } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminRoutes } from "./AdminRoutes";

export default function AdminAppWrapper() {
  return (
    <ErrorBoundary>
      <Routes>
        <AdminRoutes />
      </Routes>
    </ErrorBoundary>
  );
}
