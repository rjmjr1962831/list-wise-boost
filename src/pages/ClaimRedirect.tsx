import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * Redirects /claim?token=xxx to /funnel/xxx.
 * Used for claim links like https://www.top10lists.us/claim?token=e1e71db2-6469-46ec-b777-e009e02133b6
 */
export default function ClaimRedirect() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return <Navigate to="/404" replace />;
  }

  return <Navigate to={`/funnel/${token}`} replace />;
}
