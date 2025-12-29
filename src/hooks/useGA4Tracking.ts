import { useCallback } from 'react';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    _scrollTracked?: boolean;
  }
}

// GA4 event parameters for tracking user interactions across the site
export interface GA4EventParams {
  market?: string;
  agent_type?: string;
  destination_url?: string;
  badge_type?: string;
  filter_type?: string;
  filter_value?: string;
  percent_scrolled?: number;
  page_path?: string;
  source?: string;
  block_type?: string;
  professional_name?: string;
  professional_id?: string;
  license_number?: string;
  state?: string;
  city?: string;
  category?: string;
  search_type?: string;
  zip_code?: string;
  platform?: string;
  // Neighborhood selection tracking
  neighborhoods_count?: string | number;
  // Social link tracking
  agent_name?: string;
  // FAQ tracking
  section?: string;
  question_count?: number;
  question?: string;
  index?: number;
}

export const useGA4Tracking = () => {
  const trackEvent = useCallback((eventName: string, params: GA4EventParams) => {
    // SSR guard - window and navigator are not available during server-side rendering
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }
    
    // Respect Do Not Track browser setting
    const dnt = navigator.doNotTrack === '1' || (window as any).doNotTrack === '1';
    if (dnt) {
      return;
    }
    
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    } else {
      console.warn('gtag not found - GA4 tracking not initialized');
    }
  }, []);

  return { trackEvent };
};
