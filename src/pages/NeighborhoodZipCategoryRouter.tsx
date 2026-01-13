import { Navigate, useParams } from "react-router-dom";
import { lazy, Suspense, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Lazy load the component
const DynamicCategoryList = lazy(() => import("./DynamicCategoryList"));

interface NeighborhoodData {
  neighborhood: string;
  neighborhood_slug: string;
  city_area_slug: string;
  primary_zip: string | null;
  zips: string[] | null;
}

/**
 * Router for 5-segment neighborhood URLs with ZIP code:
 * /:stateSlug/:citySlug/:zipCode/:neighborhoodSlug/:categorySlug
 * 
 * Validates ZIP code and redirects to canonical (primary_zip) if needed.
 * Returns 404 for invalid neighborhoods.
 */
const NeighborhoodZipCategoryRouter = () => {
  const { stateSlug, citySlug, zipCode, neighborhoodSlug, categorySlug } = useParams<{
    stateSlug: string;
    citySlug: string;
    zipCode: string;
    neighborhoodSlug: string;
    categorySlug: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [neighborhood, setNeighborhood] = useState<NeighborhoodData | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const validateAndRoute = async () => {
      if (!stateSlug || !citySlug || !zipCode || !neighborhoodSlug || !categorySlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Validate ZIP format (5 digits)
      const zipRegex = /^\d{5}$/;
      if (!zipRegex.test(zipCode)) {
        console.log('[NeighborhoodZipCategoryRouter] Invalid ZIP format:', zipCode);
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Query neighborhood by slug and city
        const { data: neighborhoodData, error } = await supabase
          .from('neighborhood_catalog')
          .select('neighborhood, neighborhood_slug, city_area_slug, primary_zip, zips')
          .eq('city_area_slug', citySlug)
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('is_active', true)
          .maybeSingle();

        if (error || !neighborhoodData) {
          console.log('[NeighborhoodZipCategoryRouter] Neighborhood not found:', neighborhoodSlug);
          setNotFound(true);
          setLoading(false);
          return;
        }

        const primaryZip = neighborhoodData.primary_zip;

        // If no primary_zip set, use first ZIP from array
        const canonicalZip = primaryZip || (neighborhoodData.zips && neighborhoodData.zips[0]) || null;

        if (!canonicalZip) {
          // Neighborhood has no ZIP data - 404
          console.log('[NeighborhoodZipCategoryRouter] Neighborhood has no ZIP data');
          setNotFound(true);
          setLoading(false);
          return;
        }

        // Check if URL ZIP matches canonical ZIP
        if (zipCode !== canonicalZip) {
          // Redirect to canonical URL with primary_zip
          console.log(`[NeighborhoodZipCategoryRouter] Redirecting ${zipCode} → ${canonicalZip}`);
          setRedirectPath(`/${stateSlug}/${citySlug}/${canonicalZip}/${neighborhoodSlug}/${categorySlug}`);
          setLoading(false);
          return;
        }

        // ZIP matches - render the page
        setNeighborhood(neighborhoodData);
        setLoading(false);

      } catch (err) {
        console.error('[NeighborhoodZipCategoryRouter] Error:', err);
        setNotFound(true);
        setLoading(false);
      }
    };

    validateAndRoute();
  }, [stateSlug, citySlug, zipCode, neighborhoodSlug, categorySlug]);

  const loader = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (loading) {
    return loader;
  }

  // 301 redirect for non-canonical ZIPs
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  // 404 for invalid requests
  if (notFound) {
    return <Navigate to="/404" replace />;
  }

  // Render DynamicCategoryList with neighborhood context
  return (
    <Suspense fallback={loader}>
      <DynamicCategoryList 
        categorySlugOverride={categorySlug}
        neighborhoodSlug={neighborhoodSlug}
        neighborhoodName={neighborhood?.neighborhood}
        neighborhoodZipCode={zipCode}
      />
    </Suspense>
  );
};

export default NeighborhoodZipCategoryRouter;
