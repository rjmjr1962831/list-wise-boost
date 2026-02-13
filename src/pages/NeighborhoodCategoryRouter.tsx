import { Navigate, useParams, useNavigate } from "react-router-dom";
import { lazy, Suspense, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Lazy load the components
const AgentProfile = lazy(() => import("./AgentProfile"));
const DynamicCategoryList = lazy(() => import("./DynamicCategoryList"));

/**
 * Smart router for /:stateSlug/:citySlug/:thirdSegment/:fourthSegment
 *
 * This router handles two cases:
 * 1. Agent profiles: fourthSegment matches an agent's canonical_slug → render AgentProfile
 * 2. Neighborhood pages: thirdSegment is a neighborhood_slug → render DynamicCategoryList with neighborhood context
 * 3. Otherwise → 404
 */
const NeighborhoodCategoryRouter = () => {
  const { stateSlug, citySlug, thirdSegment, fourthSegment } = useParams<{
    stateSlug: string;
    citySlug: string;
    thirdSegment: string;
    fourthSegment: string;
  }>();
  
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAgentRoute, setIsAgentRoute] = useState<boolean | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [neighborhoodData, setNeighborhoodData] = useState<{ name: string; slug: string } | null>(null);

  useEffect(() => {
    const determineRoute = async () => {
      if (!stateSlug || !citySlug || !thirdSegment || !fourthSegment) {
        setIsAgentRoute(false);
        setLoading(false);
        return;
      }

      try {
        // STEP 1: Check if fourthSegment is an agent's canonical_slug
        // Agent slugs typically end with -XXXX (last 4 digits of phone)
        const agentSlugPattern = /-\d{4}$/;
        const couldBeAgent = agentSlugPattern.test(fourthSegment);

        if (couldBeAgent) {
          // Query for agent with this canonical_slug
          const { data: agent, error: agentError } = await supabase
            .from('professionals')
            .select('id, canonical_slug')
            .eq('canonical_slug', fourthSegment)
            .maybeSingle();

          if (agent && !agentError) {
            // Redirect to canonical agent URL using setRedirectPath pattern
            const canonicalUrl = `/${stateSlug}/agents/${fourthSegment}`;
            console.log('[NeighborhoodCategoryRouter] Agent found, setting redirect to:', canonicalUrl);
            setRedirectPath(canonicalUrl);
            setLoading(false);
            return;
          }
        }

        // STEP 2: Not an agent - check if this is a neighborhood URL
        // Format: /state/city/neighborhood/category
        // thirdSegment = neighborhood_slug, fourthSegment = category_slug
        const { data: neighborhood, error: neighborhoodError } = await supabase
          .from('neighborhood_catalog')
          .select('neighborhood, neighborhood_slug, city_area_slug, primary_zip, zips')
          .eq('city_area_slug', citySlug)
          .eq('neighborhood_slug', thirdSegment)
          .eq('is_active', true)
          .maybeSingle();

        if (neighborhood && !neighborhoodError) {
          // This is a neighborhood page - render DynamicCategoryList with neighborhood context
          console.log(`[NeighborhoodCategoryRouter] Neighborhood found: ${neighborhood.neighborhood}`);
          setNeighborhoodData({
            name: neighborhood.neighborhood,
            slug: neighborhood.neighborhood_slug
          });
          setIsAgentRoute(false);
          setLoading(false);
          return;
        }

        // STEP 3: Neither agent nor neighborhood - 404
        console.log('[NeighborhoodCategoryRouter] No match found, returning 404');
        setIsAgentRoute(false);
        setRedirectPath('/404');
        setLoading(false);

      } catch (error) {
        console.error('[NeighborhoodCategoryRouter] Error:', error);
        setIsAgentRoute(false);
        setLoading(false);
      }
    };

    determineRoute();
  }, [stateSlug, citySlug, thirdSegment, fourthSegment]);

  const loader = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (loading) {
    return loader;
  }

  // Handle redirects (both agent canonical redirects and 404s)
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  // Route to AgentProfile (thirdSegment=category, fourthSegment=agent)
  if (isAgentRoute) {
    return (
      <Suspense fallback={loader}>
        <AgentProfile />
      </Suspense>
    );
  }

  // Route to neighborhood page (thirdSegment=neighborhood, fourthSegment=category)
  if (neighborhoodData) {
    return (
      <Suspense fallback={loader}>
        <DynamicCategoryList
          categorySlugOverride={fourthSegment}
          neighborhoodSlug={neighborhoodData.slug}
          neighborhoodName={neighborhoodData.name}
        />
      </Suspense>
    );
  }

  // Fallback to 404
  return <Navigate to="/404" replace />;
};

export default NeighborhoodCategoryRouter;
