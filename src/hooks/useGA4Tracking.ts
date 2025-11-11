import { useCallback } from 'react';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    _scrollTracked?: boolean;
  }
}

export interface GA4EventParams {
  agent_name?: string;
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
}

export const useGA4Tracking = () => {
  const trackEvent = useCallback((eventName: string, params: GA4EventParams) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    } else {
      console.warn('gtag not found - GA4 tracking not initialized');
    }
  }, []);

  return { trackEvent };
};
