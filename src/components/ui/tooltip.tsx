import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

// Safe no-op provider wrapper to avoid runtime issues in certain environments
const TooltipProvider: React.FC<React.PropsWithChildren<{ delayDuration?: number; skipDelayDuration?: number }>> = ({ children }) => {
  return <>{children}</>;
};

// Safe no-op Tooltip components to avoid Provider dependency at runtime
const Tooltip: React.FC<React.PropsWithChildren<{ delayDuration?: number }>> = ({ children }) => <>{children}</>;

const TooltipTrigger = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div"> & Record<string, any>>(
  ({ children }, ref) => <div ref={ref}>{children}</div>
);
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div"> & Record<string, any>>(
  ({ className, children }, ref) => (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "z-50 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
        className
      )}
    >
      {children}
    </div>
  )
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
