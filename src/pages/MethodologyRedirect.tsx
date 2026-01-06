import { Navigate } from 'react-router-dom';

// Redirect /methodology to /about/ranking-methodology for legacy llms.txt references
export default function MethodologyRedirect() {
  return <Navigate to="/about/ranking-methodology" replace />;
}