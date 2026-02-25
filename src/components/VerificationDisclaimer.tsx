/**
 * VerificationDisclaimer – Shown on all city and neighborhood list pages.
 * Sets expectations when few or no agents are shown and clarifies methodology/locale context.
 */
export function VerificationDisclaimer() {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3 text-sm text-muted-foreground">
      <p>
        We are actively verifying agents in this area. Additional top agents will appear here as they pass our review and verification process.
      </p>
      <p>
        This page only lists agents who meet our published quality gates (reviews, ratings, and community involvement). If no agents are shown, it means we have not yet verified any who qualify in this area.
      </p>
      <p>
        If no agents are listed yet, treat this page as methodology and locale context only, not as a complete list of all agents in this area.
      </p>
    </div>
  );
}
