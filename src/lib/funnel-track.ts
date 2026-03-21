import { supabase } from '@/integrations/supabase/client';

/**
 * Funnel event tracking — logs to crm_contact_activity and creates crm_tasks
 * for actionable events.
 */

type FunnelEvent =
  | 'funnel_landed'
  | 'funnel_step_intro'
  | 'funnel_step_review1'
  | 'funnel_step_credentials'
  | 'funnel_step_review2'
  | 'funnel_step_review_final'
  | 'funnel_step_cities'
  | 'funnel_step_neighborhoods'
  | 'funnel_step_pricing'
  | 'funnel_step_success'
  | 'funnel_data_saved'
  | 'funnel_cities_selected'
  | 'funnel_neighborhoods_selected'
  | 'funnel_tier_selected'
  | 'funnel_checkout_started';

const STEP_LABELS: Record<string, string> = {
  funnel_landed: 'Landed on funnel',
  funnel_step_intro: 'Viewed intro',
  funnel_step_review1: 'Viewing review step 1',
  funnel_step_credentials: 'Viewing credentials',
  funnel_step_review2: 'Viewing review step 2',
  funnel_step_review_final: 'Viewing final review',
  funnel_step_cities: 'Selecting cities',
  funnel_step_neighborhoods: 'Selecting neighborhoods',
  funnel_step_pricing: 'Viewing pricing',
  funnel_step_success: 'Completed funnel',
  funnel_data_saved: 'Saved profile data',
  funnel_cities_selected: 'Selected cities',
  funnel_neighborhoods_selected: 'Selected neighborhoods',
  funnel_tier_selected: 'Selected tier',
  funnel_checkout_started: 'Started checkout',
};

// Events that create a CRM task
const TASK_EVENTS: Record<string, { title: (name: string) => string; description: string; priority: string; taskType: string }> = {
  funnel_landed: {
    title: (name) => `${name} opened the verification funnel`,
    description: 'Agent clicked through from email and landed on the funnel. Warm lead.',
    priority: 'normal',
    taskType: 'funnel_landed',
  },
  funnel_data_saved: {
    title: (name) => `${name} saved profile data in the funnel`,
    description: 'Agent is actively editing their profile. Engaged lead.',
    priority: 'normal',
    taskType: 'funnel_engaged',
  },
  funnel_step_pricing: {
    title: (name) => `${name} reached the pricing page`,
    description: 'Agent made it to pricing. High-intent lead — consider a call.',
    priority: 'high',
    taskType: 'funnel_pricing_viewed',
  },
  funnel_tier_selected: {
    title: (name) => `${name} selected a tier`,
    description: 'Agent chose a certification tier. Follow up to confirm.',
    priority: 'high',
    taskType: 'funnel_tier_selected',
  },
  funnel_checkout_started: {
    title: (name) => `${name} started Stripe checkout`,
    description: 'Agent clicked upgrade and was sent to Stripe. If they don\'t complete, follow up.',
    priority: 'high',
    taskType: 'funnel_checkout',
  },
  funnel_step_success: {
    title: (name) => `${name} completed the funnel`,
    description: 'Agent completed the entire verification funnel. Welcome call recommended.',
    priority: 'high',
    taskType: 'funnel_completed',
  },
};

// Deduplicate: don't fire the same event for the same agent within this window
const DEDUP_MINUTES = 30;
const recentEvents = new Map<string, number>();

function dedupeKey(professionalId: string, event: string): string {
  return `${professionalId}:${event}`;
}

export async function trackFunnelEvent(
  event: FunnelEvent,
  professional: { id: string; name?: string | null },
  metadata?: Record<string, unknown>,
) {
  const key = dedupeKey(professional.id, event);
  const now = Date.now();
  const lastFired = recentEvents.get(key);
  if (lastFired && now - lastFired < DEDUP_MINUTES * 60 * 1000) return;
  recentEvents.set(key, now);

  const agentName = professional.name || 'Unknown agent';

  // Log to crm_contact_activity
  supabase.from('crm_contact_activity').insert({
    professional_id: professional.id,
    activity_type: event,
    description: STEP_LABELS[event] || event,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  }).then(() => {});

  // Create CRM task for actionable events
  const taskDef = TASK_EVENTS[event];
  if (taskDef) {
    supabase.from('crm_tasks').insert({
      professional_id: professional.id,
      title: taskDef.title(agentName),
      description: taskDef.description,
      status: 'pending',
      priority: taskDef.priority,
      task_type: taskDef.taskType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).then(() => {});
  }
}
