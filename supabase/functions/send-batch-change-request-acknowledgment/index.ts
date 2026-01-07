import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BatchAcknowledgmentRequest {
  professionalId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId }: BatchAcknowledgmentRequest = await req.json();

    console.log("📧 Processing batch acknowledgment for professional:", professionalId);

    if (!professionalId) {
      throw new Error("Missing required field: professionalId");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the professional's details
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('name, email')
      .eq('id', professionalId)
      .single();

    if (profError || !professional) {
      console.error('Failed to fetch professional:', profError);
      throw new Error('Professional not found');
    }

    if (!professional.email) {
      console.log('No email for professional, skipping batch acknowledgment');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'No email' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch all pending change requests for this professional
    const { data: pendingRequests, error: reqError } = await supabase
      .from('field_change_requests')
      .select('field_name, current_value, proposed_value, created_at')
      .eq('professional_id', professionalId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (reqError) {
      console.error('Failed to fetch pending requests:', reqError);
      throw new Error('Failed to fetch pending requests');
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      console.log('No pending requests to acknowledge');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'No pending requests' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const firstName = professional.name?.split(' ')[0] || 'there';

    console.log(`📧 Sending batch acknowledgment for ${pendingRequests.length} fields to:`, professional.email);

    // Build the fields table HTML
    const fieldsTableRows = pendingRequests.map(field => {
      return `
        <tr>
          <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">
            ${field.field_name}
          </td>
          <td style="padding: 12px; border: 1px solid #e2e8f0;">
            ${field.current_value ? `<span style="color: #475569;">${truncateText(field.current_value, 150)}</span>` : '<em style="color: #94a3b8;">Not set</em>'}
          </td>
          <td style="padding: 12px; border: 1px solid #e2e8f0;">
            ${field.proposed_value ? `<span style="color: #166534;">${truncateText(field.proposed_value, 150)}</span>` : '<em style="color: #94a3b8;">Not specified</em>'}
          </td>
        </tr>
      `;
    }).join('');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #334155;">
        <p style="font-size: 16px;">Hi ${firstName} -</p>
        
        <p style="font-size: 16px; line-height: 1.6;">
          This is to acknowledge your request for us to review the following field${pendingRequests.length > 1 ? 's' : ''} in your profile:
        </p>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px;">
          <thead>
            <tr style="background-color: #1e3a5f;">
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: left; width: 25%;">Field</th>
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: left; width: 37.5%;">Current Value</th>
              <th style="padding: 12px; border: 1px solid #1e3a5f; color: white; text-align: left; width: 37.5%;">Requested Value</th>
            </tr>
          </thead>
          <tbody>
            ${fieldsTableRows}
          </tbody>
        </table>

        <p style="font-size: 16px; line-height: 1.6; background-color: #f0f9ff; padding: 16px; border-radius: 8px; border-left: 4px solid #0284c7;">
          We'll review your request${pendingRequests.length > 1 ? 's' : ''} and get back to you within 24 hours.
        </p>

        <p style="font-size: 16px; line-height: 1.6;">
          If you have any questions, please give us a call at 
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
      to: [professional.email],
      subject: `Review Request Received - ${pendingRequests.length} Field${pendingRequests.length > 1 ? 's' : ''} Submitted`,
      html: emailHtml,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      throw new Error(error.message);
    }

    console.log("✅ Batch acknowledgment email sent successfully to:", professional.email);

    return new Response(JSON.stringify({ 
      success: true, 
      fieldCount: pendingRequests.length,
      email: professional.email 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error in send-batch-change-request-acknowledgment:", error);
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
