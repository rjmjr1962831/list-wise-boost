import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FieldResult {
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
  status: 'approved' | 'rejected';
}

interface CompletedRequest {
  email: string;
  firstName: string;
  results: FieldResult[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, results }: CompletedRequest = await req.json();

    console.log("📧 Sending change request completed email:", { email, firstName, resultCount: results.length });

    if (!email || !firstName || !results || results.length === 0) {
      throw new Error("Missing required fields: email, firstName, and results are required");
    }

    // Separate approved and rejected results
    const approvedResults = results.filter(r => r.status === 'approved');
    const rejectedResults = results.filter(r => r.status === 'rejected');

    // Build the results table HTML
    const resultsTableRows = results.map(result => {
      const isApproved = result.status === 'approved';
      const statusColor = isApproved ? '#16a34a' : '#dc2626';
      const statusText = isApproved ? '✓ Approved' : '✗ Rejected';
      const rowBgColor = isApproved ? '#f0fdf4' : '#fef2f2';
      
      return `
        <tr style="background-color: ${rowBgColor};">
          <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">
            ${result.fieldName}
          </td>
          <td style="padding: 12px; border: 1px solid #e2e8f0;">
            ${result.previousValue ? `<span style="color: #475569;">${truncateText(result.previousValue, 150)}</span>` : '<em style="color: #94a3b8;">Not set</em>'}
          </td>
          <td style="padding: 12px; border: 1px solid #e2e8f0;">
            ${isApproved 
              ? `<span style="color: #166534;">${truncateText(result.newValue || '', 150)}</span>`
              : `<em style="color: #94a3b8;">No change</em>`
            }
          </td>
          <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: center;">
            <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
          </td>
        </tr>
      `;
    }).join('');

    const summaryText = approvedResults.length === results.length
      ? "All your requested changes have been approved and applied to your profile."
      : rejectedResults.length === results.length
        ? "After careful review, we were unable to approve the requested changes at this time."
        : `We approved ${approvedResults.length} of your ${results.length} requested changes.`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #334155;">
        <p style="font-size: 16px;">Hi ${firstName} -</p>
        
        <p style="font-size: 16px; line-height: 1.6;">
          We have reviewed your requests to change public data in your profile. Here are the results:
        </p>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px;">
          <thead>
            <tr style="background-color: #1e3a5f;">
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: left; width: 20%;">Field</th>
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: left; width: 30%;">Previous Value</th>
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: left; width: 30%;">New Value</th>
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: center; width: 20%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${resultsTableRows}
          </tbody>
        </table>

        <p style="font-size: 16px; line-height: 1.6; background-color: #f8fafc; padding: 16px; border-radius: 8px;">
          ${summaryText}
        </p>

        <p style="font-size: 16px; line-height: 1.6;">
          If you would like to discuss this more, please give us a call at 
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
      subject: "Review Completed - Your Profile Change Request",
      html: emailHtml,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      throw new Error(error.message);
    }

    console.log("✅ Completed email sent successfully to:", email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error in send-change-request-completed:", error);
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
