import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApplicationDecisionRequest {
  email: string;
  name: string;
  status: "approved" | "rejected";
  notes?: string;
  profileLink?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, status, notes, profileLink }: ApplicationDecisionRequest = await req.json();

    console.log("Sending application decision email:", { email, name, status, profileLink });

    console.log("Sending application decision email:", { email, name, status });

    const isApproved = status === "approved";
    const subject = isApproved
      ? "🎉 Your Top10Lists.us Application Has Been Approved!"
      : "Update on Your Top10Lists.us Application";

    const emailHtml = isApproved
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #16a34a;">Congratulations, ${name}! 🎉</h1>
          <p>We're excited to inform you that your application to join Top10Lists.us has been <strong>approved</strong>!</p>
          
          ${profileLink ? `
            <div style="text-align: center; margin: 24px 0;">
              <a href="${profileLink}" 
                 style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                View Your Profile
              </a>
            </div>
          ` : ''}

          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 24px 0;">
            <h2 style="color: #15803d; margin-top: 0;">What's Next?</h2>
            <ol style="color: #166534; line-height: 1.8;">
              <li>Your profile is now live on our platform</li>
              <li>Review your listing and make sure all information is accurate</li>
              <li>Optimize your profile for maximum visibility</li>
            </ol>
          </div>

          ${notes ? `
            <div style="margin: 24px 0;">
              <h3 style="color: #64748b;">Additional Notes:</h3>
              <p style="color: #475569; background-color: #f8fafc; padding: 12px; border-radius: 8px;">${notes}</p>
            </div>
          ` : ''}

          <p style="margin-top: 24px;">If you have any questions, please don't hesitate to reach out to our support team.</p>
          
          <p style="margin-top: 32px;">
            Best regards,<br><br>
            <strong>Robert Maynard</strong><br>
            <em>Founder</em><br><br>
            Give me a call if I can help you:<br>
            <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a>
          </p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #64748b;">Application Update</h1>
          <p>Dear ${name},</p>
          
          <p>Thank you for your interest in joining Top10Lists.us. After careful review, we're unable to approve your application at this time.</p>

          ${notes ? `
            <div style="margin: 24px 0;">
              <h3 style="color: #64748b;">Feedback:</h3>
              <p style="color: #475569; background-color: #f8fafc; padding: 12px; border-radius: 8px;">${notes}</p>
            </div>
          ` : ''}

          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0;">
            <p style="color: #991b1b; margin: 0;">You're welcome to reapply once you've addressed the feedback above. We're here to help you succeed!</p>
          </div>

          <p>If you have any questions or would like clarification, please feel free to contact us.</p>
          
          <p style="margin-top: 32px;">
            Best regards,<br><br>
            <strong>Robert Maynard</strong><br>
            <em>Founder</em><br><br>
            Give me a call if I can help you:<br>
            <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a>
          </p>
        </div>
      `;

    const { error } = await resend.emails.send({
      from: 'Robert from Top10lists <hello@top10lists.us>',
      replyTo: 'robert@top10lists.us',
      to: [email],
      subject: subject,
      html: emailHtml,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log("Email sent successfully to:", email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-application-decision function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
