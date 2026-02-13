import { Navigate } from 'react-router-dom';

/**
 * AdminRouteGuard - Blocks admin routes on production domain
 * Admin routes should only be accessible on staging.top10lists.us
 */
export const AdminRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  // Allow admin routes on staging and localhost
  const isStaging = hostname === 'staging.top10lists.us' || 
                    hostname.includes('vercel.app') || 
                    hostname === 'localhost';
  
  if (!isStaging) {
    console.log('[AdminRouteGuard] Blocking admin route on production');
    return <Navigate to="/404" replace />;
  }
  
  return <>{children}</>;
};
