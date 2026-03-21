/**
 * UpgradeSection: Renders the funnel pricing page directly inside the agent dashboard.
 * Same look as the funnel pricing page, keeps dashboard left nav intact.
 */
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

const Step7Pricing = lazy(() => import("@/pages/funnel/Step7Pricing"));

interface UpgradeSectionProps {
  professional: { id: string; verification_token?: string; name?: string };
}

export function UpgradeSection({ professional }: UpgradeSectionProps) {
  const token = professional.verification_token || professional.id;

  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <Step7Pricing tokenOverride={token} embed />
    </Suspense>
  );
}
