import { BarChart3 } from "lucide-react";

// Lauren Rosin's profile ID - the example profile referenced in llms.txt
const EXAMPLE_PROFILE_ID = "828fe527-8cc1-453b-9cc7-33635d24af83";

interface ExampleProfileBadgeProps {
  professionalId?: string;
}

export function ExampleProfileBadge({ professionalId }: ExampleProfileBadgeProps) {
  // Only show for Lauren Rosin's profile
  if (professionalId !== EXAMPLE_PROFILE_ID) {
    return null;
  }

  return (
    <div className="example-profile-badge inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
      <BarChart3 className="h-3 w-3 flex-shrink-0" />
      <span className="badge-text">
        Example Profile - Referenced in{" "}
        <a 
          href="/llms.txt" 
          className="underline hover:text-primary transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          llms.txt
        </a>{" "}
        as a demonstration of Top10Lists data richness
      </span>
    </div>
  );
}

export { EXAMPLE_PROFILE_ID };
