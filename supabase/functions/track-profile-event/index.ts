import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Events that should trigger admin notifications
const NOTIFICATION_EVENTS = [
  'step0_viewed',
  'funnel_started',
  'magic_link_clicked',
  'welcome_viewed',
  'accuracy_review_viewed',
  'accuracy_confirmed',
  'profile_edit_viewed',
  'profile_edited',
  'profile_approved',
  'pricing_viewed',
  'checkout_started',
  'checkout_completed',
  'cities_selected',
  'neighborhoods_selected',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { token, event_name, event_data } = await req.json();

    if (!token) {
      throw new Error('token is required');
    }

    if (!event_name) {
      throw new Error('event_name is required');
    }

    console.log('📊 Tracking event:', event_name, 'for token:', token.substring(0, 8) + '...');

    // Try to find professional by verification_token first, then by id
    let professional = null;
    
    // First try verification_token
    const { data: byToken } = await supabase
      .from('professionals')
      .select('id, name, email, business_city')
      .eq('verification_token', token)
      .single();
    
    if (byToken) {
      professional = byToken;
    } else {
      // Fallback: try by professional id directly
      const { data: byId } = await supabase
        .from('professionals')
        .select('id, name, email, business_city')
        .eq('id', token)
        .single();
      professional = byId;
    }

    if (!professional) {
      console.error('❌ Invalid token - not found by verification_token or id');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid token'
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if this is the agent's first step0_viewed event (funnel entry)
    let isFirstStep0View = false;
    if (event_name === 'step0_viewed') {
      const { count: existingStep0Count } = await supabase
        .from('funnel_events')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', professional.id)
        .eq('event_name', 'step0_viewed');

      isFirstStep0View = existingStep0Count === 0;
    }

    // Insert event
    const { error: insertError } = await supabase
      .from('funnel_events')
      .insert({
        professional_id: professional.id,
        event_name,
        event_data: event_data || {}
      });

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      throw insertError;
    }

    // On first step0_viewed, update funnel_status to trigger Hot lead sync
    if (isFirstStep0View) {
      console.log('🔥 First step0_viewed detected - upgrading to Hot lead');
      
      const { error: updateError } = await supabase
        .from('professionals')
        .update({ 
          funnel_status: 'approved',
          funnel_started_at: new Date().toISOString()
        })
        .eq('id', professional.id);

      if (updateError) {
        console.error('⚠️ Failed to update funnel_status:', updateError);
      } else {
        console.log('✅ Funnel status updated to approved - Pipedrive sync will set Hot lead');
      }
    }

    console.log('✅ Event tracked:', event_name, 'for:', professional.name);

    // Send notification for important funnel events
    if (NOTIFICATION_EVENTS.includes(event_name)) {
      try {
        console.log('📧 Triggering notification for:', event_name);
        
        // Map event names to notification event types
        let notificationEventType = event_name;
        if (event_name === 'step0_viewed' || event_name === 'funnel_started' || event_name === 'magic_link_clicked' || event_name === 'welcome_viewed') {
          notificationEventType = 'funnel_started';
        }
        
        // Build notification payload
        const notificationPayload: Record<string, any> = {
          event_type: notificationEventType,
          agent_name: professional.name,
          agent_email: professional.email,
          agent_id: professional.id,
          city_name: professional.business_city,
          profile_link: `https://www.top10lists.us/profile/${token}`,
        };

        // Add cities data for cities_selected event
        if (event_name === 'cities_selected' && event_data) {
          notificationPayload.cities_selected = {
            count: event_data.city_count || 0,
            names: event_data.city_names ? event_data.city_names.split(', ') : [],
          };
        }

        // Add neighborhoods data for neighborhoods_selected event
        if (event_name === 'neighborhoods_selected' && event_data) {
          notificationPayload.neighborhoods_selected = {
            count: event_data.neighborhood_count || 0,
            names: event_data.neighborhood_names ? event_data.neighborhood_names.split(', ') : [],
            monthly_total: event_data.monthly_total || 0,
          };
        }

        const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/send-funnel-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(notificationPayload),
        });

        const notificationResult = await notificationResponse.json();
        if (notificationResult.success) {
          console.log('✅ Notification sent successfully');
        } else {
          console.error('⚠️ Notification failed:', notificationResult.error);
        }
      } catch (notifyError) {
        // Don't fail the main event tracking if notification fails
        console.error('⚠️ Failed to send notification:', notifyError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Event tracked successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error tracking event:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
