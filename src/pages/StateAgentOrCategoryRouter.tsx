import { Navigate, useParams } from "react-router-dom";
import { lazy, Suspense, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Lazy load the components to avoid circular dependencies
const DynamicCategoryList = lazy(() => import("./DynamicCategoryList"));

/**
 * Smart router for /:stateSlug/:citySlug/:thirdSegment
 *
 * Determines if the third segment is:
 * - A legacy alias -> redirect to canonical slug (no trademarked terms)
 * - A magic link (ends with 4 digits) -> checks for canonical_slug and redirects to new URL format
 * - A category slug -> routes to DynamicCategoryList
 */
const StateAgentOrCategoryRouter = () => {
  const { stateSlug, citySlug, thirdSegment } = useParams<{ stateSlug: string; citySlug: string; thirdSegment: string }>();
  const [loading, setLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  const aliasMap: Record<string, string> = {
    "top-realtors": "top10realestateagents",
    "realtors": "top10realestateagents",
  };

  // Handle alias redirects immediately
  if (stateSlug && citySlug && thirdSegment && aliasMap[thirdSegment]) {
    return <Navigate to={`/${stateSlug}/${citySlug}/${aliasMap[thirdSegment]}`} replace />;
  }

  // Check if this looks like a magic link (ends with 4 digits)
  const isMagicLink = thirdSegment && /\d{4}$/.test(thirdSegment);

  useEffect(() => {
    const checkForCanonicalRedirect = async () => {
      if (!isMagicLink || !stateSlug || !citySlug || !thirdSegment) {
        return;
      }

      setLoading(true);

      try {
        // Check if there's a professional with this legacy_url_slug who has a canonical_slug
        // legacy_url_slug format: "{citySlug}/{canonical_slug}"
        const legacySlug = `${citySlug}/${thirdSegment}`;
        
        const { data: agent, error } = await supabase
          .from('professionals')
          .select('canonical_slug, state_slug')
          .eq('legacy_url_slug', legacySlug)
          .eq('active', true)
          .maybeSingle();

        if (agent && agent.canonical_slug && agent.state_slug) {
          // Agent has canonical URL - redirect to it (301 equivalent via replace)
          console.log(`[LegacyRedirect] Found canonical URL for ${legacySlug} -> /${agent.state_slug}/agents/${agent.canonical_slug}`);
          setRedirectPath(`/${agent.state_slug}/agents/${agent.canonical_slug}`);
        } else {
          // No canonical URL yet - use old 4-segment format
          console.log(`[LegacyRedirect] No canonical URL for ${legacySlug}, using legacy format`);
          setRedirectPath(`/${stateSlug}/${citySlug}/top10realestateagents/${thirdSegment}`);
        }
      } catch (error) {
        console.error('[LegacyRedirect] Error checking for canonical redirect:', error);
        // Fallback to legacy format on error
        setRedirectPath(`/${stateSlug}/${citySlug}/top10realestateagents/${thirdSegment}`);
      } finally {
        setLoading(false);
      }
    };

    if (isMagicLink) {
      checkForCanonicalRedirect();
    }
  }, [stateSlug, citySlug, thirdSegment, isMagicLink]);

  // If we determined a redirect path, navigate there
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  const loader = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  // Show loader while checking for canonical redirect
  if (isMagicLink && loading) {
    return loader;
  }

  // If it's a magic link but we haven't set redirect yet, show loader
  if (isMagicLink && !redirectPath) {
    return loader;
  }

  // This is a category slug - delegate to DynamicCategoryList
  // Pass thirdSegment explicitly as categorySlug prop for reliability
  return (
    <Suspense fallback={loader}>
      <DynamicCategoryList categorySlugOverride={thirdSegment} />
    </Suspense>
  );
};

export default StateAgentOrCategoryRouter;
