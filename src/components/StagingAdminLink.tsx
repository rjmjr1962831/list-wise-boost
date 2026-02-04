import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

export const StagingAdminLink = () => {
  // Only show on staging environments (not production)
  const isStaging = 
    window.location.hostname.includes('staging') ||
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  // Don't render anything in production
  if (!isStaging) {
    return null;
  }

  return (
    <div className="bg-yellow-100 border-b border-yellow-300 py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        <Shield className="h-4 w-4 text-yellow-700" />
        <Link 
          to="/a/znfltH7o8qO0qjapxBKmtuhQXvARldgt" 
          className="text-sm font-medium text-yellow-700 hover:text-yellow-900 underline"
        >
          Admin Dashboard
        </Link>
        <span className="text-xs text-yellow-600">(Staging Only)</span>
      </div>
    </div>
  );
};
