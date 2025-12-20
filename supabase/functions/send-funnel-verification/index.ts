import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  email: string;
  name: string;
  firstName: string;
  verificationUrl: string;
  professionalId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, firstName, verificationUrl, professionalId }: VerificationRequest = await req.json();

    console.log(`📧 Sending funnel verification email to ${email} (${name})`);

    // Generate a verification token and store it
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate a simple token
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Store the verification token
    const { error: updateError } = await supabase
      .from('professionals')
      .update({
        verification_token: verificationToken,
        verification_token_expires_at: expiresAt,
        verification_started_at: new Date().toISOString(),
      })
      .eq('id', professionalId);

    if (updateError) {
      console.error("❌ Error storing verification token:", updateError);
      throw new Error("Failed to store verification token");
    }

    // Build the verification URL with the token (dashboard uses ?token= param)
    const finalVerificationUrl = `${verificationUrl}?token=${verificationToken}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Verify Your Email</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; color: #111827; margin-bottom: 20px;">
            Hi ${firstName},
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
            Thank you for claiming your Top10Lists.us profile! Click the button below to verify your email and complete your registration:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${finalVerificationUrl}" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Verify My Email
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
            Or copy and paste this link into your browser:<br>
            <a href="${finalVerificationUrl}" style="color: #2563eb; word-break: break-all;">${finalVerificationUrl}</a>
          </p>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
            This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
          </p>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
            <p style="color: #374151; margin-bottom: 10px;">
              <strong>Robert Maynard</strong><br>
              <em>Founder</em><br><br>
              Give me a call if I can help you:<br>
              <a href="tel:+16027589600" style="color: #2563eb;">(602) 758-9600</a>
            </p>
          </div>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: "Robert from Top10Lists <hello@top10lists.us>",
      replyTo: "robert@top10lists.us",
      to: [email],
      subject: `${firstName}, verify your email for Top10Lists.us`,
      html: emailHtml,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      throw new Error(error.message);
    }

    console.log(`✅ Verification email sent to ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error in send-funnel-verification:", error);
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
