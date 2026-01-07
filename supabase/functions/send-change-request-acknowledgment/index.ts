import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FieldChangeItem {
  fieldName: string;
  currentValue: string | null;
  proposedValue: string | null;
}

interface AcknowledgmentRequest {
  email: string;
  firstName: string;
  fields: FieldChangeItem[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, fields }: AcknowledgmentRequest = await req.json();

    console.log("📧 Sending change request acknowledgment email:", { email, firstName, fieldCount: fields.length });

    if (!email || !firstName || !fields || fields.length === 0) {
      throw new Error("Missing required fields: email, firstName, and fields are required");
    }

    // Build the fields table HTML
    const fieldsTableRows = fields.map(field => `
      <tr>
        <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600; background-color: #f8fafc; width: 25%;">
          ${field.fieldName}
        </td>
        <td style="padding: 12px; border: 1px solid #e2e8f0; background-color: #fef2f2; width: 37.5%;">
          <strong style="color: #64748b; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Current Value:</strong>
          ${field.currentValue ? `<span style="color: #475569;">${truncateText(field.currentValue, 200)}</span>` : '<em style="color: #94a3b8;">Not set</em>'}
        </td>
        <td style="padding: 12px; border: 1px solid #e2e8f0; background-color: #f0fdf4; width: 37.5%;">
          <strong style="color: #64748b; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Requested Value:</strong>
          <span style="color: #166534;">${truncateText(field.proposedValue || '', 200)}</span>
        </td>
      </tr>
    `).join('');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #334155;">
        <p style="font-size: 16px;">Hi ${firstName} -</p>
        
        <p style="font-size: 16px; line-height: 1.6;">
          This is to acknowledge your request for us to review the following fields in your profile:
        </p>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px;">
          <thead>
            <tr style="background-color: #1e3a5f;">
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: left;">Field</th>
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: left;">Current Value</th>
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: left;">Requested Value</th>
            </tr>
          </thead>
          <tbody>
            ${fieldsTableRows}
          </tbody>
        </table>

        <p style="font-size: 16px; line-height: 1.6;">
          We'll review your request and get back to you as soon as possible. Most requests are processed within 1-2 business days.
        </p>

        <p style="font-size: 16px; line-height: 1.6;">
          If you have any questions in the meantime, please give us a call at 
          <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a> - 
          we're here during normal business hours coast to coast.
        </p>

        <p style="margin-top: 32px; font-size: 16px;">Peace -</p>
        
        <p style="font-size: 16px;">
          <strong>Robert Maynard</strong><br>
          <em>Founder</em>
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: 'Robert from Top10lists <robert@top10lists.us>',
      replyTo: 'robert@top10lists.us',
      to: [email],
      subject: "We've Received Your Profile Change Request",
      html: emailHtml,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      throw new Error(error.message);
    }

    console.log("✅ Acknowledgment email sent successfully to:", email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error in send-change-request-acknowledgment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  // Strip HTML tags for display
  const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length <= maxLength) return stripped;
  return stripped.substring(0, maxLength) + '...';
}

serve(handler);
