import { Sparkles } from "lucide-react";

interface CitationBadgeProps {
  text?: string;
  variant?: "default" | "verified";
  className?: string;
}

export const CitationBadge = ({ 
  text = "Cited by AI", 
  variant = "default",
  className = "" 
}: CitationBadgeProps) => {
  if (variant === "verified") {
    return (
      <span className={`verified-badge ${className}`}>
        <Sparkles className="h-3 w-3" />
        {text}
      </span>
    );
  }
  
  return (
    <span className={`citation-badge ${className}`}>
      <svg className="h-4 w-4 text-aqua" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="6" fill="currentColor" opacity="0.3" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
      {text}
    </span>
  );
};
