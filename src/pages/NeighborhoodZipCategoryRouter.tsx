import { Navigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface NeighborhoodCatalogRow {
  neighborhood_slug: string;
  city_area_slug: string;
  is_active: boolean;
}

/**
 * Legacy 5-segment neighborhood URLs (with ZIP).
 * Redirects to canonical 4-segment URL: /:stateSlug/:citySlug/:neighborhoodSlug/:categorySlug
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
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const validateAndRoute = async () => {
      if (!stateSlug || !citySlug || !zipCode || !neighborhoodSlug || !categorySlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Validate neighborhood exists, then redirect to canonical 4-segment URL (no ZIP)
        const { data: neighborhoodData, error } = await supabase
          .from('neighborhood_catalog')
          .select('neighborhood, neighborhood_slug, city_area_slug, primary_zip, zips')
          .eq('city_area_slug', citySlug)
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('is_active', true)
          .maybeSingle();

        if (!error && neighborhoodData) {
          setRedirectPath(`/${stateSlug}/${citySlug}/${neighborhoodSlug}/${categorySlug}`);
          setLoading(false);
          return;
        }

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
          const canonical = aliasData.neighborhood_catalog as unknown as NeighborhoodCatalogRow;
          if (canonical.is_active && canonical.city_area_slug === citySlug) {
            setRedirectPath(`/${stateSlug}/${citySlug}/${canonical.neighborhood_slug}/${categorySlug}`);
            setLoading(false);
            return;
          }
        }

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

  if (notFound) {
    return <Navigate to="/404" replace />;
  }

  return null;
};

export default NeighborhoodZipCategoryRouter;
