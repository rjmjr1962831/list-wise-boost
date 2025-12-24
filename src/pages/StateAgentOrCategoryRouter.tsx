import { useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load the components to avoid circular dependencies
const AgentCardRedirect = lazy(() => import("./AgentCardRedirect"));
const DynamicCategoryList = lazy(() => import("./DynamicCategoryList"));

/**
 * Smart router for /:stateSlug/:citySlug/:thirdSegment
 * 
 * Determines if the third segment is:
 * - A magic link (ends with 4 digits) -> routes to AgentCardRedirect
 * - A category slug -> routes to DynamicCategoryList
 */
const StateAgentOrCategoryRouter = () => {
  const { stateSlug, citySlug, thirdSegment } = useParams<{ stateSlug: string; citySlug: string; thirdSegment: string }>();

  // Check if this looks like a magic link (ends with 4 digits)
  const isMagicLink = thirdSegment && /\d{4}$/.test(thirdSegment);

  const loader = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (isMagicLink) {
    // This is a magic link - delegate to AgentCardRedirect
    return (
      <Suspense fallback={loader}>
        <AgentCardRedirect />
      </Suspense>
    );
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
