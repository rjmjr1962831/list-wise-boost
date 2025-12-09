import { Navigate } from 'react-router-dom';

// Redirect /ranking-methodology to /about/ranking-methodology
export default function RankingMethodologyRedirect() {
  return <Navigate to="/about/ranking-methodology" replace />;
}
