import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-instantly-webhook',
};

// Map Instantly event types to funnel statuses
const EVENT_TO_STATUS: Record<string, string> = {
  "email_sent": "outreach_sent",
  "email_opened": "outreach_opened",
  "email_clicked": "outreach_clicked",
  "reply_received": "outreach_replied",
  "lead_unsubscribed": "outreach_unsubscribed",
  "email_bounced": "outreach_bounced",
};

// Priority: higher number = do not overwrite with lower
const STATUS_PRIORITY: Record<string, number> = {
  "welcome": 0,
  "outreach_sent": 1,
  "outreach_opened": 2,
  "outreach_clicked": 3,
  "outreach_replied": 4,
  "outreach_unsubscribed": 5,
  "outreach_bounced": 5,
  "approved": 10,
  "edit_complete": 10,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const payload = await req.json();
    const eventType = payload.event_type || payload.type || '';
    const leadEmail = payload.email || payload.lead_email || '';

    if (!leadEmail) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'no email in payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newStatus = EVENT_TO_STATUS[eventType];
    if (!newStatus) {
      console.log(`Unknown Instantly event: ${eventType}`, JSON.stringify(payload).substring(0, 200));
      return new Response(JSON.stringify({ status: 'ignored', event: eventType, reason: 'unmapped event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up professional by email
    const { data: professionals, error: lookupError } = await supabase
      .from('professionals')
      .select('id, email, funnel_status, name')
      .eq('email', leadEmail)
      .limit(1);

    if (lookupError) {
      return new Response(JSON.stringify({ error: lookupError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!professionals || professionals.length === 0) {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'email not found', email: leadEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const professional = professionals[0];
    const currentStatus = professional.funnel_status || 'welcome';
    const currentPriority = STATUS_PRIORITY[currentStatus] ?? 0;
    const newPriority = STATUS_PRIORITY[newStatus] ?? 0;

    // Never overwrite manual statuses
    if (currentPriority >= 10) {
      return new Response(JSON.stringify({ status: 'skipped', reason: `manual status '${currentStatus}' preserved`, email: leadEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only update if higher priority
    if (newPriority <= currentPriority) {
      return new Response(JSON.stringify({ status: 'skipped', reason: `'${currentStatus}' >= '${newStatus}'`, email: leadEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabase
      .from('professionals')
      .update({ funnel_status: newStatus })
      .eq('id', professional.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updated ${professional.name} (${leadEmail}): ${currentStatus} -> ${newStatus} [${eventType}]`);

    return new Response(JSON.stringify({
      status: 'updated', email: leadEmail, name: professional.name,
      previous: currentStatus, current: newStatus, event: eventType,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
