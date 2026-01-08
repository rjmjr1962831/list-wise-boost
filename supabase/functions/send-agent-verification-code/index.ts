import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a cryptographically random 6-digit code
function generateVerificationCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = (array[0] % 1000000).toString().padStart(6, '0');
  return code;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ success: true, message: "If this email is registered, you'll receive a code shortly" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[send-agent-verification-code] Processing request for email: ${normalizedEmail.substring(0, 3)}***`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up professional by email
    const { data: professional, error: lookupError } = await supabase
      .from("professionals")
      .select("id, name, email, active")
      .eq("email", normalizedEmail)
      .eq("active", true)
      .maybeSingle();

    if (lookupError) {
      console.error("[send-agent-verification-code] Database lookup error:", lookupError);
      // Return generic success for security
      return new Response(
        JSON.stringify({ success: true, message: "If this email is registered, you'll receive a code shortly" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!professional) {
      console.log("[send-agent-verification-code] No active professional found for email");
      // Return generic success for security - never reveal if email exists
      return new Response(
        JSON.stringify({ success: true, message: "If this email is registered, you'll receive a code shortly" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting: Check how many codes were sent in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCodes, error: countError } = await supabase
      .from("agent_verification_codes")
      .select("*", { count: "exact", head: true })
      .eq("professional_id", professional.id)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("[send-agent-verification-code] Rate limit check error:", countError);
    }

    if (recentCodes && recentCodes >= 3) {
      console.log("[send-agent-verification-code] Rate limit exceeded for professional:", professional.id);
      return new Response(
        JSON.stringify({ success: false, error: "Too many verification requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate any existing unused codes
    const { error: invalidateError } = await supabase
      .from("agent_verification_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("professional_id", professional.id)
      .is("used_at", null);

    if (invalidateError) {
      console.error("[send-agent-verification-code] Error invalidating old codes:", invalidateError);
    }

    // Generate new code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Insert new verification code
    const { error: insertError } = await supabase
      .from("agent_verification_codes")
      .insert({
        professional_id: professional.id,
        code: code,
        delivery_method: "email",
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("[send-agent-verification-code] Error inserting code:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract first name
    const firstName = professional.name?.split(" ")[0] || "there";

    // Send email via Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Your Verification Code</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${firstName},</p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">Your verification code is:</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">${code}</span>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This code expires in 10 minutes.</p>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 14px; color: #6b7280; margin: 0;">
            Best regards,<br>
            <strong>Robert Maynard</strong><br>
            <em>Founder, Top10Lists.us</em>
          </p>
        </div>
      </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "Robert from Top10lists <robert@top10lists.us>",
      replyTo: "robert@top10lists.us",
      to: [professional.email],
      subject: `Your verification code - ${code}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("[send-agent-verification-code] Email send error:", emailError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send verification email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-agent-verification-code] Successfully sent code to professional: ${professional.id}`);

    return new Response(
      JSON.stringify({ success: true, message: "If this email is registered, you'll receive a code shortly" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-agent-verification-code] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
