interface LogoProps {
  variant?: "light" | "dark" | "icon";
  className?: string;
}

export const Logo = ({ variant = "light", className = "" }: LogoProps) => {
  if (variant === "icon") {
    return (
      <svg 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Top10Lists Icon"
      >
        <defs>
          <linearGradient id="badge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill="url(#badge-gradient)" />
        <path 
          d="M16 24L22 30L32 18" 
          stroke="white" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        <text 
          x="24" 
          y="40" 
          fill="white" 
          fontSize="14" 
          fontWeight="700" 
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
        >
          10
        </text>
      </svg>
    );
  }

  const textColor = variant === "dark" ? "white" : "#0F172A";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Icon Badge */}
      <svg 
        width="48" 
        height="48" 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="logo-badge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill="url(#logo-badge-gradient)" />
        <path 
          d="M16 24L22 30L32 18" 
          stroke="white" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        <text 
          x="24" 
          y="40" 
          fill="white" 
          fontSize="14" 
          fontWeight="700" 
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
        >
          10
        </text>
      </svg>

      {/* Wordmark */}
      <div className="flex items-baseline gap-0">
        <span 
          className="text-2xl font-semibold tracking-tight"
          style={{ color: textColor }}
        >
          Top
        </span>
        <span 
          className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
        >
          10
        </span>
        <span 
          className="text-2xl font-semibold tracking-tight"
          style={{ color: textColor }}
        >
          Lists
        </span>
      </div>
    </div>
  );
};
