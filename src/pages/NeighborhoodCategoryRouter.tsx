import { Navigate, useParams } from "react-router-dom";
import { lazy, Suspense, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Lazy load the components
const DynamicCategoryList = lazy(() => import("./DynamicCategoryList"));
const AgentProfile = lazy(() => import("./AgentProfile"));

/**
 * Smart router for /:stateSlug/:citySlug/:thirdSegment/:fourthSegment
 *
 * Determines if the URL pattern is:
 * - Neighborhood + Category (e.g., /arizona/phoenix/arcadia/top10realestateagents)
 * - Category + Agent (e.g., /arizona/phoenix/top10realestateagents/john-smith-1234)
 */
const NeighborhoodCategoryRouter = () => {
  const { stateSlug, citySlug, thirdSegment, fourthSegment } = useParams<{
    stateSlug: string;
    citySlug: string;
    thirdSegment: string;
    fourthSegment: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [isNeighborhoodRoute, setIsNeighborhoodRoute] = useState<boolean | null>(null);
  const [neighborhoodData, setNeighborhoodData] = useState<{
    neighborhood: string;
    neighborhood_slug: string;
  } | null>(null);

  useEffect(() => {
    const checkIfNeighborhood = async () => {
      if (!stateSlug || !citySlug || !thirdSegment || !fourthSegment) {
        setIsNeighborhoodRoute(false);
        setLoading(false);
        return;
      }

      try {
        // Check if the third segment is a neighborhood slug
        const { data: neighborhood, error } = await supabase
          .from('neighborhood_catalog')
          .select('neighborhood, neighborhood_slug')
          .eq('city_area_slug', citySlug)
          .eq('neighborhood_slug', thirdSegment)
          .eq('is_active', true)
          .maybeSingle();

        if (neighborhood) {
          // This is a neighborhood route: /state/city/neighborhood/category
          setIsNeighborhoodRoute(true);
          setNeighborhoodData(neighborhood);
        } else {
          // This is an agent profile route: /state/city/category/agent
          setIsNeighborhoodRoute(false);
        }
      } catch (error) {
        console.error('[NeighborhoodCategoryRouter] Error checking neighborhood:', error);
        // Default to agent profile route on error
        setIsNeighborhoodRoute(false);
      } finally {
        setLoading(false);
      }
    };

    checkIfNeighborhood();
  }, [stateSlug, citySlug, thirdSegment, fourthSegment]);

  const loader = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (loading) {
    return loader;
  }

  if (isNeighborhoodRoute && neighborhoodData) {
    // Route to DynamicCategoryList with neighborhood context
    return (
      <Suspense fallback={loader}>
        <DynamicCategoryList 
          categorySlugOverride={fourthSegment}
          neighborhoodSlug={thirdSegment}
          neighborhoodName={neighborhoodData.neighborhood}
        />
      </Suspense>
    );
  }

  // Route to AgentProfile (thirdSegment=category, fourthSegment=agent)
  return (
    <Suspense fallback={loader}>
      <AgentProfile />
    </Suspense>
  );
};

export default NeighborhoodCategoryRouter;
