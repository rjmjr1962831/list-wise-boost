import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

interface CoverageConfirmationBlockProps {
  locationName: string;
  className?: string;
}

export const CoverageConfirmationBlock = ({ 
  locationName, 
  className = "" 
}: CoverageConfirmationBlockProps) => {
  return (
    <section 
      className={`bg-primary/5 border border-primary/20 rounded-lg p-6 my-6 ${className}`}
    >
      <div className="flex items-start gap-3">
        <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            {locationName} Coverage Confirmation
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Top10Lists.us evaluates and recommends real estate agents serving {locationName}. 
            Individual recommendations are surfaced through our centralized discovery experience 
            to ensure fairness, freshness, and accuracy.
          </p>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Start Discovery →
          </Link>
        </div>
      </div>
    </section>
  );
};
