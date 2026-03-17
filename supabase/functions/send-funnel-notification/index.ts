import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const smtpClient = new SMTPClient({
  connection: {
    hostname: "smtp.gmail.com",
    port: 465,
    tls: true,
    auth: {
      username: "robert@top10lists.us",
      password: "pewacsqsjpocgnsp",
    },
  },
});

// Throttle windows by event type (in seconds)
const THROTTLE_WINDOWS: Record<string, number> = {
  profile_edit_viewed: 60,      // User might refresh page
  profile_approved: 86400,      // 24 hours - should never fire twice
  checkout_completed: 86400,    // 24 hours
  profile_fields_submitted: 300, // 5 minutes
  pricing_viewed: 60,           // 1 minute
  accuracy_review_viewed: 60,   // 1 minute
  welcome_viewed: 60,           // 1 minute
  schedule_viewed: 60,          // 1 minute
  default: 30
};

const getThrottleWindow = (eventType: string): number => {
  return THROTTLE_WINDOWS[eventType] || THROTTLE_WINDOWS.default;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client early for throttling
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'robert@top10lists.us';

    const { event_type, agent_name, agent_email, agent_id, city_name, profile_link, cities_selected, neighborhoods_selected } = await req.json();

    if (!event_type) {
      throw new Error('event_type is required');
    }

    // Server-side throttling: Check if this event was fired recently
    if (agent_id) {
      const throttleKey = `funnel:${agent_id}:${event_type}`;
      const throttleWindow = getThrottleWindow(event_type);

      const { data: existingThrottle } = await supabase
        .from("activity_throttle")
        .select("last_logged_at")
        .eq("throttle_key", throttleKey)
        .maybeSingle();

      if (existingThrottle) {
        const lastLogged = new Date(existingThrottle.last_logged_at);
        const secondsAgo = (Date.now() - lastLogged.getTime()) / 1000;

        if (secondsAgo < throttleWindow) {
          console.log(`[throttled] ${event_type} for ${agent_id}, last fired ${secondsAgo.toFixed(1)}s ago`);
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: "throttled" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Update throttle timestamp (upsert)
      await supabase
        .from("activity_throttle")
        .upsert({
          throttle_key: throttleKey,
          last_logged_at: new Date().toISOString()
        }, {
          onConflict: "throttle_key"
        });
    }

    console.log(`📧 Sending funnel notification: ${event_type} for ${agent_name || 'unknown'}`);

    let subject = '';
    let html = '';

    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'America/Phoenix',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    if (event_type === 'step0_viewed') {
      subject = `[Step 1/5] Agent Opened Magic Link: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #e0e7ff; color: #3730a3; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 1 OF 5</p>
          <h2 style="color: #16a34a; margin-bottom: 20px;">🚀 Agent Clicked Magic Link</h2>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            Agent is on the welcome screen. Next step: Review accuracy (Step 2).
          </p>
        </div>
      `;
    } else if (event_type === 'funnel_started') {
      subject = `[Step 1/5] Agent Started Funnel: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #e0e7ff; color: #3730a3; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 1 OF 5</p>
          <h2 style="color: #16a34a; margin-bottom: 20px;">🚀 Agent Started Funnel</h2>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            This agent just clicked a magic link and entered the funnel. They will see their profile for review.
          </p>
          <p style="margin-top: 20px; color: #333;">
            Robert Maynard<br>
            <em>Founder</em><br><br>
            Give me a call if I can help you:<br>
            <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a>
          </p>
        </div>
      `;
    } else if (event_type === 'accuracy_review_viewed') {
      subject = `[Step 2/5] Agent Reviewing Accuracy: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #dbeafe; color: #1e40af; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 2 OF 5</p>
          <h2 style="color: #2563eb; margin-bottom: 20px;">📋 Agent Reviewing Their Profile</h2>
          <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            Agent is reviewing their profile data. Next step: Edit profile (Step 3).
          </p>
        </div>
      `;
    } else if (event_type === 'accuracy_confirmed') {
      subject = `[Step 2/5] Agent Confirmed Accuracy: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #dcfce7; color: #166534; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 2 OF 5 ✓</p>
          <h2 style="color: #16a34a; margin-bottom: 20px;">✅ Agent Confirmed Profile Accuracy</h2>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            Agent confirmed data accuracy. Proceeding to profile edit (Step 3).
          </p>
        </div>
      `;
    } else if (event_type === 'profile_edit_viewed') {
      subject = `[Step 3/5] Agent Editing Profile: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #dbeafe; color: #1e40af; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 3 OF 5</p>
          <h2 style="color: #2563eb; margin-bottom: 20px;">📝 Agent Editing Profile</h2>
          <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            Agent is adding/editing profile details. Next step: Coverage selection (Step 4).
          </p>
        </div>
      `;
    } else if (event_type === 'profile_edited') {
      subject = `[Step 3/5] Agent Saved Edits: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #dcfce7; color: #166534; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 3 OF 5 ✓</p>
          <h2 style="color: #16a34a; margin-bottom: 20px;">📝 Agent Saved Profile Edits</h2>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            Agent submitted profile edits. Check Field Change Requests in admin.
          </p>
        </div>
      `;
    } else if (event_type === 'pricing_viewed') {
      subject = `[Step 4/5] 🟡 Agent Viewing Pricing: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 4 OF 5</p>
          <h2 style="color: #ca8a04; margin-bottom: 20px;">⚡ Agent Viewing Pricing Page</h2>
          <div style="background: #fefce8; border-left: 4px solid #ca8a04; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            <strong>Hot lead!</strong> Agent is selecting coverage. Next step: Checkout (Step 5).
          </p>
        </div>
      `;
    } else if (event_type === 'cities_selected' || event_type === 'neighborhoods_selected') {
      const selectionType = event_type === 'cities_selected' ? 'Cities' : 'Neighborhoods';
      subject = `[Step 4/5] Agent Selected ${selectionType}: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #dcfce7; color: #166534; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 4 OF 5 ✓</p>
          <h2 style="color: #16a34a; margin-bottom: 20px;">📍 Agent Selected ${selectionType}</h2>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
            ${cities_selected ? `<p style="margin: 5px 0;"><strong>Selected:</strong> ${cities_selected.count} cities (${cities_selected.names?.join(', ') || 'N/A'})</p>` : ''}
            ${neighborhoods_selected ? `<p style="margin: 5px 0;"><strong>Selected:</strong> ${neighborhoods_selected.count} neighborhoods ($${neighborhoods_selected.monthly_total}/mo)</p>` : ''}
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            Agent made coverage selections. Next step: Checkout (Step 5).
          </p>
        </div>
      `;
    } else if (event_type === 'checkout_started') {
      subject = `[Step 5/5] 🔥 Agent Started Checkout: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #fee2e2; color: #991b1b; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 5 OF 5</p>
          <h2 style="color: #dc2626; margin-bottom: 20px;">🔥 Agent Starting Checkout!</h2>
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            <strong>VERY HOT LEAD!</strong> Agent is entering payment info. Watch for completion.
          </p>
        </div>
      `;
    } else if (event_type === 'checkout_completed') {
      subject = `[COMPLETE] 💰 Agent Completed Purchase: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #16a34a; color: #ffffff; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">✓ FUNNEL COMPLETE</p>
          <h2 style="color: #16a34a; margin-bottom: 20px;">💰 Purchase Complete!</h2>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            <strong>New paying customer!</strong> Welcome them and ensure their listing is live.
          </p>
        </div>
      `;
    } else if (event_type === 'profile_approved') {
      subject = `[Step 3/5] 🎉 Agent APPROVED Profile: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="background: #f3e8ff; color: #6b21a8; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600; margin-bottom: 16px;">STEP 3 OF 5 ✓</p>
          <h2 style="color: #7c3aed; margin-bottom: 20px;">🎉 Agent Approved Their Profile!</h2>
          <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            <strong>Key milestone!</strong> Agent approved profile. Next step: Coverage selection (Step 4).
          </p>
        </div>
      `;
    } else {
      subject = `Agent Funnel Event: ${event_type}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Funnel Event: ${event_type}</h2>
          <p><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
          <p><strong>Email:</strong> ${agent_email || 'N/A'}</p>
          <p><strong>City:</strong> ${city_name || 'N/A'}</p>
          <p><strong>Time:</strong> ${timestamp}</p>
        </div>
      `;
    }

    // Send email notification via Resend
    let emailSent = false;

    console.log(`📤 Attempting to send email to ${ADMIN_EMAIL} for ${event_type}...`);
    console.log(`📧 Subject: ${subject}`);

    try {
      await smtpClient.send({
        from: "Robert Maynard <robert@top10lists.us>",
        to: ADMIN_EMAIL,
        subject: subject,
        content: "auto",
        html: html,
      });

      emailSent = true;
      console.log(`✅ Funnel notification sent via Gmail SMTP: ${event_type}`);
    } catch (emailError) {
      console.error(`[email-error] ${event_type}:`, emailError);
      // Continue - don't throw, email failure is non-fatal
    } finally {
      try {
        await smtpClient.close();
      } catch (closeError) {
        console.warn('SMTP close error:', closeError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, event_type }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error sending funnel notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
