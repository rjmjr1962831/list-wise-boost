import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

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

    if (event_type === 'profile_edit_viewed') {
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
      from: 'Top10Lists <hello@top10lists.us>',
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
