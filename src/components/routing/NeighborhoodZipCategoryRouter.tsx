import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * Redirects old ZIP-based neighborhood URLs to new ZIP-less format
 * 
 * OLD: /arizona/phoenix/85018/arcadia/top10realestateagents
 * NEW: /arizona/phoenix/arcadia/top10realestateagents
 * 
 * This maintains backwards compatibility while standardizing on
 * ZIP-less URLs since neighborhoods can span multiple ZIP codes.
 */
export default function NeighborhoodZipCategoryRouter() {
  const { stateSlug, citySlug, zipCode, neighborhoodSlug, categorySlug } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to ZIP-less URL (301 permanent redirect)
    const newPath = `/${stateSlug}/${citySlug}/${neighborhoodSlug}/${categorySlug}`;
    navigate(newPath, { replace: true });
  }, [stateSlug, citySlug, neighborhoodSlug, categorySlug, navigate]);

  return null; // No UI needed, just redirect
}
