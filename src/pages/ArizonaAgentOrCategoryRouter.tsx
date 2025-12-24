import { useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load the components to avoid circular dependencies
const AgentCardRedirect = lazy(() => import("./AgentCardRedirect"));
const DynamicCategoryList = lazy(() => import("./DynamicCategoryList"));

/**
 * Smart router for /arizona/:citySlug/:thirdSegment
 * 
 * Determines if the third segment is:
 * - A magic link (ends with 4 digits) -> routes to AgentCardRedirect
 * - A category slug -> routes to DynamicCategoryList
 */
const ArizonaAgentOrCategoryRouter = () => {
  const { citySlug, thirdSegment } = useParams<{ citySlug: string; thirdSegment: string }>();

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
  return (
    <Suspense fallback={loader}>
      <DynamicCategoryList />
    </Suspense>
  );
};

export default ArizonaAgentOrCategoryRouter;
