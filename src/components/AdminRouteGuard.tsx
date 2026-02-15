import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

/** Block only known production hosts; allow all others. Never return null (avoid route fallthrough). */
function isProductionHost(hostname: string): boolean {
  return hostname === 'top10lists.us' || hostname === 'www.top10lists.us';
}

export const AdminRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed(!isProductionHost(window.location.hostname));
  }, []);

  if (allowed === null) {
    return <div className="min-h-[120px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }
  if (!allowed) {
    return <Navigate to="/404" replace />;
  }
  return <>{children}</>;
};
