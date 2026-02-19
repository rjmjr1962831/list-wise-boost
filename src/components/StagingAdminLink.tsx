import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

/** Show Admin link when not on production host (same logic as AdminOr404). */
function isProductionHost(hostname: string): boolean {
  return hostname === "top10lists.us" || hostname === "www.top10lists.us";
}

export const StagingAdminLink = () => {
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    try {
      setShowLink(!isProductionHost(window.location.hostname));
    } catch {
      setShowLink(false);
    }
  }, []);

  if (!showLink) return null;

  const testAgentDashboardUrl = "/agent/dashboard?id=20e0b7f2-5652-424a-9d46-ba74a19cd9a8";

  return (
    <div className="bg-yellow-100 border-b border-yellow-300 py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 flex-wrap">
        <Shield className="h-4 w-4 text-yellow-700" />
        <Link 
          to="/admin" 
          className="text-sm font-medium text-yellow-700 hover:text-yellow-900 underline"
        >
          Admin Dashboard
        </Link>
        <Link 
          to={testAgentDashboardUrl}
          className="text-sm font-medium text-yellow-700 hover:text-yellow-900 underline"
        >
          Test Agent Dashboard
        </Link>
        <span className="text-xs text-yellow-600">(Staging Only)</span>
      </div>
    </div>
  );
};
