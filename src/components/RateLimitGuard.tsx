import React from 'react';

interface RateLimitGuardProps {
  children: React.ReactNode;
}

// Temporary no-op guard to prevent hook-related runtime errors
export const RateLimitGuard = ({ children }: RateLimitGuardProps) => {
  return <>{children}</>;
};