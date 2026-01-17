import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'robert@top10lists.us';

    const { event_type, agent_name, agent_email, agent_id, city_name, profile_link } = await req.json();

    if (!event_type) {
      throw new Error('event_type is required');
    }

    console.log(`📧 Sending funnel notification: ${event_type} for ${agent_name || 'unknown'}`);

    let subject = '';
    let html = '';

    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'America/Phoenix',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    if (event_type === 'funnel_started') {
      subject = `🟢 Agent Clicked Into Funnel: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
      subject = `🔵 Agent Viewing Accuracy Review: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">Agent Reviewing Their Profile</h2>
          <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            This agent is reviewing their profile accuracy. They may approve or request corrections.
          </p>
          <p style="margin-top: 20px; color: #333;">
            Robert Maynard<br>
            <em>Founder</em><br><br>
            Give me a call if I can help you:<br>
            <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a>
          </p>
        </div>
      `;
    } else if (event_type === 'profile_edit_viewed') {
      subject = `🔵 Agent Viewing Edit Page: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">Agent Viewing Profile Edit Page</h2>
          <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            This agent is actively engaged with their profile. They may reach out or proceed to pricing.
          </p>
          <p style="margin-top: 20px; color: #333;">
            Robert Maynard<br>
            <em>Founder</em><br><br>
            Give me a call if I can help you:<br>
            <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a>
          </p>
        </div>
      `;
    } else if (event_type === 'pricing_viewed') {
      subject = `🟡 Agent Viewing Pricing: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ca8a04; margin-bottom: 20px;">⚡ Agent Viewing Pricing Page</h2>
          <div style="background: #fefce8; border-left: 4px solid #ca8a04; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            <strong>Hot lead!</strong> This agent is considering premium placement. Follow up may increase conversion.
          </p>
          <p style="margin-top: 20px; color: #333;">
            Robert Maynard<br>
            <em>Founder</em><br><br>
            Give me a call if I can help you:<br>
            <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a>
          </p>
        </div>
      `;
    } else if (event_type === 'checkout_started') {
      subject = `🔥 Agent Started Checkout: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626; margin-bottom: 20px;">🔥 Agent Starting Checkout!</h2>
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            <strong>VERY HOT LEAD!</strong> This agent is entering payment info. Watch for completion or abandonment.
          </p>
          <p style="margin-top: 20px; color: #333;">
            Robert Maynard<br>
            <em>Founder</em><br><br>
            Give me a call if I can help you:<br>
            <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a>
          </p>
        </div>
      `;
    } else if (event_type === 'checkout_completed') {
      subject = `💰 Agent Completed Purchase: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
          <p style="margin-top: 20px; color: #333;">
            Robert Maynard<br>
            <em>Founder</em><br><br>
            Give me a call if I can help you:<br>
            <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a>
          </p>
        </div>
      `;
    } else if (event_type === 'accuracy_confirmed') {
      subject = `✅ Agent Confirmed Accuracy: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #16a34a; margin-bottom: 20px;">✅ Agent Confirmed Profile Accuracy</h2>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            This agent confirmed their profile information is accurate. They may proceed to approval or pricing.
          </p>
        </div>
      `;
    } else if (event_type === 'profile_edited') {
      subject = `📝 Agent Edited Profile: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">📝 Agent Made Profile Edits</h2>
          <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            This agent submitted profile edits. Check the Field Change Requests in admin.
          </p>
        </div>
      `;
    } else if (event_type === 'profile_approved') {
      subject = `🎉 Agent APPROVED Profile: ${agent_name || 'Unknown'}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed; margin-bottom: 20px;">🎉 Agent Approved Their Profile!</h2>
          <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Agent:</strong> ${agent_name || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${agent_email || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${city_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp} (Arizona)</p>
          </div>
          ${profile_link ? `<p><a href="${profile_link}" style="color: #2563eb;">View Profile Link</a></p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            <strong>Key milestone!</strong> This agent has approved their profile and may proceed to pricing.
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

    const { error } = await resend.emails.send({
      from: 'Robert from Top10lists <hello@top10lists.us>',
      replyTo: 'robert@top10lists.us',
      to: [ADMIN_EMAIL],
      subject,
      html,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log(`✅ Funnel notification sent: ${event_type}`);

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
