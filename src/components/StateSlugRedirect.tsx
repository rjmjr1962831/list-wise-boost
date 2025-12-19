import { Navigate, useParams, useLocation } from 'react-router-dom';
import { normalizeStateSlug } from '@/utils/stateSlugMapping';

/**
 * Wrapper component that handles 301-style redirects for legacy state abbreviation URLs
 * e.g., /az/phoenix/top10realestateagents -> /arizona/phoenix/top10realestateagents
 * 
 * This ensures SEO equity is passed to canonical URLs
 */
export function StateSlugRedirect({ children }: { children: React.ReactNode }) {
  const { stateSlug, citySlug, categorySlug, agentSlug } = useParams();
  const location = useLocation();
  
  // If no state slug in URL, render children as-is
  if (!stateSlug) {
    return <>{children}</>;
  }
  
  const { normalized, needsRedirect } = normalizeStateSlug(stateSlug);
  
  // If the state slug is an abbreviation, redirect to the full name version
  if (needsRedirect) {
    // Build the new path with the normalized state slug
    let newPath = `/${normalized}`;
    
    if (citySlug) {
      newPath += `/${citySlug}`;
    }
    if (categorySlug) {
      newPath += `/${categorySlug}`;
    }
    if (agentSlug) {
      newPath += `/${agentSlug}`;
    }
    
    // Preserve query string if any
    const queryString = location.search;
    
    console.log(`[StateSlugRedirect] Redirecting from ${location.pathname} to ${newPath}${queryString}`);
    
    // Use replace to act like a 301 redirect (doesn't add to history)
    return <Navigate to={`${newPath}${queryString}`} replace />;
  }
  
  // No redirect needed, render children
  return <>{children}</>;
}

export default StateSlugRedirect;
