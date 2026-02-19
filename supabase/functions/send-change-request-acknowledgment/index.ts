import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcknowledgmentRequest {
  email: string;
  firstName: string;
  fieldName: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, fieldName }: AcknowledgmentRequest = await req.json();

    console.log("Sending change request acknowledgment:", { email, firstName, fieldName });

    if (!email || !firstName || !fieldName) {
      throw new Error("Missing required fields: email, firstName, fieldName");
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
        <p style="font-size: 16px;">Hi ${firstName}!</p>

        <p style="font-size: 16px; line-height: 1.6;">
          We got your request to review your <strong>${fieldName}</strong>. I will get back to you with our decision within 24 hours.
        </p>

        <p style="font-size: 16px; line-height: 1.6;">
          If you want faster service, just give Robert a call at <strong>(602) 758-9600</strong>.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

        <p style="font-size: 14px; color: #64748b;">
          If you need further assistance, reply to this email or call Robert at (602) 758-9600.
        </p>

        <p style="font-size: 14px; color: #64748b; margin-top: 16px;">
          Robert Maynard<br/>
          Top10Lists.us
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: "Robert from Top10Lists <hello@top10lists.us>",
      replyTo: "hello@top10lists.us",
      to: [email],
      subject: `We received your request to review your ${fieldName}`,
      html: emailHtml,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(error.message);
    }

    console.log("Acknowledgment email sent to:", email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
