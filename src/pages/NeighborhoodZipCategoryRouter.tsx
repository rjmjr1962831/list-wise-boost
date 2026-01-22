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
 * Also checks for aliases and redirects to canonical neighborhood slug.
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
        // Step 1: Try to find neighborhood by primary slug
        const { data: neighborhoodData, error } = await supabase
          .from('neighborhood_catalog')
          .select('neighborhood, neighborhood_slug, city_area_slug, primary_zip, zips')
          .eq('city_area_slug', citySlug)
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('is_active', true)
          .maybeSingle();

        if (!error && neighborhoodData) {
          // Found by primary slug - validate ZIP
          const primaryZip = neighborhoodData.primary_zip;
          const canonicalZip = primaryZip || (neighborhoodData.zips && neighborhoodData.zips[0]) || null;

          if (!canonicalZip) {
            console.log('[NeighborhoodZipCategoryRouter] Neighborhood has no ZIP data');
            setNotFound(true);
            setLoading(false);
            return;
          }

          // Check if URL ZIP matches canonical ZIP
          if (zipCode !== canonicalZip) {
            console.log(`[NeighborhoodZipCategoryRouter] Redirecting ${zipCode} → ${canonicalZip}`);
            setRedirectPath(`/${stateSlug}/${citySlug}/${canonicalZip}/${neighborhoodSlug}/${categorySlug}`);
            setLoading(false);
            return;
          }

          // ZIP matches - render the page
          setNeighborhood(neighborhoodData);
          setLoading(false);
          return;
        }

        // Step 2: Not found by primary slug - check aliases
        console.log('[NeighborhoodZipCategoryRouter] Checking aliases for:', neighborhoodSlug);
        
        const { data: aliasData, error: aliasError } = await supabase
          .from('neighborhood_aliases')
          .select(`
            alias_slug,
            neighborhood_catalog!inner (
              neighborhood,
              neighborhood_slug,
              city_area_slug,
              primary_zip,
              zips,
              is_active
            )
          `)
          .eq('alias_slug', neighborhoodSlug)
          .maybeSingle();

        if (!aliasError && aliasData && aliasData.neighborhood_catalog) {
          const canonical = aliasData.neighborhood_catalog as unknown as NeighborhoodData & { is_active: boolean };
          
          // Verify neighborhood is active and in the correct city
          if (!canonical.is_active || canonical.city_area_slug !== citySlug) {
            console.log('[NeighborhoodZipCategoryRouter] Alias found but neighborhood inactive or wrong city');
            setNotFound(true);
            setLoading(false);
            return;
          }

          // Found via alias - redirect to canonical URL (301)
          const canonicalZip = canonical.primary_zip || (canonical.zips && canonical.zips[0]) || zipCode;
          console.log(`[NeighborhoodZipCategoryRouter] Alias redirect: ${neighborhoodSlug} → ${canonical.neighborhood_slug}`);
          setRedirectPath(`/${stateSlug}/${citySlug}/${canonicalZip}/${canonical.neighborhood_slug}/${categorySlug}`);
          setLoading(false);
          return;
        }

        // Step 3: Not found anywhere
        console.log('[NeighborhoodZipCategoryRouter] Neighborhood not found:', neighborhoodSlug);
        setNotFound(true);
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

  // 301 redirect for non-canonical ZIPs or alias slugs
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
