import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

/**
 * AdminRouteGuard - Blocks admin routes on production domain.
 * Only allows admin on staging / Vercel preview / localhost. Defers check to client so
 * we don't redirect to 404 before window is available (which would send everyone to 404 then home).
 */
export const AdminRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isStaging =
      hostname === 'staging.top10lists.us' ||
      hostname.includes('vercel.app') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1';
    setAllowed(isStaging);
  }, []);

  // Wait for client before deciding (avoid SSR/initial render redirect)
  if (allowed === null) {
    return null; // or a small loading state
  }
  if (!allowed) {
    return <Navigate to="/404" replace />;
  }
  return <>{children}</>;
};
