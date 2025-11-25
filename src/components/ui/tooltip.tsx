import * as React from "react";

import { cn } from "@/lib/utils";

// Lightweight tooltip primitives that avoid Radix hook issues.
// Currently the app does not rely on advanced tooltip behavior,
// so these safe shims are sufficient and prevent runtime crashes.

type TooltipProps = {
  children: React.ReactNode;
};

const TooltipProvider: React.FC<TooltipProps> = ({ children }) => {
  return <>{children}</>;
};

const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  return <>{children}</>;
};

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button ref={ref} className={cn(className)} {...props}>
    {children}
  </button>
));
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "z-50 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
      className,
    )}
    {...props}
  >
    {children}
  </div>
));
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
