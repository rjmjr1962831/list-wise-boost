import { Button, ButtonProps } from "@/components/ui/button";
import { forwardRef } from "react";

export const RippleButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={`ripple-effect ${className}`}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

RippleButton.displayName = "RippleButton";
