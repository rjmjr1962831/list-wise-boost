import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    
    // Track 404 in GA4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_not_found', {
        attempted_url: location.pathname,
        referrer: document.referrer || 'direct'
      });
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <Link to="/" className="text-blue-500 underline hover:text-blue-700" target="_blank" rel="noopener noreferrer">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
