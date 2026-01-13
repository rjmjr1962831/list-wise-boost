import { Navigate, useParams } from "react-router-dom";
import { lazy, Suspense, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Lazy load the components
const AgentProfile = lazy(() => import("./AgentProfile"));

/**
 * Smart router for /:stateSlug/:citySlug/:thirdSegment/:fourthSegment
 *
 * This router now prioritizes agent profile detection:
 * 1. First checks if fourthSegment matches an agent's canonical_slug
 * 2. If agent found → render AgentProfile
 * 3. If not agent → check if it's an old 4-segment neighborhood URL
 * 4. If neighborhood found → 301 redirect to new 5-segment format with ZIP
 * 5. Otherwise → 404
 */
const NeighborhoodCategoryRouter = () => {
  const { stateSlug, citySlug, thirdSegment, fourthSegment } = useParams<{
    stateSlug: string;
    citySlug: string;
    thirdSegment: string;
    fourthSegment: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [isAgentRoute, setIsAgentRoute] = useState<boolean | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

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
            // This IS an agent profile URL
            console.log('[NeighborhoodCategoryRouter] Agent found:', fourthSegment);
            setIsAgentRoute(true);
            setLoading(false);
            return;
          }
        }

        // STEP 2: Not an agent - check if this is an old neighborhood URL format
        // Old format: /state/city/neighborhood/category
        // thirdSegment = neighborhood_slug, fourthSegment = category_slug
        const { data: neighborhood, error: neighborhoodError } = await supabase
          .from('neighborhood_catalog')
          .select('neighborhood, neighborhood_slug, city_area_slug, primary_zip, zips')
          .eq('city_area_slug', citySlug)
          .eq('neighborhood_slug', thirdSegment)
          .eq('is_active', true)
          .maybeSingle();

        if (neighborhood && !neighborhoodError) {
          // This is an old 4-segment neighborhood URL - redirect to new 5-segment format
          const primaryZip = neighborhood.primary_zip || (neighborhood.zips && neighborhood.zips[0]);
          
          if (primaryZip) {
            const newPath = `/${stateSlug}/${citySlug}/${primaryZip}/${thirdSegment}/${fourthSegment}`;
            console.log(`[NeighborhoodCategoryRouter] Redirecting old neighborhood URL → ${newPath}`);
            setRedirectPath(newPath);
            setLoading(false);
            return;
          }
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

  // Handle redirects (both neighborhood redirects and 404s)
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

  // Fallback to 404
  return <Navigate to="/404" replace />;
};

export default NeighborhoodCategoryRouter;
