import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FunnelEventData {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Hook for tracking funnel events via the track-profile-event edge function
 * All events are associated with a professional via their verification token
 */
export function useFunnelTracking(token: string | undefined) {
  const trackEvent = useCallback(async (
    eventName: string, 
    eventData: FunnelEventData = {}
  ) => {
    if (!token) {
      console.warn('useFunnelTracking: No token provided, skipping event:', eventName);
      return;
    }

    try {
      await supabase.functions.invoke('track-profile-event', {
        body: { 
          token, 
          event_name: eventName,
          event_data: eventData
        }
      });
      console.log('Funnel event tracked:', eventName);
    } catch (err) {
      console.error('Failed to track funnel event:', eventName, err);
    }
  }, [token]);

  return { trackEvent };
}

// Event name constants for consistency
export const FUNNEL_EVENTS = {
  // Magic link / entry events
  MAGIC_LINK_CLICKED: 'magic_link_clicked',
  FUNNEL_STARTED: 'funnel_started',
  
  // Welcome / intro events
  WELCOME_VIEWED: 'welcome_viewed',
  SEE_LISTING_CLICKED: 'see_listing_clicked',
  
  // Profile edit events
  PROFILE_EDIT_VIEWED: 'profile_edit_viewed',
  PROFILE_EDIT_STARTED: 'profile_edit_started',
  PROFILE_EDITED: 'profile_edited',
  PROFILE_APPROVED: 'profile_approved',
  
  // Pricing events
  PRICING_VIEWED: 'pricing_viewed',
  PACKAGE_SELECTED: 'package_selected',
  CITY_SELECTED: 'city_selected',
  
  // Checkout events
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_COMPLETED: 'checkout_completed',
  CHECKOUT_ABANDONED: 'checkout_abandoned',
  
  // Free listing events
  FREE_CITY_SELECTED: 'free_city_selected',
  FREE_LISTING_COMPLETED: 'free_listing_completed',
  
  // Schedule events
  SCHEDULE_VIEWED: 'schedule_viewed',
  SCHEDULE_CLICKED_FROM_PRICING: 'schedule_clicked_from_pricing',
  
  // Other navigation
  SELECTION_CLICKED_FROM_PRICING: 'selection_clicked_from_pricing',
} as const;
