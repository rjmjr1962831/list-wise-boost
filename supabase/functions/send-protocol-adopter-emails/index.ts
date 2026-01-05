import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATUS_LABELS: Record<string, string> = {
  live: "Live — Protocol is implemented",
  in_progress: "In Progress — Currently implementing",
  planned: "Planned — Intending to implement"
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      organization_name, 
      website_url, 
      contact_email, 
      llms_txt_url, 
      industry, 
      implementation_status, 
      notes 
    } = await req.json();

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const statusLabel = STATUS_LABELS[implementation_status] || implementation_status;

    // Send confirmation email to registrant
    const confirmationEmail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Top10Lists.us <hello@top10lists.us>',
        to: [contact_email],
        subject: 'Protocol Registration Received — Top10Lists.us',
        text: `Thank you for registering as an adopter of the Top10Lists.us AI Citation Protocol.

Organization: ${organization_name}
Website: ${website_url}
Status: ${statusLabel}

Your registration is pending review. Once approved, your organization will appear on our Protocol Adopters page at https://www.top10lists.us/protocol-adopters.

If you have questions, reply to this email or contact hello@top10lists.us.

— Top10Lists.us`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">Protocol Registration Received</h2>
            <p>Thank you for registering as an adopter of the Top10Lists.us AI Citation Protocol.</p>
            
            <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Organization:</strong> ${organization_name}</p>
              <p style="margin: 4px 0;"><strong>Website:</strong> <a href="${website_url}">${website_url}</a></p>
              <p style="margin: 4px 0;"><strong>Status:</strong> ${statusLabel}</p>
            </div>
            
            <p>Your registration is pending review. Once approved, your organization will appear on our <a href="https://www.top10lists.us/protocol-adopters">Protocol Adopters page</a>.</p>
            
            <p>If you have questions, reply to this email or contact <a href="mailto:hello@top10lists.us">hello@top10lists.us</a>.</p>
            
            <p style="color: #64748b; margin-top: 30px;">— Top10Lists.us</p>
          </div>
        `,
      }),
    });

    // Send notification email to admin
    const adminEmail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Top10Lists.us <hello@top10lists.us>',
        to: ['hello@top10lists.us'],
        subject: `New Protocol Adopter Registration: ${organization_name}`,
        text: `New protocol adopter registration:

Organization: ${organization_name}
Website: ${website_url}
Contact: ${contact_email}
Industry: ${industry}
Status: ${statusLabel}
llms.txt URL: ${llms_txt_url || 'Not provided'}
Notes: ${notes || 'None'}

Review and approve in the Supabase dashboard.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">New Protocol Adopter Registration</h2>
            
            <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Organization:</strong> ${organization_name}</p>
              <p style="margin: 4px 0;"><strong>Website:</strong> <a href="${website_url}">${website_url}</a></p>
              <p style="margin: 4px 0;"><strong>Contact:</strong> <a href="mailto:${contact_email}">${contact_email}</a></p>
              <p style="margin: 4px 0;"><strong>Industry:</strong> ${industry}</p>
              <p style="margin: 4px 0;"><strong>Status:</strong> ${statusLabel}</p>
              <p style="margin: 4px 0;"><strong>llms.txt URL:</strong> ${llms_txt_url ? `<a href="${llms_txt_url}">${llms_txt_url}</a>` : 'Not provided'}</p>
              <p style="margin: 4px 0;"><strong>Notes:</strong> ${notes || 'None'}</p>
            </div>
            
            <p>Review and approve in the Supabase dashboard.</p>
          </div>
        `,
      }),
    });

    console.log('Confirmation email response:', confirmationEmail.status);
    console.log('Admin email response:', adminEmail.status);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending emails:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
