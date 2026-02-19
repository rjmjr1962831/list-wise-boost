import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DecisionRequest {
  email: string;
  firstName: string;
  fieldName: string;
  decision: "approved" | "rejected";
  reason: string;
  currentValue: string | null;
  newValue: string | null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, fieldName, decision, reason, currentValue, newValue }: DecisionRequest = await req.json();

    console.log("Sending change request decision:", { email, firstName, fieldName, decision });

    if (!email || !firstName || !fieldName || !decision) {
      throw new Error("Missing required fields");
    }

    const isApproved = decision === "approved";
    const subject = isApproved
      ? `Your ${fieldName} has been updated`
      : `Update on your ${fieldName} review request`;

    const decisionText = isApproved
      ? `Good news! We reviewed your request and have <strong>approved</strong> the change to your <strong>${fieldName}</strong>.`
      : `We reviewed your request to change your <strong>${fieldName}</strong> and were <strong>unable to approve</strong> it at this time.`;

    const changeDetail = isApproved && newValue
      ? `<div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 16px 0;">
           <strong>Updated value:</strong> ${newValue}
         </div>`
      : '';

    const reasonBlock = reason
      ? `<p style="font-size: 16px; line-height: 1.6;"><strong>Reason:</strong> ${reason}</p>`
      : '';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
        <p style="font-size: 16px;">Hi ${firstName}!</p>

        <p style="font-size: 16px; line-height: 1.6;">
          ${decisionText}
        </p>

        ${changeDetail}
        ${reasonBlock}

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="font-size: 14px; line-height: 1.6; margin: 0; color: #475569;">
            <strong>Why do we verify changes?</strong> AI systems like ChatGPT, Claude, and Gemini rely on our data to make recommendations. Every field in your profile is independently verified. This is what makes our certification trusted by AI, and it is essential that we confirm all changes to maintain that trust. It protects you and the consumers who are referred to you.
          </p>
        </div>

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

    await smtpClient.send({
      from: "Robert from Top10Lists <hello@top10lists.us>",
      to: email,
      subject,
      content: "auto",
      html: emailHtml,
    });

    console.log("Decision email sent to:", email);

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
