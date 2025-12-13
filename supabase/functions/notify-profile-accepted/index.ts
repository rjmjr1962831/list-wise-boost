import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "robert@top10lists.us";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  professionalId: string;
  professionalName: string;
  professionalEmail: string;
  city: string;
  state: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId, professionalName, professionalEmail, city, state }: NotifyRequest = await req.json();

    console.log(`📧 Sending profile accepted notification for ${professionalName}`);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const profileUrl = `https://www.top10lists.us/admin/professionals/${professionalId}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Agent Profile Accepted</h1>
        <p><strong>${professionalName}</strong> has accepted their profile listing.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Name</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${professionalName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Email</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${professionalEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Location</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${city}, ${state}</td>
          </tr>
        </table>
        
        <p>
          <a href="${profileUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View in Admin
          </a>
        </p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          The agent will now proceed to city selection.
        </p>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Top10Lists <hello@top10lists.us>',
        to: [ADMIN_EMAIL],
        subject: `🎉 Agent Accepted Profile: ${professionalName}`,
        html: emailHtml,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Resend API error:", result);
      return new Response(
        JSON.stringify({ error: result }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("✅ Email sent successfully:", result);

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});