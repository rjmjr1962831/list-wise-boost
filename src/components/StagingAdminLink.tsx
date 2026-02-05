import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

export const StagingAdminLink = () => {
  const [isStaging, setIsStaging] = useState(false);

  // Only check hostname on client-side after mount
  useEffect(() => {
    try {
      const hostname = window.location.hostname;
      const staging = 
        hostname.includes('staging') ||
        hostname.includes('vercel.app') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1';
      
      setIsStaging(staging);
    } catch (error) {
      console.error('StagingAdminLink error:', error);
      setIsStaging(false);
    }
  }, []);

  // Don't render anything until we've checked (client-side only)
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
