import { useEffect } from 'react';

/**
 * Hook to signal Prerender.io that the page is ready for caching.
 * Call this in page components AFTER React Helmet has set meta tags.
 * 
 * Usage:
 * ```tsx
 * usePrerenderReady();
 * ```
 */
export function usePrerenderReady() {
  useEffect(() => {
    // Small delay to ensure Helmet has updated the DOM
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        (window as any).prerenderReady = true;
        console.info('[Prerender.io] Page ready signal sent');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);
}

/**
 * Signal prerender ready immediately (for use outside of hooks)
 */
export function signalPrerenderReady() {
  if (typeof window !== 'undefined') {
    (window as any).prerenderReady = true;
  }
}
