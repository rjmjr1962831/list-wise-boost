import { useLocation, Navigate } from "react-router-dom";

/** Redirects /dashboard to /agent/dashboard and preserves query string (e.g. ?id= for admin test). */
export function DashboardRedirectWithSearch() {
  const { search } = useLocation();
  return <Navigate to={`/agent/dashboard${search}`} replace />;
}
